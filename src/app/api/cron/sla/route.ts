import { type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendSlaDigestEmail, sendEscalationEmail } from '@/lib/email/resend'
import type { SerializedGraph } from '@/lib/flows/graph'

export async function GET(request: NextRequest) {
  // Verify CRON_SECRET — Vercel sends it as a Bearer token
  const authHeader = request.headers.get('authorization')
  const secret = authHeader?.replace('Bearer ', '')
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createAdminClient()
  const now = new Date()
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  const todayStart = new Date(now)
  todayStart.setUTCHours(0, 0, 0, 0)

  // 1. All pending step_instances that have a due date
  const { data: pendingSteps, error: stepsError } = await db
    .from('step_instances')
    .select('id, instance_id, step_id, assigned_to, due_at, escalate_after_hours')
    .eq('status', 'pending')
    .not('due_at', 'is', null)

  if (stepsError) {
    console.error('[cron/sla] Failed to fetch pending steps:', stepsError.message)
    return Response.json({ error: stepsError.message }, { status: 500 })
  }
  if (!pendingSteps || pendingSteps.length === 0) {
    return Response.json({ processed: 0, digestsSent: 0, escalationsSent: 0 })
  }

  // 2. Resolve flow names + step labels via instance → version → graph
  const instanceIds = Array.from(new Set(pendingSteps.map((s) => s.instance_id as string)))

  const { data: flowInstances } = await db
    .from('flow_instances')
    .select('id, flow_version_id')
    .in('id', instanceIds)

  const versionIds = Array.from(
    new Set((flowInstances ?? []).map((fi) => fi.flow_version_id as string))
  )

  const { data: versions } = versionIds.length
    ? await db.from('flow_versions').select('id, flow_id, graph').in('id', versionIds)
    : { data: [] }

  const flowIds = Array.from(new Set((versions ?? []).map((v) => v.flow_id as string)))

  const { data: flows } = flowIds.length
    ? await db.from('flows').select('id, name, tenant_id').in('id', flowIds)
    : { data: [] }

  // Build lookup maps
  const instanceToVersionId: Record<string, string> = {}
  for (const fi of flowInstances ?? []) {
    instanceToVersionId[fi.id as string] = fi.flow_version_id as string
  }

  const versionMap: Record<string, { flow_id: string; graph: unknown }> = {}
  for (const v of versions ?? []) {
    versionMap[v.id as string] = { flow_id: v.flow_id as string, graph: v.graph }
  }

  const flowMap: Record<string, { name: string; tenant_id: string }> = {}
  for (const f of flows ?? []) {
    flowMap[f.id as string] = { name: f.name as string, tenant_id: f.tenant_id as string }
  }

  // Step label lookup: versionId → { stepId → label }
  const stepLabelsByVersion: Record<string, Record<string, string>> = {}
  for (const v of versions ?? []) {
    const graph = v.graph as SerializedGraph
    stepLabelsByVersion[v.id as string] = Object.fromEntries(
      (graph?.nodes ?? []).map((n) => [n.id, (n.data?.label as string) ?? 'Step'])
    )
  }

  // 3. Resolve assignees
  const assigneeIds = Array.from(
    new Set(pendingSteps.map((s) => s.assigned_to as string).filter(Boolean))
  )

  const { data: assignees } = assigneeIds.length
    ? await db
        .from('users')
        .select('id, email, full_name, manager_id, tenant_id')
        .in('id', assigneeIds)
    : { data: [] }

  type AssigneeRow = {
    id: string
    email: string
    full_name: string | null
    manager_id: string | null
    tenant_id: string
  }

  const assigneeMap: Record<string, AssigneeRow> = {}
  for (const u of assignees ?? []) {
    assigneeMap[u.id as string] = u as AssigneeRow
  }

  // 4. Categorize each step
  type StepInfo = {
    stepInstanceId: string
    instanceId: string
    stepLabel: string
    flowName: string
    dueAt: Date
    isOverdue: boolean
    isDueSoon: boolean
    needsEscalation: boolean
    assigneeId: string
    tenantId: string
  }

  const stepInfos: StepInfo[] = []

  for (const step of pendingSteps) {
    const assignee = assigneeMap[step.assigned_to as string]
    if (!assignee) continue

    const dueAt = new Date(step.due_at as string)
    const isOverdue = dueAt < now
    const isDueSoon = !isOverdue && dueAt <= in24h
    if (!isOverdue && !isDueSoon) continue // outside the 24h window — skip entirely

    const versionId = instanceToVersionId[step.instance_id as string]
    const version = versionMap[versionId]
    const flow = flowMap[version?.flow_id]
    const stepLabel = stepLabelsByVersion[versionId]?.[step.step_id as string] ?? 'Step'
    const flowName = flow?.name ?? 'Flow'
    const tenantId = flow?.tenant_id ?? assignee.tenant_id

    const escalateAfterHours = step.escalate_after_hours as number | null
    const needsEscalation =
      isOverdue &&
      escalateAfterHours != null &&
      dueAt.getTime() + escalateAfterHours * 60 * 60 * 1000 < now.getTime()

    stepInfos.push({
      stepInstanceId: step.id as string,
      instanceId: step.instance_id as string,
      stepLabel,
      flowName,
      dueAt,
      isOverdue,
      isDueSoon,
      needsEscalation,
      assigneeId: step.assigned_to as string,
      tenantId,
    })
  }

  // 5. Digest emails — one per assignee, de-duped by today's notification_logs
  type AssigneeDigest = {
    email: string
    name: string
    tenantId: string
    overdue: StepInfo[]
    dueSoon: StepInfo[]
  }

  const digestMap: Record<string, AssigneeDigest> = {}
  for (const info of stepInfos) {
    const assignee = assigneeMap[info.assigneeId]
    if (!digestMap[info.assigneeId]) {
      digestMap[info.assigneeId] = {
        email: assignee.email,
        name: assignee.full_name ?? assignee.email,
        tenantId: info.tenantId,
        overdue: [],
        dueSoon: [],
      }
    }
    if (info.isOverdue) digestMap[info.assigneeId].overdue.push(info)
    else digestMap[info.assigneeId].dueSoon.push(info)
  }

  // Check which assignees already received a digest today
  const digestEmails = Array.from(new Set(Object.values(digestMap).map((d) => d.email)))
  const alreadySentEmails = new Set<string>()

  if (digestEmails.length > 0) {
    const { data: alreadySent } = await db
      .from('notification_logs')
      .select('recipient_email')
      .in('email_type', ['sla_reminder'])
      .gte('created_at', todayStart.toISOString())
      .in('recipient_email', digestEmails)

    for (const row of alreadySent ?? []) {
      alreadySentEmails.add(row.recipient_email as string)
    }
  }

  let digestsSent = 0
  for (const [_assigneeId, digest] of Object.entries(digestMap)) {
    if (alreadySentEmails.has(digest.email)) continue
    void sendSlaDigestEmail({
      tenantId: digest.tenantId,
      recipientEmail: digest.email,
      recipientName: digest.name,
      overdueSteps: digest.overdue.map((s) => ({
        flowName: s.flowName,
        stepName: s.stepLabel,
        dueAt: s.dueAt,
      })),
      dueSoonSteps: digest.dueSoon.map((s) => ({
        flowName: s.flowName,
        stepName: s.stepLabel,
        dueAt: s.dueAt,
      })),
    })
    digestsSent++
  }

  // 6. Escalation emails — one per step, de-duped by step_instance_id in notification_logs
  const escalationSteps = stepInfos.filter((s) => s.needsEscalation)
  const alreadyEscalatedIds = new Set<string>()

  if (escalationSteps.length > 0) {
    const escalationStepIds = escalationSteps.map((s) => s.stepInstanceId)
    const { data: alreadyEscalated } = await db
      .from('notification_logs')
      .select('step_instance_id')
      .eq('email_type', 'sla_escalation')
      .in('step_instance_id', escalationStepIds)

    for (const row of alreadyEscalated ?? []) {
      if (row.step_instance_id) alreadyEscalatedIds.add(row.step_instance_id as string)
    }
  }

  // Resolve manager emails for steps that need escalation and haven't been escalated yet
  const unescalatedSteps = escalationSteps.filter((s) => !alreadyEscalatedIds.has(s.stepInstanceId))

  const managerIds = Array.from(
    new Set(
      unescalatedSteps
        .map((s) => assigneeMap[s.assigneeId]?.manager_id)
        .filter((id): id is string => !!id)
    )
  )

  const managerMap: Record<string, { email: string; full_name: string | null }> = {}
  if (managerIds.length > 0) {
    const { data: managers } = await db
      .from('users')
      .select('id, email, full_name')
      .in('id', managerIds)

    for (const m of managers ?? []) {
      managerMap[m.id as string] = {
        email: m.email as string,
        full_name: m.full_name as string | null,
      }
    }
  }

  let escalationsSent = 0
  for (const step of unescalatedSteps) {
    const assignee = assigneeMap[step.assigneeId]
    const managerId = assignee?.manager_id
    if (!managerId) continue
    const manager = managerMap[managerId]
    if (!manager) continue

    const hoursOverdue = Math.round((now.getTime() - step.dueAt.getTime()) / (60 * 60 * 1000))

    void sendEscalationEmail({
      tenantId: step.tenantId,
      instanceId: step.instanceId,
      stepInstanceId: step.stepInstanceId,
      managerEmail: manager.email,
      managerName: manager.full_name ?? manager.email,
      assigneeName: assignee.full_name ?? assignee.email,
      flowName: step.flowName,
      stepName: step.stepLabel,
      hoursOverdue,
    })
    escalationsSent++
  }

  return Response.json({
    processed: pendingSteps.length,
    digestsSent,
    escalationsSent,
  })
}
