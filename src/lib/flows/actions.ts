'use server'

// FILE PATH: src/lib/flows/actions.ts
// All flow server actions live here — stable path, safe to import from client components.
// See project_info.txt: SERVER ACTIONS LOCATION RULE

import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionClaims } from '@/lib/supabase/auth-helpers'
import type { SerializedGraph } from '@/lib/flows/graph'
import type { FormField, BranchCondition } from '@/store/canvas-store'
import { sendAssignmentEmail } from '@/lib/email/resend'
import { logAuditEvent } from '@/lib/audit/log'
import { createNotification } from '@/lib/notifications/create'
import { revalidatePath } from 'next/cache'

export type FlowListItem = {
  id: string
  name: string
  status: 'draft' | 'published'
  description: string | null
  createdAt: string
  updatedAt: string
  versionNumber: number | null
  publishedAt: string | null
  categoryId: string | null
  categoryName: string | null
  categoryColor: string | null
}

// ─── Runtime instance types (Phase 3) ────────────────────────────────────────

export type FlowInstanceListItem = {
  id: string
  flowName: string
  status: 'pending' | 'completed' | 'cancelled' | 'error' // ── CHANGED: added 'error'
  currentStepId: string | null
  createdAt: string
  updatedAt: string
  currentStepName: string | null
  description?: string | null
}

// ── NEW: Flow timeline event type ─────────────────────────────────────────────
export type FlowEventLog = {
  id: string
  instanceId: string
  stepInstanceId: string | null
  tenantId: string
  actorId: string | null
  actorName: string | null // resolved from users table join
  eventType:
    | 'flow_triggered'
    | 'step_assigned'
    | 'step_draft_saved'
    | 'step_submitted'
    | 'branch_evaluated'
    | 'flow_completed'
    | 'flow_error'
    | 'flow_cancelled'
  description: string
  metadata: Record<string, unknown>
  createdAt: string
}

type FlowVersionRow = {
  version_number: number
  published_at: string | null
}

type FlowCategoryRow = {
  id: string
  name: string
  color: string
}

/** PostgREST may return an embedded FK row as object or single-element array. */
type FlowRow = {
  id: string
  name: string
  status: string
  description: string | null
  created_at: string
  updated_at: string
  flow_versions: FlowVersionRow | FlowVersionRow[] | null
  flow_categories: FlowCategoryRow | FlowCategoryRow[] | null
}

function embeddedFlowVersion(v: FlowRow['flow_versions']): FlowVersionRow | null {
  if (v == null) return null
  return Array.isArray(v) ? (v[0] ?? null) : v
}

function embeddedCategory(v: FlowRow['flow_categories']): FlowCategoryRow | null {
  if (v == null) return null
  return Array.isArray(v) ? (v[0] ?? null) : v
}

type AdminDb = ReturnType<typeof createAdminClient>

// ─── Auth helpers ─────────────────────────────────────────────────────────────

// ─── Translate canvas AssigneeRule (camelCase) → Edge Function format (snake_case) ──
// The canvas store saves departmentId in camelCase. The Edge Function expects
// snake_case. This translation happens at the call site only — no other code changes.
function toEdgeFunctionRule(rule: { type?: string } | null): Record<string, unknown> | null {
  if (!rule?.type) return null
  const r = rule as Record<string, unknown>
  switch (r.type) {
    case 'department_head':
      return { type: 'department_head', department_id: r.departmentId }
    case 'role_in_dept':
      return { type: 'role_in_dept', department_id: r.departmentId, role: r.role }
    default:
      return rule as Record<string, unknown>
  }
}

async function requireAdminWithTenant(): Promise<
  { ok: true; userId: string; tenantId: string; db: AdminDb } | { ok: false; error: string }
> {
  const { user, claims } = await getSessionClaims()
  if (!user) return { ok: false, error: 'Unauthenticated' }
  if (claims.role !== 'admin') return { ok: false, error: 'Unauthorized' }
  if (!claims.tenant_id) return { ok: false, error: 'Tenant not found' }
  return { ok: true, userId: user.id, tenantId: claims.tenant_id, db: createAdminClient() }
}

/** Works for any authenticated tenant user (admin or regular user). */
async function requireAuthWithTenant(): Promise<
  | { ok: true; userId: string; tenantId: string; role: string; db: AdminDb }
  | { ok: false; error: string }
> {
  const { user, claims } = await getSessionClaims()
  if (!user) return { ok: false, error: 'Unauthenticated' }
  if (!claims.tenant_id) return { ok: false, error: 'Tenant not found' }
  return {
    ok: true,
    userId: user.id,
    tenantId: claims.tenant_id,
    role: claims.role ?? 'user',
    db: createAdminClient(),
  }
}

async function assertFlowInTenant(
  db: AdminDb,
  flowId: string,
  tenantId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data, error } = await db
    .from('flows')
    .select('id')
    .eq('id', flowId)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (error) return { ok: false, error: error.message }
  if (!data) return { ok: false, error: 'Flow not found or access denied' }
  return { ok: true }
}

// ── SLA helper ────────────────────────────────────────────────────────────────
// Returns an ISO due_at timestamp or null when the node has no SLA configured.
function computeDueAt(slaHours: number | undefined | null): string | null {
  if (!slaHours || slaHours <= 0) return null
  return new Date(Date.now() + slaHours * 60 * 60 * 1000).toISOString()
}

// ── NEW: internal helper to write an event log row ──────────────────────────
// Non-fatal — if logging fails, the flow still continues. Never throws.
async function writeEventLog(
  db: AdminDb,
  params: {
    instanceId: string
    stepInstanceId?: string | null
    tenantId: string
    actorId?: string | null
    eventType: FlowEventLog['eventType']
    description: string
    metadata?: Record<string, unknown>
  }
): Promise<void> {
  try {
    await db.from('flow_event_logs').insert({
      instance_id: params.instanceId,
      step_instance_id: params.stepInstanceId ?? null,
      tenant_id: params.tenantId,
      actor_id: params.actorId ?? null,
      event_type: params.eventType,
      description: params.description,
      metadata: params.metadata ?? {},
    })
  } catch {
    // Non-fatal — never block the flow for a logging failure
  }
}

// ── NEW: resolve a user's display name for log messages ─────────────────────
async function resolveUserName(db: AdminDb, userId: string): Promise<string> {
  try {
    const { data } = await db
      .from('users')
      .select('full_name, email')
      .eq('id', userId)
      .maybeSingle()
    return data?.full_name ?? data?.email ?? 'Unknown user'
  } catch {
    return 'Unknown user'
  }
}

// ─── Save a draft version ─────────────────────────────────────────────────────────

