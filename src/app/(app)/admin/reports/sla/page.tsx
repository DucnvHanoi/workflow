import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionClaims } from '@/lib/supabase/auth-helpers'
import { getTenantLimits } from '@/lib/billing/limits'
import SLAReportClient from './sla-report-client'

// ─── Types ────────────────────────────────────────────────────────────────────

type GraphNode = { id: string; data?: { label?: string } }
type Graph = { nodes?: GraphNode[] }

export interface StepSLAStat {
  stepId: string
  stepLabel: string
  onTime: number
  breached: number // completed after due_at
  currentlyOverdue: number // pending and past due_at
  notYetDue: number // pending and not yet due
  breachRate: number // breached / (onTime + breached) — resolved only
}

export interface EscalationStat {
  escalatedCount: number
  escalatedAvgCompletionHours: number | null
  nonEscalatedBreachedAvgCompletionHours: number | null
}

export interface FlowSLAStat {
  flowId: string
  flowName: string
  onTime: number
  breached: number
  currentlyOverdue: number
  notYetDue: number
  breachRate: number
  steps: StepSLAStat[]
  escalation: EscalationStat
}

// ─── Data fetching ────────────────────────────────────────────────────────────

async function getSLAData(tenantId: string, period: string): Promise<FlowSLAStat[]> {
  const db = createAdminClient()
  const now = new Date()

  let periodStart: string | null = null
  if (period !== 'all') {
    const days = parseInt(period, 10)
    if (!isNaN(days) && days > 0) {
      const d = new Date(now)
      d.setDate(d.getDate() - days)
      periodStart = d.toISOString()
    }
  }

  // ── 1. Flow instances with flow context (tenant-scoped) ───────────────────
  type RawInstance = {
    id: string
    flow_versions: {
      flow_id: string
      flows: {
        id: string
        name: string
        tenant_id: string
        latest_version_id: string | null
      } | null
    } | null
  }

  let q = db.from('flow_instances').select(`
    id,
    flow_versions!flow_version_id (
      flow_id,
      flows!flow_id ( id, name, tenant_id, latest_version_id )
    )
  `)
  if (periodStart) q = q.gte('created_at', periodStart)

  const { data: rawInstances, error } = await q
  if (error) throw new Error(error.message)

  const instances = (rawInstances ?? []) as unknown as RawInstance[]
  const tenantInstances = instances.filter((i) => i.flow_versions?.flows?.tenant_id === tenantId)

  type FlowInfo = { flowId: string; flowName: string; latestVersionId: string | null }
  const instanceFlowMap = new Map<string, FlowInfo>()
  const flowInfoMap = new Map<string, FlowInfo>()

  for (const inst of tenantInstances) {
    const flow = inst.flow_versions?.flows
    if (!flow) continue
    const info: FlowInfo = {
      flowId: flow.id,
      flowName: flow.name,
      latestVersionId: flow.latest_version_id,
    }
    instanceFlowMap.set(inst.id, info)
    flowInfoMap.set(flow.id, info)
  }

  const allInstanceIds = Array.from(instanceFlowMap.keys())
  if (allInstanceIds.length === 0) return []

  // ── 2. Step instances with SLA configured ────────────────────────────────
  type RawStep = {
    id: string
    step_id: string
    instance_id: string
    status: string
    created_at: string
    completed_at: string | null
    due_at: string | null
  }

  const { data: rawSteps } = await db
    .from('step_instances')
    .select('id, step_id, instance_id, status, created_at, completed_at, due_at')
    .in('instance_id', allInstanceIds)
    .not('due_at', 'is', null)

  const slaSteps = (rawSteps ?? []) as RawStep[]

  // ── 3. Escalation notifications for these step instances ─────────────────
  const stepInstanceIds = slaSteps.map((s) => s.id)
  const escalatedSet = new Set<string>()

  if (stepInstanceIds.length > 0) {
    const { data: escRows } = await db
      .from('notification_logs')
      .select('step_instance_id')
      .eq('tenant_id', tenantId)
      .eq('email_type', 'sla_escalation')
      .not('step_instance_id', 'is', null)
      .in('step_instance_id', stepInstanceIds)

    for (const row of escRows ?? []) {
      if (row.step_instance_id) escalatedSet.add(row.step_instance_id)
    }
  }

  // ── 4. Flow version graphs for step label resolution ─────────────────────
  const labelMap = new Map<string, Map<string, string>>()
  const latestVersionIds = Array.from(flowInfoMap.values())
    .map((f) => f.latestVersionId)
    .filter((id): id is string => id !== null)

  if (latestVersionIds.length > 0) {
    const { data: versions } = await db
      .from('flow_versions')
      .select('id, flow_id, graph')
      .in('id', latestVersionIds)

    for (const v of versions ?? []) {
      const graph = v.graph as Graph | null
      if (!graph?.nodes) continue
      const m = new Map<string, string>()
      for (const node of graph.nodes) {
        if (node.data?.label) m.set(node.id, node.data.label)
      }
      labelMap.set(v.flow_id, m)
    }
  }

  // ── 5. Aggregate per-flow SLA stats ─────────────────────────────────────
  const nowMs = now.getTime()

  type StepAccum = {
    onTime: number
    breached: number
    currentlyOverdue: number
    notYetDue: number
    breachedCompletionHours: number[]
    escalatedCompletionHours: number[]
  }
  type FlowAccum = {
    steps: Map<string, StepAccum>
    escalatedCount: number
    escalatedCompletionHours: number[]
    nonEscalatedBreachedCompletionHours: number[]
  }

  const flowAccum = new Map<string, FlowAccum>()

  for (const step of slaSteps) {
    const flowInfo = instanceFlowMap.get(step.instance_id)
    if (!flowInfo || !step.due_at) continue

    if (!flowAccum.has(flowInfo.flowId)) {
      flowAccum.set(flowInfo.flowId, {
        steps: new Map(),
        escalatedCount: 0,
        escalatedCompletionHours: [],
        nonEscalatedBreachedCompletionHours: [],
      })
    }
    const acc = flowAccum.get(flowInfo.flowId)!

    if (!acc.steps.has(step.step_id)) {
      acc.steps.set(step.step_id, {
        onTime: 0,
        breached: 0,
        currentlyOverdue: 0,
        notYetDue: 0,
        breachedCompletionHours: [],
        escalatedCompletionHours: [],
      })
    }
    const stepAcc = acc.steps.get(step.step_id)!

    const dueMs = new Date(step.due_at).getTime()
    const isEscalated = escalatedSet.has(step.id)

    if (step.status === 'completed' && step.completed_at) {
      const completedMs = new Date(step.completed_at).getTime()
      const completionHours = (completedMs - new Date(step.created_at).getTime()) / 3_600_000

      if (completedMs <= dueMs) {
        stepAcc.onTime++
      } else {
        stepAcc.breached++
        if (isEscalated) {
          acc.escalatedCompletionHours.push(completionHours)
        } else {
          acc.nonEscalatedBreachedCompletionHours.push(completionHours)
        }
      }

      if (isEscalated) {
        acc.escalatedCount++
        acc.escalatedCompletionHours.push(completionHours)
      }
    } else if (step.status === 'pending') {
      if (dueMs < nowMs) {
        stepAcc.currentlyOverdue++
        if (isEscalated) acc.escalatedCount++
      } else {
        stepAcc.notYetDue++
      }
    }
  }

  // ── 6. Build FlowSLAStat array ─────────────────────────────────────────────
  function avg(arr: number[]): number | null {
    return arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null
  }

  return Array.from(flowAccum.entries())
    .map(([flowId, acc]): FlowSLAStat => {
      const flowInfo = flowInfoMap.get(flowId)!
      const stepLabelMap = labelMap.get(flowId) ?? new Map<string, string>()

      let totalOnTime = 0,
        totalBreached = 0,
        totalOverdue = 0,
        totalNotYetDue = 0

      const steps: StepSLAStat[] = Array.from(acc.steps.entries())
        .map(([stepId, s]): StepSLAStat => {
          totalOnTime += s.onTime
          totalBreached += s.breached
          totalOverdue += s.currentlyOverdue
          totalNotYetDue += s.notYetDue
          const resolved = s.onTime + s.breached
          return {
            stepId,
            stepLabel: stepLabelMap.get(stepId) ?? 'Unknown step',
            onTime: s.onTime,
            breached: s.breached,
            currentlyOverdue: s.currentlyOverdue,
            notYetDue: s.notYetDue,
            breachRate: resolved > 0 ? s.breached / resolved : 0,
          }
        })
        .sort((a, b) => b.breachRate - a.breachRate || b.breached - a.breached)

      const resolved = totalOnTime + totalBreached
      return {
        flowId,
        flowName: flowInfo.flowName,
        onTime: totalOnTime,
        breached: totalBreached,
        currentlyOverdue: totalOverdue,
        notYetDue: totalNotYetDue,
        breachRate: resolved > 0 ? totalBreached / resolved : 0,
        steps,
        escalation: {
          escalatedCount: acc.escalatedCount,
          escalatedAvgCompletionHours: avg(acc.escalatedCompletionHours),
          nonEscalatedBreachedAvgCompletionHours: avg(acc.nonEscalatedBreachedCompletionHours),
        },
      }
    })
    .filter((f) => f.onTime + f.breached + f.currentlyOverdue + f.notYetDue > 0)
    .sort((a, b) => b.breachRate - a.breachRate || b.breached - a.breached)
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function SLAReportPage({
  searchParams,
}: {
  searchParams: { period?: string }
}) {
  const { user, claims } = await getSessionClaims()
  if (!user) redirect('/login')
  if (claims?.role !== 'admin') redirect('/tasks')
  if (!claims?.tenant_id) redirect('/tasks')

  const tenantId = claims.tenant_id as string
  const limits = await getTenantLimits(tenantId)
  const maxDays = limits.reportWindowDays

  function isAllowed(p: string) {
    if (maxDays === null) return true
    if (p === 'all') return false
    return parseInt(p, 10) <= maxDays
  }
  const raw = searchParams.period
  const period =
    ['7', '30', '90', 'all'].includes(raw ?? '') && isAllowed(raw ?? '') ? (raw as string) : '7'

  const flows = await getSLAData(tenantId, period)

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 space-y-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">SLA Adherence</h1>
        <p className="text-sm text-muted-foreground mt-1">
          On-time completion rates and breach analysis for SLA-configured workflow steps.
        </p>
      </div>
      <SLAReportClient flows={flows} period={period} maxDays={maxDays} />
    </main>
  )
}
