import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionClaims } from '@/lib/supabase/auth-helpers'
import { getTenantLimits } from '@/lib/billing/limits'
import FlowsReportClient from './flows-report-client'

// ─── Types ────────────────────────────────────────────────────────────────────

type GraphNode = {
  id: string
  data?: { label?: string }
}
type Graph = { nodes?: GraphNode[] }

export interface StepStat {
  stepId: string
  stepLabel: string
  medianWaitHours: number
  totalCompletions: number
}

export interface FlowStat {
  flowId: string
  flowName: string
  total: number
  completed: number
  cancelled: number
  error: number
  pending: number
  completionRate: number
  cancellationRate: number
  errorRate: number
  avgCycleTimeHours: number | null
  lastTriggeredAt: string | null
  steps: StepStat[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

// ─── Data fetching ────────────────────────────────────────────────────────────

async function getFlowPerformanceData(tenantId: string, period: string): Promise<FlowStat[]> {
  const db = createAdminClient()

  let periodStart: string | null = null
  if (period !== 'all') {
    const days = parseInt(period, 10)
    if (!isNaN(days) && days > 0) {
      const d = new Date()
      d.setDate(d.getDate() - days)
      periodStart = d.toISOString()
    }
  }

  // ── 1. Flow instances with flow context + all tenant flows + last-triggered ─
  type RawInstance = {
    id: string
    status: string
    created_at: string
    updated_at: string | null
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

  type LastInstRow = {
    created_at: string
    flow_versions:
      | { flow_id: string; flows: { tenant_id: string } | null }
      | { flow_id: string; flows: { tenant_id: string } | null }[]
      | null
  }

  const oneYearAgoIso = new Date(Date.now() - 365 * 86_400_000).toISOString()

  let q = db.from('flow_instances').select(`
    id,
    status,
    created_at,
    updated_at,
    flow_versions!flow_version_id (
      flow_id,
      flows!flow_id ( id, name, tenant_id, latest_version_id )
    )
  `)
  if (periodStart) q = q.gte('created_at', periodStart)

  const [{ data: rawInstances, error }, { data: allFlowsData }, { data: lastInstRows }] =
    await Promise.all([
      q,
      db
        .from('flows')
        .select('id, name, status, latest_version_id')
        .eq('tenant_id', tenantId)
        .order('name'),
      db
        .from('flow_instances')
        .select('created_at, flow_versions!flow_version_id(flow_id, flows!flow_id(tenant_id))')
        .gte('created_at', oneYearAgoIso)
        .order('created_at', { ascending: false }),
    ])

  if (error) throw new Error(error.message)

  const instances = (rawInstances ?? []) as unknown as RawInstance[]
  const tenantInstances = instances.filter((i) => i.flow_versions?.flows?.tenant_id === tenantId)

  // Build all-time last-triggered map from the 1-year lookback
  const lastTriggeredMap = new Map<string, string>()
  for (const row of (lastInstRows ?? []) as unknown as LastInstRow[]) {
    const fv = Array.isArray(row.flow_versions) ? row.flow_versions[0] : row.flow_versions
    if (!fv) continue
    const flow = Array.isArray(fv.flows) ? fv.flows[0] : fv.flows
    if (flow?.tenant_id !== tenantId) continue
    if (!lastTriggeredMap.has(fv.flow_id)) {
      lastTriggeredMap.set(fv.flow_id, row.created_at)
    }
  }

  // ── 2. Aggregate per-flow stats ──────────────────────────────────────────
  type FlowAccum = {
    flowId: string
    flowName: string
    latestVersionId: string | null
    total: number
    completed: number
    cancelled: number
    error: number
    pending: number
    cycleTimes: number[]
    periodLastCreatedAt: string | null
  }

  const flowMap = new Map<string, FlowAccum>()
  const instanceFlowMap = new Map<string, string>()

  for (const inst of tenantInstances) {
    const flow = inst.flow_versions?.flows
    if (!flow) continue

    if (!flowMap.has(flow.id)) {
      flowMap.set(flow.id, {
        flowId: flow.id,
        flowName: flow.name,
        latestVersionId: flow.latest_version_id,
        total: 0,
        completed: 0,
        cancelled: 0,
        error: 0,
        pending: 0,
        cycleTimes: [],
        periodLastCreatedAt: null,
      })
    }
    const acc = flowMap.get(flow.id)!
    acc.total++

    if (!acc.periodLastCreatedAt || inst.created_at > acc.periodLastCreatedAt) {
      acc.periodLastCreatedAt = inst.created_at
    }

    if (inst.status === 'completed') {
      acc.completed++
      if (inst.updated_at) {
        const hours =
          (new Date(inst.updated_at).getTime() - new Date(inst.created_at).getTime()) / 3_600_000
        if (hours >= 0) acc.cycleTimes.push(hours)
      }
      instanceFlowMap.set(inst.id, flow.id)
    } else if (inst.status === 'cancelled') {
      acc.cancelled++
    } else if (inst.status === 'error') {
      acc.error++
    } else {
      acc.pending++
    }
  }

  // Add tenant flows that had no instances in the selected period
  for (const f of allFlowsData ?? []) {
    if (!flowMap.has(f.id)) {
      flowMap.set(f.id, {
        flowId: f.id,
        flowName: f.name,
        latestVersionId:
          (f as { id: string; name: string; status: string; latest_version_id: string | null })
            .latest_version_id ?? null,
        total: 0,
        completed: 0,
        cancelled: 0,
        error: 0,
        pending: 0,
        cycleTimes: [],
        periodLastCreatedAt: null,
      })
    }
  }

  // ── 3. Step-level wait times for completed instances ─────────────────────
  const stepWaitMap = new Map<string, Map<string, number[]>>()

  const completedInstanceIds = Array.from(instanceFlowMap.keys())
  if (completedInstanceIds.length > 0) {
    const { data: stepRows } = await db
      .from('step_instances')
      .select('instance_id, step_id, created_at, completed_at')
      .in('instance_id', completedInstanceIds)
      .eq('status', 'completed')
      .not('completed_at', 'is', null)

    for (const s of stepRows ?? []) {
      const flowId = instanceFlowMap.get(s.instance_id)
      if (!flowId || !s.completed_at) continue
      const hours =
        (new Date(s.completed_at).getTime() - new Date(s.created_at).getTime()) / 3_600_000
      if (hours < 0) continue
      if (!stepWaitMap.has(flowId)) stepWaitMap.set(flowId, new Map())
      const m = stepWaitMap.get(flowId)!
      if (!m.has(s.step_id)) m.set(s.step_id, [])
      m.get(s.step_id)!.push(hours)
    }
  }

  // ── 4. Flow version graphs for step label resolution ─────────────────────
  const labelMap = new Map<string, Map<string, string>>()

  const latestVersionIds = Array.from(flowMap.values())
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

  // ── 5. Build final FlowStat array ────────────────────────────────────────
  return Array.from(flowMap.values())
    .map((f): FlowStat => {
      const stepLabelMap = labelMap.get(f.flowId) ?? new Map<string, string>()
      const flowStepWait = stepWaitMap.get(f.flowId) ?? new Map<string, number[]>()

      const steps: StepStat[] = Array.from(flowStepWait.entries())
        .map(([stepId, times]) => ({
          stepId,
          stepLabel: stepLabelMap.get(stepId) ?? 'Unknown step',
          medianWaitHours: median(times),
          totalCompletions: times.length,
        }))
        .sort((a, b) => b.medianWaitHours - a.medianWaitHours)

      const avgCycleTimeHours =
        f.cycleTimes.length > 0
          ? f.cycleTimes.reduce((a, b) => a + b, 0) / f.cycleTimes.length
          : null

      return {
        flowId: f.flowId,
        flowName: f.flowName,
        total: f.total,
        completed: f.completed,
        cancelled: f.cancelled,
        error: f.error,
        pending: f.pending,
        completionRate: f.total > 0 ? f.completed / f.total : 0,
        cancellationRate: f.total > 0 ? f.cancelled / f.total : 0,
        errorRate: f.total > 0 ? f.error / f.total : 0,
        avgCycleTimeHours,
        lastTriggeredAt: lastTriggeredMap.get(f.flowId) ?? f.periodLastCreatedAt ?? null,
        steps,
      }
    })
    .sort((a, b) => b.total - a.total)
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function FlowsReportPage({
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

  // Cap requested period to what the plan allows
  function isAllowed(p: string) {
    if (maxDays === null) return true
    if (p === 'all') return false
    return parseInt(p, 10) <= maxDays
  }
  const raw = searchParams.period
  const period =
    ['7', '30', '90', 'all'].includes(raw ?? '') && isAllowed(raw ?? '') ? (raw as string) : '7'

  const flows = await getFlowPerformanceData(tenantId, period)

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 space-y-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Flow Performance</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Cycle times, completion rates, and step-level bottlenecks for your workflows.
        </p>
      </div>
      <FlowsReportClient flows={flows} period={period} maxDays={maxDays} />
    </main>
  )
}