export async function saveDraftVersion(
  flowId: string,
  graph: SerializedGraph
): Promise<{ versionId: string; versionNumber: number; error?: string }> {
  const gate = await requireAdminWithTenant()
  if (!gate.ok) return { versionId: '', versionNumber: 0, error: gate.error }

  const { tenantId, db } = gate
  const access = await assertFlowInTenant(db, flowId, tenantId)
  if (!access.ok) return { versionId: '', versionNumber: 0, error: access.error }

  const { data: existing } = await db
    .from('flow_versions')
    .select('version_number')
    .eq('flow_id', flowId)
    .order('version_number', { ascending: false })
    .limit(1)
    .single()

  const nextVersion = (existing?.version_number ?? 0) + 1

  const { data: version, error: insertErr } = await db
    .from('flow_versions')
    .insert({
      flow_id: flowId,
      version_number: nextVersion,
      graph: graph as unknown as Record<string, unknown>,
      published_at: null,
    })
    .select('id, version_number')
    .single()

  if (insertErr || !version) {
    return {
      versionId: '',
      versionNumber: 0,
      error: insertErr?.message ?? 'Insert failed',
    }
  }

  await db
    .from('flows')
    .update({
      latest_version_id: version.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', flowId)
    .eq('tenant_id', tenantId)

  return { versionId: version.id, versionNumber: version.version_number }
}

// ─── Update the latest draft graph in place ───────────────────────────────────
// Used for position-only canvas changes (node drags). Unlike saveDraftVersion,
// this does NOT create a new version — it overwrites the latest draft's graph.
// Guard: if the latest version is already published, we must not mutate it, so
// we fall back to inserting a fresh draft via saveDraftVersion.
export async function updateDraftGraph(
  flowId: string,
  graph: SerializedGraph
): Promise<{ versionId: string; versionNumber: number; error?: string }> {
  const gate = await requireAdminWithTenant()
  if (!gate.ok) return { versionId: '', versionNumber: 0, error: gate.error }

  const { tenantId, db } = gate
  const access = await assertFlowInTenant(db, flowId, tenantId)
  if (!access.ok) return { versionId: '', versionNumber: 0, error: access.error }

  const { data: latest } = await db
    .from('flow_versions')
    .select('id, version_number, published_at')
    .eq('flow_id', flowId)
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle()

  // No version yet, or the latest is published → don't overwrite history.
  if (!latest || latest.published_at !== null) {
    return saveDraftVersion(flowId, graph)
  }

  const { error: updateErr } = await db
    .from('flow_versions')
    .update({ graph: graph as unknown as Record<string, unknown> })
    .eq('id', latest.id)
    .eq('flow_id', flowId)

  if (updateErr) {
    return { versionId: '', versionNumber: 0, error: updateErr.message }
  }

  await db
    .from('flows')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', flowId)
    .eq('tenant_id', tenantId)

  return { versionId: latest.id, versionNumber: latest.version_number }
}

// ─── Fetch latest graph for a flow ───────────────────────────────────────────

export async function getLatestDraftGraph(
  flowId: string
): Promise<{ graph: SerializedGraph | null; error?: string }> {
  const gate = await requireAdminWithTenant()
  if (!gate.ok) return { graph: null, error: gate.error }

  const { tenantId, db } = gate
  const access = await assertFlowInTenant(db, flowId, tenantId)
  if (!access.ok) return { graph: null, error: access.error }

  const { data, error } = await db
    .from('flow_versions')
    .select('graph')
    .eq('flow_id', flowId)
    .order('version_number', { ascending: false })
    .limit(1)
    .single()

  if (error && error.code !== 'PGRST116') {
    return { graph: null, error: error.message }
  }

  return { graph: (data?.graph as SerializedGraph) ?? null }
}

// ─── Fetch version list ───────────────────────────────────────────────────────

export async function getFlowVersions(flowId: string): Promise<{
  versions: {
    id: string
    version_number: number
    published_at: string | null
    created_at: string
  }[]
  error?: string
}> {
  const gate = await requireAdminWithTenant()
  if (!gate.ok) return { versions: [], error: gate.error }

  const { tenantId, db } = gate
  const access = await assertFlowInTenant(db, flowId, tenantId)
  if (!access.ok) return { versions: [], error: access.error }

  const { data, error } = await db
    .from('flow_versions')
    .select('id, version_number, published_at, created_at')
    .eq('flow_id', flowId)
    .order('version_number', { ascending: false })
    .limit(20)

  if (error) return { versions: [], error: error.message }
  return { versions: data ?? [] }
}

// ─── Publish a flow ───────────────────────────────────────────────────────────

export async function publishFlow(flowId: string): Promise<{ error: string | null }> {
  const gate = await requireAdminWithTenant()
  if (!gate.ok) return { error: gate.error }

  const { userId, tenantId, db } = gate
  const access = await assertFlowInTenant(db, flowId, tenantId)
  if (!access.ok) return { error: access.error }

  const { data: flow, error: flowError } = await db
    .from('flows')
    .select('name, latest_version_id')
    .eq('id', flowId)
    .eq('tenant_id', tenantId)
    .single()

  if (flowError || !flow?.latest_version_id) {
    return { error: 'Could not find a saved version to publish.' }
  }

  const { data: ver, error: verError } = await db
    .from('flow_versions')
    .update({ published_at: new Date().toISOString() })
    .eq('id', flow.latest_version_id)
    .eq('flow_id', flowId)
    .select('version_number')
    .maybeSingle()

  if (verError) return { error: verError.message }

  const { error: statusError } = await db
    .from('flows')
    .update({
      status: 'published',
      updated_at: new Date().toISOString(),
    })
    .eq('id', flowId)
    .eq('tenant_id', tenantId)

  if (statusError) return { error: statusError.message }

  await logAuditEvent(db, {
    tenantId,
    actorId: userId,
    action: 'flow_published',
    targetType: 'flow',
    targetId: flowId,
    targetLabel: flow.name,
    description: `Published "${flow.name}" (v${ver?.version_number ?? '?'})`,
    metadata: { versionNumber: ver?.version_number ?? null },
  })

  return { error: null }
}

// ─── Unpublish a flow ─────────────────────────────────────────────────────────

export async function unpublishFlow(flowId: string): Promise<{ error: string | null }> {
  const gate = await requireAdminWithTenant()
  if (!gate.ok) return { error: gate.error }

  const { userId, tenantId, db } = gate
  const access = await assertFlowInTenant(db, flowId, tenantId)
  if (!access.ok) return { error: access.error }

  const { data: flow, error } = await db
    .from('flows')
    .update({
      status: 'draft',
      updated_at: new Date().toISOString(),
    })
    .eq('id', flowId)
    .eq('tenant_id', tenantId)
    .select('name')
    .maybeSingle()

  if (error) return { error: error.message }

  await logAuditEvent(db, {
    tenantId,
    actorId: userId,
    action: 'flow_unpublished',
    targetType: 'flow',
    targetId: flowId,
    targetLabel: flow?.name ?? null,
    description: `Reverted "${flow?.name ?? 'flow'}" to draft`,
  })

  return { error: null }
}

// ─── Restore a version ────────────────────────────────────────────────────────

export async function restoreVersion(
  flowId: string,
  versionId: string
): Promise<{ error: string | null }> {
  const gate = await requireAdminWithTenant()
  if (!gate.ok) return { error: gate.error }

  const { tenantId, db } = gate
  const access = await assertFlowInTenant(db, flowId, tenantId)
  if (!access.ok) return { error: access.error }

  const { data: ver, error: verError } = await db
    .from('flow_versions')
    .select('graph, version_number')
    .eq('id', versionId)
    .eq('flow_id', flowId)
    .single()

  if (verError || !ver) return { error: 'Version not found.' }

  const { data: maxRow } = await db
    .from('flow_versions')
    .select('version_number')
    .eq('flow_id', flowId)
    .order('version_number', { ascending: false })
    .limit(1)
    .single()

  const nextVersion = (maxRow?.version_number ?? 0) + 1

  const { data: newVer, error: insertError } = await db
    .from('flow_versions')
    .insert({
      flow_id: flowId,
      version_number: nextVersion,
      graph: ver.graph,
      published_at: null,
    })
    .select('id')
    .single()

  if (insertError || !newVer) {
    return { error: insertError?.message ?? 'Insert failed.' }
  }

  const { error: updateError } = await db
    .from('flows')
    .update({
      latest_version_id: newVer.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', flowId)
    .eq('tenant_id', tenantId)

  if (updateError) return { error: updateError.message }

  return { error: null }
}

// ─── getFlows ────────────────────────────────────────────────────────────────

export async function getFlows(): Promise<{
  flows: FlowListItem[]
  error: string | null
}> {
  const gate = await requireAuthWithTenant()
  if (!gate.ok) return { flows: [], error: gate.error }

  const { tenantId, role, db } = gate

  let query = db
    .from('flows')
    .select(
      `
      id,
      name,
      status,
      description,
      created_at,
      updated_at,
      flow_versions!latest_version_id (
        version_number,
        published_at
      ),
      flow_categories!category_id (
        id,
        name,
        color
      )
    `
    )
    .eq('tenant_id', tenantId)
    .order('updated_at', { ascending: false })

  if (role !== 'admin') {
    query = query.eq('status', 'published')
  }

  const { data, error } = await query

  if (error) return { flows: [], error: error.message }

  const flows =
    (data as FlowRow[] | null)?.map((f) => {
      const latest = embeddedFlowVersion(f.flow_versions)
      const cat = embeddedCategory(f.flow_categories)
      return {
        id: f.id,
        name: f.name,
        status: f.status as 'draft' | 'published',
        description: f.description ?? null,
        createdAt: f.created_at,
        updatedAt: f.updated_at,
        versionNumber: latest?.version_number ?? null,
        publishedAt: latest?.published_at ?? null,
        categoryId: cat?.id ?? null,
        categoryName: cat?.name ?? null,
        categoryColor: cat?.color ?? null,
      }
    }) ?? []

  return { flows, error: null }
}

// ─── deleteFlow ──────────────────────────────────────────────────────────────

export async function deleteFlow(flowId: string): Promise<{ error: string | null }> {
  const gate = await requireAdminWithTenant()
  if (!gate.ok) return { error: gate.error }

  const { tenantId, db } = gate
  const access = await assertFlowInTenant(db, flowId, tenantId)
  if (!access.ok) return { error: access.error }

  const { data: versions } = await db.from('flow_versions').select('id').eq('flow_id', flowId)

  const versionIds = (versions ?? []).map((v: { id: string }) => v.id)

  if (versionIds.length > 0) {
    const { count: activeCount, error: activeError } = await db
      .from('flow_instances')
      .select('id', { count: 'exact', head: true })
      .in('flow_version_id', versionIds)
      .eq('status', 'pending')

    if (activeError) return { error: activeError.message }
    if ((activeCount ?? 0) > 0) {
      return {
        error: 'Cannot delete: this flow has active running instances. Cancel them first.',
      }
    }
  }

  const { error } = await db.from('flows').delete().eq('id', flowId).eq('tenant_id', tenantId)

  return { error: error?.message ?? null }
}

// ─── updateFlowDescription ───────────────────────────────────────────────────

export async function updateFlowDescription(
  flowId: string,
  description: string
): Promise<{ error: string | null }> {
  const gate = await requireAdminWithTenant()
  if (!gate.ok) return { error: gate.error }

  const { tenantId, db } = gate
  const access = await assertFlowInTenant(db, flowId, tenantId)
  if (!access.ok) return { error: access.error }

  const trimmed = description.trim()
  const wordCount = trimmed ? trimmed.split(/\s+/).filter(Boolean).length : 0
  if (wordCount > 100) {
    return { error: 'Description must be 100 words or fewer.' }
  }

  const { error } = await db
    .from('flows')
    .update({
      description: trimmed || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', flowId)
    .eq('tenant_id', tenantId)

  return { error: error?.message ?? null }
}

// ─── triggerFlow ─────────────────────────────────────────────────────────────

export async function triggerFlow(
  flowId: string
): Promise<{ instanceId: string | null; error: string | null }> {
  const gate = await requireAuthWithTenant()
  if (!gate.ok) return { instanceId: null, error: gate.error }

  const { userId, tenantId, db } = gate

  const { data: flow, error: flowError } = await db
    .from('flows')
    .select('id, status, latest_version_id')
    .eq('id', flowId)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (flowError || !flow) return { instanceId: null, error: 'Flow not found.' }
  if (flow.status !== 'published') return { instanceId: null, error: 'Flow is not published.' }
  if (!flow.latest_version_id) return { instanceId: null, error: 'Flow has no published version.' }

  const { data: version, error: versionError } = await db
    .from('flow_versions')
    .select('id, graph')
    .eq('id', flow.latest_version_id)
    .single()

  if (versionError || !version) return { instanceId: null, error: 'Could not load flow version.' }

  const graph = version.graph as SerializedGraph

  const triggerNode = graph.nodes.find((n) => n.type === 'trigger')
  if (!triggerNode) return { instanceId: null, error: 'Flow has no trigger node.' }

  const { data: instance, error: instanceError } = await db
    .from('flow_instances')
    .insert({
      flow_version_id: version.id,
      triggered_by: userId,
      current_step_id: null,
      status: 'pending',
    })
    .select('id')
    .single()

  if (instanceError || !instance) {
    return { instanceId: null, error: instanceError?.message ?? 'Could not create instance.' }
  }

  // ── NEW: resolve triggerer name once for log messages
  const triggererName = await resolveUserName(db, userId)

  // ── NEW: log flow_triggered event
  await writeEventLog(db, {
    instanceId: instance.id,
    tenantId,
    actorId: userId,
    eventType: 'flow_triggered',
    description: `${triggererName} started this flow.`,
    metadata: { flowId, versionId: version.id },
  })

  const firstEdge = graph.edges.find((e) => e.source === triggerNode.id)
  const firstNode = firstEdge ? graph.nodes.find((n) => n.id === firstEdge.target) : null

  if (!firstNode || firstNode.type === 'complete') {
    await db
      .from('flow_instances')
      .update({ status: 'completed', updated_at: new Date().toISOString() })
      .eq('id', instance.id)

    // ── NEW: log flow_completed for trivial flow
    await writeEventLog(db, {
      instanceId: instance.id,
      tenantId,
      actorId: null,
      eventType: 'flow_completed',
      description: 'Flow completed instantly (no steps configured).',
    })

    return { instanceId: instance.id, error: null }
  }

  const assigneeRule = (firstNode.data?.assigneeRule ?? null) as { type?: string } | null
  let assignedTo: string | null = null
  let assigneeError: string | null = null

  if (assigneeRule?.type) {
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

      const res = await fetch(`${supabaseUrl}/functions/v1/resolve-assignee`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({
          rule: toEdgeFunctionRule(assigneeRule),
          triggered_by_user_id: userId,
          tenant_id: tenantId,
        }),
      })

      if (res.ok) {
        const result = (await res.json()) as {
          assigned_to_user_id: string | null
          error: string | null
        }
        if (result.assigned_to_user_id) assignedTo = result.assigned_to_user_id
        else if (result.error) assigneeError = result.error
      }
    } catch {
      // Non-fatal
    }
  }

  const { data: stepInstance, error: stepError } = await db
    .from('step_instances')
    .insert({
      instance_id: instance.id,
      step_id: firstNode.id,
      assigned_to: assignedTo,
      form_data: {},
      status: 'pending',
      due_at: computeDueAt(firstNode.data?.slaHours as number | undefined),
    })
    .select('id')
    .single()

  if (stepError || !stepInstance) {
    return { instanceId: instance.id, error: stepError?.message ?? 'Could not create step.' }
  }

  await db
    .from('flow_instances')
    .update({
      current_step_id: stepInstance.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', instance.id)

  const stepLabel = (firstNode.data?.label as string | undefined) ?? 'Step'
  const assigneeName = assignedTo ? await resolveUserName(db, assignedTo) : 'Unassigned'
  const assignDescription = assigneeError
    ? `"${stepLabel}" could not be assigned: ${assigneeError}`
    : `"${stepLabel}" assigned to ${assigneeName}.`
  await writeEventLog(db, {
    instanceId: instance.id,
    stepInstanceId: stepInstance.id,
    tenantId,
    actorId: null,
    eventType: assigneeError ? 'flow_error' : 'step_assigned',
    description: assignDescription,
    metadata: { stepId: firstNode.id, assignedTo, assigneeRule, assigneeError },
  })

  if (assignedTo) {
    void createNotification({
      tenantId,
      userId: assignedTo,
      type: 'step_assigned',
      title: `New task: ${stepLabel}`,
      body: `You've been assigned a step. Open My Tasks to complete it.`,
      link: '/tasks',
    })
  }

  return { instanceId: instance.id, error: null }
}

// ─── getMyInstances ──────────────────────────────────────────────────────────

export async function getMyInstances(): Promise<{
  instances: FlowInstanceListItem[]
  error: string | null
}> {
  const gate = await requireAuthWithTenant()
  if (!gate.ok) return { instances: [], error: gate.error }

  const { userId, tenantId, db } = gate

  const { data, error } = await db
    .from('flow_instances')
    .select(
      `
      id,
      status,
      current_step_id,
      created_at,
      updated_at,
      flow_versions!flow_version_id (
        graph,
        flows!flow_id ( name, tenant_id )
      )
    `
    )
    .eq('triggered_by', userId)
    .order('updated_at', { ascending: false })

  if (error) return { instances: [], error: error.message }

  const instances = (data ?? []).map(
    (row: Record<string, unknown>): FlowInstanceListItem | null => {
      const fv = Array.isArray(row.flow_versions) ? row.flow_versions[0] : row.flow_versions
      const fl = fv
        ? Array.isArray((fv as Record<string, unknown>).flows)
          ? ((fv as Record<string, unknown>).flows as Record<string, unknown>[])[0]
          : (fv as Record<string, unknown>).flows
        : null

      const flowTenantId = (fl as Record<string, unknown> | null)?.tenant_id
      if (flowTenantId && flowTenantId !== tenantId) return null

      return {
        id: row.id as string,
        flowName: ((fl as Record<string, unknown> | null)?.name as string) ?? 'Unknown flow',
        status: row.status as 'pending' | 'completed' | 'cancelled' | 'error',
        currentStepId: (row.current_step_id as string | null) ?? null,
        createdAt: row.created_at as string,
        updatedAt: row.updated_at as string,
        currentStepName: null,
        description: row.description as string | null,
      }
    }
  )

  return {
    instances: instances.filter((i): i is FlowInstanceListItem => i !== null),
    error: null,
  }
}

// ─── getStepInstance ─────────────────────────────────────────────────────────

export async function getStepInstance(stepInstanceId: string): Promise<{
  stepInstance: {
    id: string
    step_id: string
    instance_id: string
    assigned_to: string | null
    form_data: Record<string, unknown>
    status: 'pending' | 'completed' | 'skipped'
    completed_at: string | null
  } | null
  error: string | null
}> {
  const gate = await requireAuthWithTenant()
  if (!gate.ok) return { stepInstance: null, error: gate.error }

  const { userId, tenantId, role, db } = gate

  const { data, error } = await db
    .from('step_instances')
    .select(
      `
      id,
      step_id,
      instance_id,
      assigned_to,
      form_data,
      status,
      completed_at,
      flow_instances!instance_id (
        triggered_by,
        flow_versions!flow_version_id (
          flows!flow_id ( tenant_id )
        )
      )
    `
    )
    .eq('id', stepInstanceId)
    .maybeSingle()

  if (error) return { stepInstance: null, error: error.message }
  if (!data) return { stepInstance: null, error: 'Step not found.' }

  const fi = Array.isArray(data.flow_instances) ? data.flow_instances[0] : data.flow_instances
  const fv = fi ? (Array.isArray(fi.flow_versions) ? fi.flow_versions[0] : fi.flow_versions) : null
  const fl = fv ? (Array.isArray(fv.flows) ? fv.flows[0] : fv.flows) : null

  if (!fl || fl.tenant_id !== tenantId) return { stepInstance: null, error: 'Not found.' }

  if (role !== 'admin' && data.assigned_to !== userId && fi?.triggered_by !== userId) {
    return { stepInstance: null, error: 'Access denied.' }
  }

  return {
    stepInstance: {
      id: data.id,
      step_id: data.step_id,
      instance_id: data.instance_id,
      assigned_to: data.assigned_to,
      form_data: (data.form_data as Record<string, unknown>) ?? {},
      status: data.status as 'pending' | 'completed' | 'skipped',
      completed_at: data.completed_at,
    },
    error: null,
  }
}

// ─── saveDraftStep ────────────────────────────────────────────────────────────

export async function saveDraftStep(
  stepInstanceId: string,
  formData: Record<string, unknown>
): Promise<{ error: string | null }> {
  const gate = await requireAuthWithTenant()
  if (!gate.ok) return { error: gate.error }

  const { userId, tenantId, role, db } = gate

  const { data: si, error: siError } = await db
    .from('step_instances')
    .select(
      `
      id,
      status,
      assigned_to,
      step_id,
      instance_id,
      flow_instances!instance_id (
        id,
        triggered_by,
        flow_versions!flow_version_id (
          graph,
          flows!flow_id ( tenant_id )
        )
      )
    `
    )
    .eq('id', stepInstanceId)
    .maybeSingle()

  if (siError || !si) return { error: 'Step not found.' }

  const fi = Array.isArray(si.flow_instances) ? si.flow_instances[0] : si.flow_instances
  const fv = fi ? (Array.isArray(fi.flow_versions) ? fi.flow_versions[0] : fi.flow_versions) : null
  const fl = fv ? (Array.isArray(fv.flows) ? fv.flows[0] : fv.flows) : null

  if (!fl || fl.tenant_id !== tenantId) return { error: 'Not found.' }
  if (si.status !== 'pending') return { error: 'This step is already completed.' }
  // FIXED: only the assigned user (or an admin) may save a draft.
  // Removed fi?.triggered_by !== userId — the flow triggerer must NOT be able
  // to write to steps assigned to other people.
  if (role !== 'admin' && si.assigned_to !== userId) {
    return { error: 'Access denied.' }
  }

  const { error: updateError } = await db
    .from('step_instances')
    .update({ form_data: formData })
    .eq('id', stepInstanceId)

  if (updateError) return { error: updateError.message }

  // ── NEW: log draft save event
  const graph = fv?.graph as SerializedGraph | undefined
  const stepNode = graph?.nodes.find((n) => n.id === si.step_id)
  const stepLabel = (stepNode?.data?.label as string | undefined) ?? 'Step'
  const actorName = await resolveUserName(db, userId)

  await writeEventLog(db, {
    instanceId: fi?.id ?? si.instance_id,
    stepInstanceId,
    tenantId,
    actorId: userId,
    eventType: 'step_draft_saved',
    description: `${actorName} saved a draft of "${stepLabel}".`,
    metadata: { stepId: si.step_id },
  })

  return { error: null }
}

// ─── submitStep ───────────────────────────────────────────────────────────────

export async function submitStep(
  stepInstanceId: string,
  formData: Record<string, unknown>
): Promise<{ error: string | null }> {
  const gate = await requireAuthWithTenant()
  if (!gate.ok) return { error: gate.error }

  const { userId, tenantId, role, db } = gate

  const { data: si, error: siError } = await db
    .from('step_instances')
    .select(
      `
      id,
      status,
      assigned_to,
      instance_id,
      step_id,
      flow_instances!instance_id (
        id,
        triggered_by,
        flow_version_id,
        flow_versions!flow_version_id (
          graph,
          flows!flow_id ( tenant_id )
        )
      )
    `
    )
    .eq('id', stepInstanceId)
    .maybeSingle()

  if (siError || !si) return { error: 'Step not found.' }

  const fi = Array.isArray(si.flow_instances) ? si.flow_instances[0] : si.flow_instances
  const fv = fi ? (Array.isArray(fi.flow_versions) ? fi.flow_versions[0] : fi.flow_versions) : null
  const fl = fv ? (Array.isArray(fv.flows) ? fv.flows[0] : fv.flows) : null

  if (!fl || fl.tenant_id !== tenantId) return { error: 'Not found.' }
  if (si.status !== 'pending') return { error: 'This step is already completed.' }
  // FIXED: only the assigned user (or an admin) may submit a step.
  // Removed fi?.triggered_by bypass — the flow triggerer must NOT be
  // able to submit steps assigned to other people.
  if (role !== 'admin' && si.assigned_to !== userId) {
    return { error: 'Access denied.' }
  }

  const { error: completeError } = await db
    .from('step_instances')
    .update({
      form_data: formData,
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('id', stepInstanceId)

  if (completeError) return { error: completeError.message }

  // ── NEW: log step_submitted event
  const graph = fv?.graph as SerializedGraph | undefined
  const stepNode = graph?.nodes.find((n) => n.id === si.step_id)
  const stepLabel = (stepNode?.data?.label as string | undefined) ?? 'Step'
  const actorName = await resolveUserName(db, userId)

  await writeEventLog(db, {
    instanceId: fi?.id ?? si.instance_id,
    stepInstanceId,
    tenantId,
    actorId: userId,
    eventType: 'step_submitted',
    description: `${actorName} submitted "${stepLabel}".`,
    // ── NEW: store submitted form data in metadata for audit trail
    metadata: { stepId: si.step_id, formData },
  })

  if (fi?.id && fv?.graph) {
    await advanceFlow(
      fi.id,
      si.step_id,
      fv.graph as SerializedGraph,
      fi.triggered_by ?? userId,
      tenantId,
      formData,
      db,
      // ── NEW: pass actor info through to advanceFlow for logging
      userId,
      actorName
    )
  }

  return { error: null }
}

// ─── advanceFlow ─────────────────────────────────────────────────────────────
// Reads outbound edges from the completed step, evaluates branch conditions
// when the node is type=branch, picks the correct edge, creates the next
// step_instance, resolves the assignee, and updates current_step_id.
//
// ── CHANGED: Branch evaluation is now strict.
//   - A branch node MUST have its 'yes' OR 'no' conditions satisfied.
//   - If neither handle's conditions match, the flow is marked 'error' and
//     a flow_error event is written. The flow does NOT blindly advance.
//   - A handle with zero conditions is treated as a no-op (never matches),
//     NOT as a fallback. If you want a default path, add at least one condition
//     that will always be true, or use the "empty = fallback" option documented
//     in the BranchConfigPanel tip (only applies when the OTHER handle has
//     conditions and they fail — see logic below).
//
// ── CHANGED: added actorId + actorName params for event logging

async function advanceFlow(
  instanceId: string,
  completedStepNodeId: string,
  graph: SerializedGraph,
  triggeredByUserId: string,
  tenantId: string,
  submittedFormData: Record<string, unknown>,
  db: ReturnType<typeof createAdminClient>,
  // ── NEW params (actorName is not used in this function, only actorId)
  actorId: string,
  _actorName: string
): Promise<void> {
  // 1. Find the completed node
  const completedNode = graph.nodes.find((n) => n.id === completedStepNodeId)

  // 2. Collect all outbound edges from the completed step
  const outboundEdges = graph.edges.filter((e) => e.source === completedStepNodeId)

  if (outboundEdges.length === 0) {
    // No outbound edges — treat as flow complete
    await db
      .from('flow_instances')
      .update({ status: 'completed', updated_at: new Date().toISOString() })
      .eq('id', instanceId)

    await writeEventLog(db, {
      instanceId,
      tenantId,
      actorId: null,
      eventType: 'flow_completed',
      description: 'Flow completed (no further steps).',
    })

    void createNotification({
      tenantId,
      userId: triggeredByUserId,
      type: 'flow_completed',
      title: 'Flow completed',
      body: 'A flow you started has completed successfully.',
      link: `/my-flows/${instanceId}`,
    })
    return
  }

  // 3. Pick the correct outbound edge
  let chosenEdge = outboundEdges[0]
  let branchPath: string | null = null // 'yes' | 'no' — for logging

  if (completedNode?.type === 'branch' && outboundEdges.length > 1) {
    const branchConditions = (completedNode.data?.branchConditions ?? []) as BranchCondition[]

    const yesEdge = outboundEdges.find((e) => e.sourceHandle === 'yes')
    const noEdge = outboundEdges.find((e) => e.sourceHandle === 'no')

    // ── Fetch all completed step instances for this flow instance ─────────
    // Needed so conditions can reference fields from any previous step,
    // not just the step that was just submitted.
    // Build a map: stepNodeId → form_data
    const { data: allStepInstances } = await db
      .from('step_instances')
      .select('step_id, form_data, status')
      .eq('instance_id', instanceId)
      .eq('status', 'completed')

    const stepFormDataByNodeId = new Map<string, Record<string, unknown>>()
    for (const si of allStepInstances ?? []) {
      stepFormDataByNodeId.set(si.step_id, (si.form_data ?? {}) as Record<string, unknown>)
    }
    // Also include the just-submitted step's data (it may not be 'completed' yet
    // if advanceFlow is called before the status update — safe to always include)
    stepFormDataByNodeId.set(completedStepNodeId, submittedFormData)

    // ── Evaluate handle conditions ─────────────────────────────────────────
    // A handle matches when it has at least one condition AND all conditions pass.
    // Each condition specifies:
    //   - nodeId: which step's form_data to look in (undefined = preceding step)
    //   - fieldId: the field key within that form_data
    //   - value: the expected string value
    const handleMatches = (handleId: 'yes' | 'no'): boolean => {
      const conds = branchConditions.filter((c) => c.handleId === handleId)
      if (conds.length === 0) return false // zero conditions = no match
      return conds.every((cond) => {
        // Look up form_data: use nodeId if set, otherwise fall back to the
        // just-submitted step (backwards-compat with pre-enhancement conditions)
        const sourceData = cond.nodeId
          ? (stepFormDataByNodeId.get(cond.nodeId) ?? submittedFormData)
          : submittedFormData
        const rawValue = sourceData[cond.fieldId]
        const fieldValue = Array.isArray(rawValue)
          ? rawValue.map(String).join(',') // checkbox multi-value: join for eq check
          : String(rawValue ?? '')
        if (cond.operator === 'eq') return fieldValue === cond.value
        return false
      })
    }

    const yesMatches = yesEdge ? handleMatches('yes') : false
    const noMatches = noEdge ? handleMatches('no') : false

    // ── CHANGED: strict fallback logic
    // Priority: yes → no. If neither matches AND neither has zero conditions
    // (meaning both were intentionally configured but neither passed), mark error.
    // If one side has zero conditions and the other side does NOT match, the
    // zero-condition side acts as the "default / else" path.
    const yesCondCount = branchConditions.filter((c) => c.handleId === 'yes').length
    const noCondCount = branchConditions.filter((c) => c.handleId === 'no').length

    if (yesMatches) {
      chosenEdge = yesEdge!
      branchPath = 'yes'
    } else if (noMatches) {
      chosenEdge = noEdge!
      branchPath = 'no'
    } else if (yesCondCount === 0 && noEdge) {
      // 'yes' path has no conditions → 'no' side is the evaluated side;
      // since it didn't match, use 'yes' (empty) as default/else
      chosenEdge = yesEdge ?? noEdge
      branchPath = 'yes (default)'
    } else if (noCondCount === 0 && yesEdge) {
      // 'no' path has no conditions → it's the default/else
      chosenEdge = noEdge ?? yesEdge
      branchPath = 'no (default)'
    } else {
      // ── CHANGED: neither matched and no default configured → error state
      const stepLabel = (completedNode.data?.label as string | undefined) ?? 'Branch'
      const errorMsg = `Branch "${stepLabel}" could not be evaluated: no condition matched. Check your branch conditions and the field IDs match the previous step's form fields.`

      await db
        .from('flow_instances')
        .update({ status: 'error', updated_at: new Date().toISOString() })
        .eq('id', instanceId)

      await writeEventLog(db, {
        instanceId,
        tenantId,
        actorId: null,
        eventType: 'flow_error',
        description: errorMsg,
        metadata: {
          branchNodeId: completedStepNodeId,
          submittedFormData,
          conditions: branchConditions,
        },
      })
      return
    }

    // ── NEW: log branch_evaluated event
    const stepLabel = (completedNode.data?.label as string | undefined) ?? 'Branch'
    await writeEventLog(db, {
      instanceId,
      tenantId,
      actorId: actorId,
      eventType: 'branch_evaluated',
      description: `Branch "${stepLabel}" took the "${branchPath}" path.`,
      metadata: {
        branchNodeId: completedStepNodeId,
        path: branchPath,
        conditions: branchConditions,
      },
    })
  }

  // 4. Find the next node
  const nextNode = graph.nodes.find((n) => n.id === chosenEdge.target)

  if (!nextNode || nextNode.type === 'complete') {
    await db
      .from('flow_instances')
      .update({ status: 'completed', updated_at: new Date().toISOString() })
      .eq('id', instanceId)

    await writeEventLog(db, {
      instanceId,
      tenantId,
      actorId: null,
      eventType: 'flow_completed',
      description: 'Flow completed successfully.',
    })

    void createNotification({
      tenantId,
      userId: triggeredByUserId,
      type: 'flow_completed',
      title: 'Flow completed',
      body: 'A flow you started has completed successfully.',
      link: `/my-flows/${instanceId}`,
    })
    return
  }

  // 5. Resolve assignee for the next step
  const assigneeRule = (nextNode.data?.assigneeRule ?? null) as { type?: string } | null
  let assignedTo: string | null = null
  let assigneeError: string | null = null

  if (assigneeRule?.type) {
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

      const res = await fetch(`${supabaseUrl}/functions/v1/resolve-assignee`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({
          rule: toEdgeFunctionRule(assigneeRule),
          triggered_by_user_id: triggeredByUserId,
          tenant_id: tenantId,
        }),
      })

      if (res.ok) {
        const result = (await res.json()) as {
          assigned_to_user_id: string | null
          error: string | null
        }
        if (result.assigned_to_user_id) assignedTo = result.assigned_to_user_id
        else if (result.error) assigneeError = result.error
      }
    } catch {
      // Non-fatal
    }
  }

  // 6. Create the next step_instance
  const { data: nextStep, error: stepError } = await db
    .from('step_instances')
    .insert({
      instance_id: instanceId,
      step_id: nextNode.id,
      assigned_to: assignedTo,
      form_data: {},
      status: 'pending',
      due_at: computeDueAt(nextNode.data?.slaHours as number | undefined),
    })
    .select('id')
    .single()

  if (stepError || !nextStep) return

  // 7. Update flow_instance.current_step_id
  await db
    .from('flow_instances')
    .update({
      current_step_id: nextStep.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', instanceId)

  const nextStepLabel = (nextNode.data?.label as string | undefined) ?? 'Step'
  const assigneeName = assignedTo ? await resolveUserName(db, assignedTo) : 'Unassigned'
  const assignDescription = assigneeError
    ? `"${nextStepLabel}" could not be assigned: ${assigneeError}`
    : `"${nextStepLabel}" assigned to ${assigneeName}.`
  await writeEventLog(db, {
    instanceId,
    stepInstanceId: nextStep.id,
    tenantId,
    actorId: null,
    eventType: assigneeError ? 'flow_error' : 'step_assigned',
    description: assignDescription,
    metadata: { stepId: nextNode.id, assignedTo, assigneeRule, assigneeError },
  })

  if (assignedTo) {
    void createNotification({
      tenantId,
      userId: assignedTo,
      type: 'step_assigned',
      title: `New task: ${nextStepLabel}`,
      body: `You've been assigned a step. Open My Tasks to complete it.`,
      link: '/tasks',
    })
  }
}

// ── NEW: getFlowTimeline ──────────────────────────────────────────────────────
// Returns all event logs for a flow instance, sorted oldest→newest.
// Access: flow triggerer, any assigned user on the instance, or tenant admin.

export async function getFlowTimeline(instanceId: string): Promise<{
  events: FlowEventLog[]
  error: string | null
}> {
  const gate = await requireAuthWithTenant()
  if (!gate.ok) return { events: [], error: gate.error }

  const { userId, tenantId, role, db } = gate

  // Access check: verify the instance belongs to this tenant and the user has access
  const { data: instance, error: instanceError } = await db
    .from('flow_instances')
    .select('id, triggered_by, tenant_id:flow_versions!flow_version_id(flows!flow_id(tenant_id))')
    .eq('id', instanceId)
    .maybeSingle()

  if (instanceError || !instance) return { events: [], error: 'Instance not found.' }

  // Tenant isolation check
  const fvRaw = (instance as Record<string, unknown>).flow_versions
  const fv = Array.isArray(fvRaw) ? fvRaw[0] : fvRaw
  const flRaw = fv ? (fv as Record<string, unknown>).flows : null
  const fl = Array.isArray(flRaw) ? flRaw[0] : flRaw
  const instanceTenantId = (fl as Record<string, unknown> | null)?.tenant_id as string | undefined

  if (instanceTenantId && instanceTenantId !== tenantId) {
    return { events: [], error: 'Access denied.' }
  }

  // Non-admins must be the triggerer or assigned to at least one step
  if (role !== 'admin') {
    const isTriggerer = (instance as Record<string, unknown>).triggered_by === userId

    let isAssigned = false
    if (!isTriggerer) {
      const { count } = await db
        .from('step_instances')
        .select('id', { count: 'exact', head: true })
        .eq('instance_id', instanceId)
        .eq('assigned_to', userId)
      isAssigned = (count ?? 0) > 0
    }

    if (!isTriggerer && !isAssigned) {
      return { events: [], error: 'Access denied.' }
    }
  }

  // Fetch the event logs + actor name via join
  const { data, error } = await db
    .from('flow_event_logs')
    .select(
      `
      id,
      instance_id,
      step_instance_id,
      tenant_id,
      actor_id,
      event_type,
      description,
      metadata,
      created_at,
      users!actor_id (
        full_name,
        email
      )
    `
    )
    .eq('instance_id', instanceId)
    .order('created_at', { ascending: true })

  if (error) return { events: [], error: error.message }

  const events: FlowEventLog[] = (data ?? []).map((row) => {
    const actor = Array.isArray(row.users) ? row.users[0] : row.users
    const actorName =
      (actor as { full_name?: string | null; email?: string } | null)?.full_name ??
      (actor as { full_name?: string | null; email?: string } | null)?.email ??
      null

    return {
      id: row.id as string,
      instanceId: row.instance_id as string,
      stepInstanceId: (row.step_instance_id as string | null) ?? null,
      tenantId: row.tenant_id as string,
      actorId: (row.actor_id as string | null) ?? null,
      actorName,
      eventType: row.event_type as FlowEventLog['eventType'],
      description: row.description as string,
      metadata: (row.metadata as Record<string, unknown>) ?? {},
      createdAt: row.created_at as string,
    }
  })

  return { events, error: null }
}

// ─── updateFlowName ──────────────────────────────────────────────────────────

export async function updateFlowName(
  flowId: string,
  name: string
): Promise<{ error: string | null }> {
  const gate = await requireAdminWithTenant()
  if (!gate.ok) return { error: gate.error }

  const { tenantId, db } = gate
  const access = await assertFlowInTenant(db, flowId, tenantId)
  if (!access.ok) return { error: access.error }

  const trimmed = name.trim()
  if (!trimmed) return { error: 'Flow name cannot be empty.' }

  const { error } = await db
    .from('flows')
    .update({
      name: trimmed,
      updated_at: new Date().toISOString(),
    })
    .eq('id', flowId)
    .eq('tenant_id', tenantId)

  return { error: error?.message ?? null }
}

// ─── Task type ────────────────────────────────────────────────────────────────

export type TaskListItem = {
  stepInstanceId: string
  stepId: string // graph node id — used for storage path
  instanceId: string
  tenantId: string // needed for storage path construction
  assignedTo: string | null
  createdAt: string
  dueAt: string | null
  stepLabel: string
  flowName: string
  formSchema: FormField[]
  triggeredByName: string | null
  flowInstanceStatus: 'pending' | 'completed' | 'cancelled' | 'error'
}

// ─── getMyTasks ───────────────────────────────────────────────────────────────

export async function getMyTasks(): Promise<{
  tasks: TaskListItem[]
  error: string | null
}> {
  const gate = await requireAuthWithTenant()
  if (!gate.ok) return { tasks: [], error: gate.error }

  const { userId, tenantId, db } = gate

  const { data, error } = await db
    .from('step_instances')
    .select(
      `
      id,
      step_id,
      instance_id,
      assigned_to,
      created_at,
      due_at,
      flow_instances!instance_id (
        id,
        status,
        triggered_by,
        flow_versions!flow_version_id (
          graph,
          flows!flow_id (
            name,
            tenant_id
          )
        ),
        users!triggered_by (
          full_name,
          email
        )
      )
    `
    )
    .eq('assigned_to', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (error) return { tasks: [], error: error.message }

  const tasks: TaskListItem[] = []

  for (const row of data ?? []) {
    const fi = Array.isArray(row.flow_instances) ? row.flow_instances[0] : row.flow_instances
    if (!fi) continue

    const fv = Array.isArray(fi.flow_versions) ? fi.flow_versions[0] : fi.flow_versions
    if (!fv) continue

    const fl = Array.isArray(fv.flows) ? fv.flows[0] : fv.flows
    if (!fl) continue

    if (fl.tenant_id !== tenantId) continue

    const graph = fv.graph as SerializedGraph
    const stepNode = graph.nodes.find((n) => n.id === row.step_id)
    const stepLabel = stepNode?.data?.label ?? 'Step'
    const formSchema = (stepNode?.data?.formSchema ?? []) as FormField[]

    const triggererRaw = Array.isArray(fi.users) ? fi.users[0] : fi.users
    const triggeredByName =
      (triggererRaw as { full_name?: string | null; email?: string } | null)?.full_name ??
      (triggererRaw as { full_name?: string | null; email?: string } | null)?.email ??
      null

    tasks.push({
      stepInstanceId: row.id,
      stepId: row.step_id,
      instanceId: row.instance_id,
      tenantId,
      assignedTo: row.assigned_to,
      createdAt: row.created_at,
      dueAt: (row as unknown as { due_at: string | null }).due_at ?? null,
      stepLabel,
      flowName: fl.name ?? 'Unknown flow',
      formSchema,
      triggeredByName,
      flowInstanceStatus: fi.status as 'pending' | 'completed' | 'cancelled' | 'error',
    })
  }

  return { tasks, error: null }
}

// ─── Category actions ─────────────────────────────────────────────────────────

export async function getFlowCategories(): Promise<{
  categories: { id: string; name: string; color: string }[]
  error: string | null
}> {
  const gate = await requireAuthWithTenant()
  if (!gate.ok) return { categories: [], error: gate.error }

  const { tenantId, db } = gate

  const { data, error } = await db
    .from('flow_categories')
    .select('id, name, color')
    .eq('tenant_id', tenantId)
    .order('name')

  if (error) return { categories: [], error: error.message }
  return { categories: data ?? [], error: null }
}

export async function createFlowCategory(
  name: string,
  color: string
): Promise<{ error: string | null }> {
  const gate = await requireAdminWithTenant()
  if (!gate.ok) return { error: gate.error }

  const { tenantId, db } = gate
  const trimmed = name.trim()
  if (!trimmed) return { error: 'Category name cannot be empty.' }

  const { error } = await db
    .from('flow_categories')
    .insert({ tenant_id: tenantId, name: trimmed, color })

  return { error: error?.message ?? null }
}

export async function renameFlowCategory(
  id: string,
  name: string
): Promise<{ error: string | null }> {
  const gate = await requireAdminWithTenant()
  if (!gate.ok) return { error: gate.error }

  const { tenantId, db } = gate
  const trimmed = name.trim()
  if (!trimmed) return { error: 'Category name cannot be empty.' }

  const { error } = await db
    .from('flow_categories')
    .update({ name: trimmed })
    .eq('id', id)
    .eq('tenant_id', tenantId)

  return { error: error?.message ?? null }
}

export async function deleteFlowCategory(id: string): Promise<{ error: string | null }> {
  const gate = await requireAdminWithTenant()
  if (!gate.ok) return { error: gate.error }

  const { tenantId, db } = gate

  const { error } = await db.from('flow_categories').delete().eq('id', id).eq('tenant_id', tenantId)

  return { error: error?.message ?? null }
}

export async function assignFlowCategory(
  flowId: string,
  categoryId: string | null
): Promise<{ error: string | null }> {
  const gate = await requireAdminWithTenant()
  if (!gate.ok) return { error: gate.error }

  const { tenantId, db } = gate
  const access = await assertFlowInTenant(db, flowId, tenantId)
  if (!access.ok) return { error: access.error }

  const { error } = await db
    .from('flows')
    .update({ category_id: categoryId, updated_at: new Date().toISOString() })
    .eq('id', flowId)
    .eq('tenant_id', tenantId)

  return { error: error?.message ?? null }
}
// ── NEW: getTaskContext ────────────────────────────────────────────────────────
// Returns everything the assignee needs to understand the full picture before
// completing their step:
//   - The activity log (timeline) for the instance
//   - Each previous completed step's label + submitted form values with field labels
//   - The flow name and who triggered it
//
// Single server call — avoids multiple client-side round trips.
// Add this function at the END of src/lib/flows/actions.ts

export type PreviousStepData = {
  stepId: string
  stepLabel: string
  assigneeName: string | null
  completedAt: string | null
  fields: { fieldId: string; fieldLabel: string; fieldType: string; value: string }[]
}

export type TaskContext = {
  flowName: string
  triggeredByName: string | null
  timeline: FlowEventLog[]
  previousSteps: PreviousStepData[]
}

export async function getTaskContext(
  stepInstanceId: string
): Promise<{ context: TaskContext | null; error: string | null }> {
  const gate = await requireAuthWithTenant()
  if (!gate.ok) return { context: null, error: gate.error }

  const { userId, tenantId, role, db } = gate

  // 1. Load the step instance + its parent flow instance + graph
  const { data: si, error: siError } = await db
    .from('step_instances')
    .select(
      `
      id,
      step_id,
      assigned_to,
      instance_id,
      flow_instances!instance_id (
        id,
        triggered_by,
        flow_versions!flow_version_id (
          graph,
          flows!flow_id ( name, tenant_id )
        ),
        users!triggered_by (
          full_name,
          email
        )
      )
    `
    )
    .eq('id', stepInstanceId)
    .maybeSingle()

  if (siError || !si) return { context: null, error: 'Step not found.' }

  const fi = Array.isArray(si.flow_instances) ? si.flow_instances[0] : si.flow_instances
  if (!fi) return { context: null, error: 'Flow instance not found.' }

  const fv = Array.isArray(fi.flow_versions) ? fi.flow_versions[0] : fi.flow_versions
  if (!fv) return { context: null, error: 'Flow version not found.' }

  const fl = Array.isArray(fv.flows) ? fv.flows[0] : fv.flows
  if (!fl) return { context: null, error: 'Flow not found.' }

  // Tenant isolation
  if ((fl as Record<string, unknown>).tenant_id !== tenantId) {
    return { context: null, error: 'Access denied.' }
  }

  // Access check: must be assignee or admin
  if (role !== 'admin' && si.assigned_to !== userId) {
    return { context: null, error: 'Access denied.' }
  }

  const instanceId = fi.id as string
  const graph = fv.graph as SerializedGraph

  // Resolve triggerer name
  const triggererRaw = Array.isArray(fi.users) ? fi.users[0] : fi.users
  const triggeredByName =
    (triggererRaw as { full_name?: string | null; email?: string } | null)?.full_name ??
    (triggererRaw as { full_name?: string | null; email?: string } | null)?.email ??
    null

  // 2. Load all completed step instances for this flow instance (oldest first)
  const { data: completedSteps, error: stepsError } = await db
    .from('step_instances')
    .select('id, step_id, assigned_to, form_data, completed_at, status')
    .eq('instance_id', instanceId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: true })

  if (stepsError) return { context: null, error: stepsError.message }

  // 3. Resolve assignee names for completed steps
  const assigneeIds = (completedSteps ?? [])
    .map((s: { assigned_to: string | null }) => s.assigned_to)
    .filter(Boolean) as string[]

  let assigneeMap: Record<string, string> = {}
  if (assigneeIds.length > 0) {
    const { data: assignees } = await db
      .from('users')
      .select('id, full_name, email')
      .in('id', assigneeIds)
    assigneeMap = Object.fromEntries(
      (assignees ?? []).map((u: { id: string; full_name: string | null; email: string }) => [
        u.id,
        u.full_name ?? u.email,
      ])
    )
  }

  // 4. Build previousSteps: match each completed step_instance to its graph node
  //    so we can show field labels (not just raw field IDs)
  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]))

  const previousSteps: PreviousStepData[] = (completedSteps ?? []).map(
    (s: {
      id: string
      step_id: string
      assigned_to: string | null
      form_data: Record<string, unknown>
      completed_at: string | null
      status: string
    }) => {
      const node = nodeMap.get(s.step_id)
      const stepLabel = (node?.data?.label as string | undefined) ?? 'Step'
      const formSchema = (node?.data?.formSchema ?? []) as FormField[]
      const formData = (s.form_data ?? {}) as Record<string, unknown>

      // Map each form field to its label + submitted value
      const fields = formSchema
        .map((field) => {
          const raw = formData[field.id]
          let value = ''
          if (field.type === 'file') {
            // Serialize file paths as JSON so the client can parse them back
            // and render FileDownloadLink for each path
            value = Array.isArray(raw) && raw.length > 0 ? JSON.stringify(raw) : '(empty)'
          } else if (Array.isArray(raw)) {
            value = raw.length > 0 ? raw.join(', ') : '(none selected)'
          } else if (raw === null || raw === undefined || raw === '') {
            value = '(empty)'
          } else {
            value = String(raw)
          }
          return {
            fieldId: field.id,
            fieldLabel: field.label || field.id,
            fieldType: field.type,
            value,
          }
        })
        // Also surface keys in form_data that aren't in the schema (edge cases)
        .concat(
          Object.entries(formData)
            .filter(([key]) => !formSchema.find((f) => f.id === key))
            .map(([key, val]) => ({
              fieldId: key,
              fieldLabel: key,
              fieldType: 'text',
              value: String(val ?? ''),
            }))
        )

      return {
        stepId: s.step_id,
        stepLabel,
        assigneeName: s.assigned_to ? (assigneeMap[s.assigned_to] ?? null) : null,
        completedAt: s.completed_at,
        fields,
      }
    }
  )

  // 5. Fetch the full timeline (reuse existing getFlowTimeline logic inline
  //    to avoid a second auth check — we already verified access above)
  const { data: logRows, error: logError } = await db
    .from('flow_event_logs')
    .select(
      `
      id,
      instance_id,
      step_instance_id,
      tenant_id,
      actor_id,
      event_type,
      description,
      metadata,
      created_at,
      users!actor_id (
        full_name,
        email
      )
    `
    )
    .eq('instance_id', instanceId)
    .order('created_at', { ascending: true })

  if (logError) return { context: null, error: logError.message }

  const timeline: FlowEventLog[] = (logRows ?? []).map((row) => {
    const actor = Array.isArray(row.users) ? row.users[0] : row.users
    const actorName =
      (actor as { full_name?: string | null; email?: string } | null)?.full_name ??
      (actor as { full_name?: string | null; email?: string } | null)?.email ??
      null
    return {
      id: row.id as string,
      instanceId: row.instance_id as string,
      stepInstanceId: (row.step_instance_id as string | null) ?? null,
      tenantId: row.tenant_id as string,
      actorId: (row.actor_id as string | null) ?? null,
      actorName,
      eventType: row.event_type as FlowEventLog['eventType'],
      description: row.description as string,
      metadata: (row.metadata as Record<string, unknown>) ?? {},
      createdAt: row.created_at as string,
    }
  })

  const flowName = (fl as Record<string, unknown>).name as string

  return {
    context: {
      flowName,
      triggeredByName,
      timeline,
      previousSteps,
    },
    error: null,
  }
} // ── NEW: CompletedTaskListItem type ──────────────────────────────────────────
// Append this entire block at the END of src/lib/flows/actions.ts

export type CompletedTaskListItem = {
  stepInstanceId: string
  stepId: string
  instanceId: string
  completedAt: string | null
  stepLabel: string
  flowName: string
  flowInstanceStatus: 'pending' | 'completed' | 'cancelled' | 'error'
  triggeredByName: string | null
  // Submitted field values — file fields have value = JSON.stringify(string[])
  submittedFields: { fieldLabel: string; fieldType: string; value: string }[]
}

// ── NEW: getMyCompletedTasks ─────────────────────────────────────────────────
// Returns all step_instances the current user was assigned to AND completed,
// ordered by most recently completed first.
// Access: any authenticated user (scoped to their own completed steps).

export async function getMyCompletedTasks(): Promise<{
  tasks: CompletedTaskListItem[]
  error: string | null
}> {
  const gate = await requireAuthWithTenant()
  if (!gate.ok) return { tasks: [], error: gate.error }

  const { userId, tenantId, db } = gate

  const { data, error } = await db
    .from('step_instances')
    .select(
      `
      id,
      step_id,
      instance_id,
      assigned_to,
      form_data,
      completed_at,
      flow_instances!instance_id (
        id,
        status,
        triggered_by,
        flow_versions!flow_version_id (
          graph,
          flows!flow_id (
            name,
            tenant_id
          )
        ),
        users!triggered_by (
          full_name,
          email
        )
      )
    `
    )
    .eq('assigned_to', userId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(50) // last 50 completed tasks is enough for the history view

  if (error) return { tasks: [], error: error.message }

  const tasks: CompletedTaskListItem[] = []

  for (const row of data ?? []) {
    const fi = Array.isArray(row.flow_instances) ? row.flow_instances[0] : row.flow_instances
    if (!fi) continue

    const fv = Array.isArray(fi.flow_versions) ? fi.flow_versions[0] : fi.flow_versions
    if (!fv) continue

    const fl = Array.isArray(fv.flows) ? fv.flows[0] : fv.flows
    if (!fl) continue

    // Tenant isolation
    if ((fl as Record<string, unknown>).tenant_id !== tenantId) continue

    const graph = fv.graph as SerializedGraph
    const stepNode = graph.nodes.find((n) => n.id === row.step_id)
    const stepLabel = (stepNode?.data?.label as string | undefined) ?? 'Step'
    const formSchema = (stepNode?.data?.formSchema ?? []) as FormField[]
    const formData = (row.form_data ?? {}) as Record<string, unknown>

    // Build a concise submitted-fields summary (skip empty values)
    const submittedFields = formSchema
      .map((field) => {
        const raw = formData[field.id]
        let value = ''
        if (field.type === 'file') {
          // Serialize file paths as JSON so the client can render download links
          value = Array.isArray(raw) && raw.length > 0 ? JSON.stringify(raw) : ''
        } else if (Array.isArray(raw)) {
          value = raw.length > 0 ? raw.join(', ') : ''
        } else {
          value = String(raw ?? '').trim()
        }
        return { fieldLabel: field.label || field.id, fieldType: field.type, value }
      })
      .filter((f) => f.value !== '')

    const triggererRaw = Array.isArray(fi.users) ? fi.users[0] : fi.users
    const triggeredByName =
      (triggererRaw as { full_name?: string | null; email?: string } | null)?.full_name ??
      (triggererRaw as { full_name?: string | null; email?: string } | null)?.email ??
      null

    tasks.push({
      stepInstanceId: row.id,
      stepId: row.step_id,
      instanceId: row.instance_id,
      completedAt: row.completed_at,
      stepLabel,
      flowName: (fl as Record<string, unknown>).name as string,
      flowInstanceStatus: fi.status as CompletedTaskListItem['flowInstanceStatus'],
      triggeredByName,
      submittedFields,
    })
  }

  return { tasks, error: null }
}

// ─── cancelInstance ──────────────────────────────────────────────────────────
// Admin OR the flow triggerer (requester) can cancel a pending flow.
// Sets the flow instance to 'cancelled', marks all pending step_instances
// as 'skipped', and writes a flow_cancelled event log.

export async function cancelInstance(
  instanceId: string,
  reason?: string
): Promise<{ error: string | null }> {
  const gate = await requireAuthWithTenant()
  if (!gate.ok) return { error: gate.error }

  const { userId, tenantId, role, db } = gate

  // Fetch the instance to check ownership + status
  const { data: instance, error: instanceError } = await db
    .from('flow_instances')
    .select(
      `
      id,
      status,
      triggered_by,
      flow_versions!flow_version_id (
        flows!flow_id ( name, tenant_id )
      )
    `
    )
    .eq('id', instanceId)
    .maybeSingle()

  if (instanceError || !instance) return { error: 'Instance not found.' }

  // Tenant isolation
  const fv = Array.isArray(instance.flow_versions)
    ? instance.flow_versions[0]
    : instance.flow_versions
  const fl = fv
    ? Array.isArray((fv as Record<string, unknown>).flows)
      ? ((fv as Record<string, unknown>).flows as Record<string, unknown>[])[0]
      : (fv as Record<string, unknown>).flows
    : null

  if (!fl || (fl as Record<string, unknown>).tenant_id !== tenantId) {
    return { error: 'Instance not found.' }
  }

  // Permission: admin can cancel any flow; regular user can only cancel their own
  const isAdmin = role === 'admin'
  const isTriggerer = instance.triggered_by === userId
  if (!isAdmin && !isTriggerer) {
    return { error: 'You can only cancel flows you started.' }
  }

  if (instance.status !== 'pending') {
    return { error: `Cannot cancel: flow is already ${instance.status}.` }
  }

  // Mark all pending step_instances as skipped
  await db
    .from('step_instances')
    .update({ status: 'skipped' })
    .eq('instance_id', instanceId)
    .eq('status', 'pending')

  // Mark the flow instance as cancelled
  const { error: cancelError } = await db
    .from('flow_instances')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', instanceId)

  if (cancelError) return { error: cancelError.message }

  // Write event log — note who cancelled + reason if provided
  const cancelledBy = isAdmin && !isTriggerer ? 'an administrator' : 'the requester'
  const reasonSuffix = reason?.trim() ? ` Reason: ${reason.trim()}` : ''
  await writeEventLog(db, {
    instanceId,
    tenantId,
    actorId: userId,
    eventType: 'flow_cancelled',
    description: `Flow was cancelled by ${cancelledBy}.${reasonSuffix}`,
    metadata: reason?.trim() ? { reason: reason.trim() } : undefined,
  })

  return { error: null }
}

// ─── reassignStep ─────────────────────────────────────────────────────────────
// Admin only. Updates the assigned_to on a pending step_instance, writes a
// step_assigned event log, and sends an assignment email to the new assignee.

export async function reassignStep(
  stepInstanceId: string,
  newAssigneeId: string
): Promise<{ error: string | null }> {
  const gate = await requireAdminWithTenant()
  if (!gate.ok) return { error: gate.error }

  const { userId, tenantId, db } = gate

  // Fetch step + flow info
  const { data: si, error: siError } = await db
    .from('step_instances')
    .select(
      `
      id,
      step_id,
      status,
      instance_id,
      flow_instances!instance_id (
        id,
        triggered_by,
        flow_versions!flow_version_id (
          graph,
          flows!flow_id ( name, tenant_id )
        )
      )
    `
    )
    .eq('id', stepInstanceId)
    .maybeSingle()

  if (siError || !si) return { error: 'Step not found.' }

  const fi = Array.isArray(si.flow_instances) ? si.flow_instances[0] : si.flow_instances
  const fv = fi
    ? Array.isArray((fi as Record<string, unknown>).flow_versions)
      ? ((fi as Record<string, unknown>).flow_versions as Record<string, unknown>[])[0]
      : (fi as Record<string, unknown>).flow_versions
    : null
  const fl = fv
    ? Array.isArray((fv as Record<string, unknown>).flows)
      ? ((fv as Record<string, unknown>).flows as Record<string, unknown>[])[0]
      : (fv as Record<string, unknown>).flows
    : null

  if (!fl || (fl as Record<string, unknown>).tenant_id !== tenantId) {
    return { error: 'Step not found.' }
  }

  if (si.status !== 'pending') {
    return { error: 'Can only reassign pending steps.' }
  }

  // Verify new assignee belongs to this tenant
  const { data: newAssignee } = await db
    .from('users')
    .select('id, full_name, email')
    .eq('id', newAssigneeId)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (!newAssignee) return { error: 'User not found in this tenant.' }

  // Update the step
  const { error: updateError } = await db
    .from('step_instances')
    .update({ assigned_to: newAssigneeId })
    .eq('id', stepInstanceId)

  if (updateError) return { error: updateError.message }

  // Resolve step label from graph for the event log + email
  const graph = (fv as Record<string, unknown>)?.graph as SerializedGraph | undefined
  const stepNode = graph?.nodes.find((n) => n.id === si.step_id)
  const stepLabel = (stepNode?.data?.label as string | undefined) ?? 'Step'
  const flowName = ((fl as Record<string, unknown>).name as string) ?? 'Flow'
  const assigneeName = newAssignee.full_name ?? newAssignee.email

  // Write step_assigned event log
  await writeEventLog(db, {
    instanceId: si.instance_id,
    stepInstanceId,
    tenantId,
    actorId: null,
    eventType: 'step_assigned',
    description: `"${stepLabel}" reassigned to ${assigneeName} by an administrator.`,
    metadata: { stepId: si.step_id, assignedTo: newAssigneeId },
  })

  // Write administrative audit-trail entry
  await logAuditEvent(db, {
    tenantId,
    actorId: userId,
    action: 'step_reassigned',
    targetType: 'step_instance',
    targetId: stepInstanceId,
    targetLabel: `${flowName} — ${stepLabel}`,
    description: `Reassigned "${stepLabel}" in "${flowName}" to ${assigneeName}`,
    metadata: { stepId: si.step_id, instanceId: si.instance_id, assignedTo: newAssigneeId },
  })

  // Send assignment email to the new assignee (fire-and-forget)
  const triggeredByUserId = (fi as Record<string, unknown>)?.triggered_by as string | undefined
  const triggererName = triggeredByUserId ? await resolveUserName(db, triggeredByUserId) : 'Someone'

  void sendAssignmentEmail({
    tenantId,
    instanceId: si.instance_id,
    stepInstanceId,
    recipientEmail: newAssignee.email,
    recipientName: assigneeName,
    flowName,
    stepName: stepLabel,
    triggeredByName: triggererName,
  })

  return { error: null }
}

// ─── getTenantUsers ───────────────────────────────────────────────────────────
// Returns all users in the current tenant — used by the reassign dialog
// to populate the user picker. Admin only.

export async function getTenantUsers(): Promise<{
  users: { id: string; full_name: string | null; email: string; role: string }[]
  error: string | null
}> {
  const gate = await requireAdminWithTenant()
  if (!gate.ok) return { users: [], error: gate.error }

  const { tenantId, db } = gate

  const { data, error } = await db
    .from('users')
    .select('id, full_name, email, role')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('full_name', { ascending: true })

  if (error) return { users: [], error: error.message }

  return { users: data ?? [], error: null }
}

// ─── bulkReassignTasks ────────────────────────────────────────────────────────
// Admin only. Moves all pending step_instances from one user to another in a
// single UPDATE. Sends one notification to the new assignee and one audit entry.

export async function bulkReassignTasks(
  fromUserId: string,
  toUserId: string
): Promise<{ count: number; error: string | null }> {
  const gate = await requireAdminWithTenant()
  if (!gate.ok) return { count: 0, error: gate.error }

  const { tenantId, db, userId: actorId } = gate

  if (fromUserId === toUserId) return { count: 0, error: 'Source and target user must differ' }

  // Verify target user is active and in this tenant
  const { data: toUser } = await db
    .from('users')
    .select('id, full_name, email, is_active')
    .eq('id', toUserId)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (!toUser) return { count: 0, error: 'Target user not found' }
  if (!toUser.is_active) return { count: 0, error: 'Cannot reassign to an inactive user' }

  // Fetch the from-user's name for the audit description
  const { data: fromUser } = await db
    .from('users')
    .select('full_name, email')
    .eq('id', fromUserId)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  // Bulk UPDATE — single query, no row-level audit per step (one audit entry covers all)
  const { data: updated, error: updateError } = await db
    .from('step_instances')
    .update({ assigned_to: toUserId })
    .eq('assigned_to', fromUserId)
    .eq('status', 'pending')
    .select('id')

  if (updateError) return { count: 0, error: updateError.message }

  const count = updated?.length ?? 0

  if (count > 0) {
    const fromName = fromUser?.full_name ?? fromUser?.email ?? 'another user'
    const toName = toUser.full_name ?? toUser.email

    void createNotification({
      tenantId,
      userId: toUserId,
      type: 'step_assigned',
      title: `${count} task${count !== 1 ? 's' : ''} reassigned to you`,
      body: `An admin reassigned ${count} pending task${count !== 1 ? 's' : ''} from ${fromName} to you.`,
      link: '/tasks',
    })

    await logAuditEvent(db, {
      tenantId,
      actorId,
      action: 'tasks_bulk_reassigned',
      targetType: 'user',
      targetId: fromUserId,
      targetLabel: fromName,
      description: `Bulk reassigned ${count} pending task${count !== 1 ? 's' : ''} from ${fromName} to ${toName}`,
      metadata: { fromUserId, toUserId, count },
    })
  }

  revalidatePath('/users')
  revalidatePath('/tasks')
  revalidatePath('/dashboard')

  return { count, error: null }
}

// ─── getSignedUrl ─────────────────────────────────────────────────────────────
// On-demand signed URL for a file in the step-attachments bucket.
// Called by FileDownloadLink on click — generates a fresh 60-second URL each time.
// The user must have access to the flow instance that owns the file.
// We verify this by checking that the storage path starts with the user's tenantId.
// (Path format: {tenantId}/{instanceId}/{stepNodeId}/{fieldId}/{timestamp}_{filename})

export async function getSignedUrl(
  storagePath: string
): Promise<{ url: string | null; error: string | null }> {
  const gate = await requireAuthWithTenant()
  if (!gate.ok) return { url: null, error: gate.error }

  const { tenantId, db } = gate

  // Tenant isolation: path must start with the caller's tenantId
  if (!storagePath.startsWith(tenantId + '/')) {
    return { url: null, error: 'Access denied.' }
  }

  const { data, error } = await db.storage.from('step-attachments').createSignedUrl(storagePath, 60) // 60-second expiry — long enough to redirect

  if (error || !data?.signedUrl) {
    return { url: null, error: error?.message ?? 'Could not generate download URL.' }
  }

  return { url: data.signedUrl, error: null }
}

// ─── getInstanceDetailForPanel ────────────────────────────────────────────────
// Server action used by the Tasks page slide-in panel.
// Returns everything the InstanceDetailClient needs in a single call:
// instance detail, ordered node IDs (graph walk), and the activity timeline.
// Access rules mirror my-flows/[id]/page.tsx:
//   - Tenant admin           → always allowed
//   - Flow triggerer         → always allowed
//   - Step assignee          → allowed
//   - Anyone else            → returns error

import { walkGraphOrder } from '@/lib/flows/graph-utils'

export type StepInstanceRow = {
  id: string
  step_id: string
  assigned_to: string | null
  form_data: Record<string, unknown>
  status: 'pending' | 'completed' | 'skipped'
  completed_at: string | null
  created_at: string
  due_at: string | null
  assignee_name: string | null
}

export type InstanceDetail = {
  id: string
  status: 'pending' | 'completed' | 'cancelled' | 'error'
  triggered_by: string
  triggered_by_name: string | null
  current_step_id: string | null
  created_at: string
  updated_at: string
  flow_name: string
  flow_description: string | null
  graph: SerializedGraph
  steps: StepInstanceRow[]
  viewer_is_assignee: boolean
  isAdmin: boolean
}

export type InstanceDetailForPanel = {
  detail: InstanceDetail
  orderedNodeIds: string[]
  timeline: FlowEventLog[]
}

export async function getInstanceDetailForPanel(instanceId: string): Promise<{
  data: InstanceDetailForPanel | null
  error: string | null
}> {
  const gate = await requireAuthWithTenant()
  if (!gate.ok) return { data: null, error: gate.error }

  const { userId, tenantId, role, db } = gate
  const isAdmin = role === 'admin'

  // ── 1. Fetch the flow instance + version + flow meta ──────────────────────
  const { data: instance, error: instanceError } = await db
    .from('flow_instances')
    .select(
      `
      id,
      status,
      triggered_by,
      current_step_id,
      created_at,
      updated_at,
      flow_versions!flow_version_id (
        graph,
        flows!flow_id ( name, description, tenant_id )
      )
    `
    )
    .eq('id', instanceId)
    .maybeSingle()

  if (instanceError || !instance) return { data: null, error: 'Instance not found.' }

  const version = Array.isArray(instance.flow_versions)
    ? instance.flow_versions[0]
    : instance.flow_versions
  if (!version) return { data: null, error: 'Flow version not found.' }

  const flow = Array.isArray((version as Record<string, unknown>).flows)
    ? ((version as Record<string, unknown>).flows as Record<string, unknown>[])[0]
    : (version as Record<string, unknown>).flows
  if (!flow) return { data: null, error: 'Flow not found.' }

  // Tenant isolation — always enforced
  if ((flow as Record<string, unknown>).tenant_id !== tenantId) {
    return { data: null, error: 'Access denied.' }
  }

  const isTriggerer = instance.triggered_by === userId

  // ── 2. Access check for non-admins ────────────────────────────────────────
  let isAssignee = false
  if (!isAdmin && !isTriggerer) {
    const { count } = await db
      .from('step_instances')
      .select('id', { count: 'exact', head: true })
      .eq('instance_id', instanceId)
      .eq('assigned_to', userId)

    isAssignee = (count ?? 0) > 0
    if (!isAssignee) return { data: null, error: 'Access denied.' }
  }

  const graph = (version as Record<string, unknown>).graph as SerializedGraph

  // ── 3. Fetch all step instances ───────────────────────────────────────────
  const { data: stepRows } = await db
    .from('step_instances')
    .select('id, step_id, assigned_to, form_data, status, completed_at, created_at, due_at')
    .eq('instance_id', instanceId)
    .order('created_at', { ascending: true })

  // ── 4. Resolve assignee display names ─────────────────────────────────────
  const assigneeIds = (stepRows ?? [])
    .map((s: { assigned_to: string | null }) => s.assigned_to)
    .filter(Boolean) as string[]

  let assigneeMap: Record<string, string> = {}
  if (assigneeIds.length > 0) {
    const { data: assignees } = await db.from('users').select('id, full_name').in('id', assigneeIds)
    assigneeMap = Object.fromEntries(
      (assignees ?? []).map((u: { id: string; full_name: string | null }) => [
        u.id,
        u.full_name ?? 'Unknown',
      ])
    )
  }

  // ── 5. Resolve triggerer name ──────────────────────────────────────────────
  const { data: triggerer } = await db
    .from('users')
    .select('full_name')
    .eq('id', instance.triggered_by)
    .maybeSingle()

  const steps: StepInstanceRow[] = (stepRows ?? []).map(
    (s: {
      id: string
      step_id: string
      assigned_to: string | null
      form_data: Record<string, unknown>
      status: string
      completed_at: string | null
      created_at: string
      due_at: string | null
    }) => ({
      ...s,
      status: s.status as StepInstanceRow['status'],
      due_at: s.due_at ?? null,
      assignee_name: s.assigned_to ? (assigneeMap[s.assigned_to] ?? null) : null,
    })
  )

  // ── 6. Walk graph to get ordered node IDs (excluding trigger + complete) ──
  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]))
  const orderedNodeIds = walkGraphOrder(graph).filter((id) => {
    const node = nodeMap.get(id)
    return node && node.type !== 'trigger' && node.type !== 'complete'
  })

  // ── 7. Fetch activity timeline ─────────────────────────────────────────────
  const { data: logRows, error: logError } = await db
    .from('flow_event_logs')
    .select(
      `
      id,
      instance_id,
      step_instance_id,
      tenant_id,
      actor_id,
      event_type,
      description,
      metadata,
      created_at,
      users!actor_id (
        full_name,
        email
      )
    `
    )
    .eq('instance_id', instanceId)
    .order('created_at', { ascending: true })

  if (logError) return { data: null, error: logError.message }

  const timeline: FlowEventLog[] = (logRows ?? []).map((row) => {
    const actor = Array.isArray(row.users) ? row.users[0] : row.users
    const actorName =
      (actor as { full_name?: string | null; email?: string } | null)?.full_name ??
      (actor as { full_name?: string | null; email?: string } | null)?.email ??
      null
    return {
      id: row.id as string,
      instanceId: row.instance_id as string,
      stepInstanceId: (row.step_instance_id as string | null) ?? null,
      tenantId: row.tenant_id as string,
      actorId: (row.actor_id as string | null) ?? null,
      actorName,
      eventType: row.event_type as FlowEventLog['eventType'],
      description: row.description as string,
      metadata: (row.metadata as Record<string, unknown>) ?? {},
      createdAt: row.created_at as string,
    }
  })

  const detail: InstanceDetail = {
    id: instance.id as string,
    status: instance.status as InstanceDetail['status'],
    triggered_by: instance.triggered_by as string,
    triggered_by_name: triggerer?.full_name ?? null,
    current_step_id: (instance.current_step_id as string | null) ?? null,
    created_at: instance.created_at as string,
    updated_at: instance.updated_at as string,
    flow_name: (flow as Record<string, unknown>).name as string,
    flow_description: ((flow as Record<string, unknown>).description as string | null) ?? null,
    graph,
    steps,
    viewer_is_assignee: isAssignee && !isTriggerer,
    isAdmin,
  }

  return { data: { detail, orderedNodeIds, timeline }, error: null }
}
