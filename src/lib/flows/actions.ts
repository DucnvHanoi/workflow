'use server'

// FILE PATH: src/lib/flows/actions.ts
// All flow server actions live here — stable path, safe to import from client components.
// See project_info.txt: SERVER ACTIONS LOCATION RULE

import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionClaims } from '@/lib/supabase/auth-helpers'
import type { SerializedGraph } from '@/lib/flows/graph'

export type FlowListItem = {
  id: string
  name: string
  status: 'draft' | 'published'
  createdAt: string
  updatedAt: string
  versionNumber: number | null
  publishedAt: string | null
  // ── Category (nullable — null means Uncategorized) ──────────────────────────
  categoryId: string | null
  categoryName: string | null
  categoryColor: string | null
}

// ─── Runtime instance types (Phase 3) ────────────────────────────────────────

export type FlowInstanceListItem = {
  id: string
  flowName: string
  status: 'pending' | 'completed' | 'cancelled'
  currentStepId: string | null
  createdAt: string
  updatedAt: string
  // Denormalized from graph for display
  currentStepName: string | null
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

async function requireAdminWithTenant(): Promise<
  { ok: true; tenantId: string; db: AdminDb } | { ok: false; error: string }
> {
  const { user, claims } = await getSessionClaims()
  if (!user) return { ok: false, error: 'Unauthenticated' }
  if (claims.role !== 'admin') return { ok: false, error: 'Unauthorized' }
  if (!claims.tenant_id) return { ok: false, error: 'Tenant not found' }
  return { ok: true, tenantId: claims.tenant_id, db: createAdminClient() }
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

  // Get current max version_number for this flow
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

  // Update flows.latest_version_id and updated_at
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

  // PGRST116 = no rows — expected for a brand-new flow
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

  const { tenantId, db } = gate
  const access = await assertFlowInTenant(db, flowId, tenantId)
  if (!access.ok) return { error: access.error }

  const { data: flow, error: flowError } = await db
    .from('flows')
    .select('latest_version_id')
    .eq('id', flowId)
    .eq('tenant_id', tenantId)
    .single()

  if (flowError || !flow?.latest_version_id) {
    return { error: 'Could not find a saved version to publish.' }
  }

  const { error: verError } = await db
    .from('flow_versions')
    .update({ published_at: new Date().toISOString() })
    .eq('id', flow.latest_version_id)
    .eq('flow_id', flowId)

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

  return { error: null }
}

// ─── Unpublish a flow ─────────────────────────────────────────────────────────

export async function unpublishFlow(flowId: string): Promise<{ error: string | null }> {
  const gate = await requireAdminWithTenant()
  if (!gate.ok) return { error: gate.error }

  const { tenantId, db } = gate
  const access = await assertFlowInTenant(db, flowId, tenantId)
  if (!access.ok) return { error: access.error }

  const { error } = await db
    .from('flows')
    .update({
      status: 'draft',
      updated_at: new Date().toISOString(),
    })
    .eq('id', flowId)
    .eq('tenant_id', tenantId)

  return { error: error?.message ?? null }
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
// CHANGED (Day 33): works for ALL authenticated users, not just admins.
// Admins see all flows (draft + published).
// Regular users only see published flows (so they can trigger them).
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

  // Regular users only see published flows
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

  if (versionIds.length > 0) {
    const { data: instances } = await db
      .from('flow_instances')
      .select('id')
      .in('flow_version_id', versionIds)

    const instanceIds = (instances ?? []).map((i: { id: string }) => i.id)

    if (instanceIds.length > 0) {
      await db.from('step_instances').delete().in('instance_id', instanceIds)
      await db.from('flow_instances').delete().in('id', instanceIds)
    }

    await db.from('flow_versions').delete().in('id', versionIds)
  }

  await db
    .from('flows')
    .update({ latest_version_id: null })
    .eq('id', flowId)
    .eq('tenant_id', tenantId)

  const { error } = await db.from('flows').delete().eq('id', flowId).eq('tenant_id', tenantId)
  if (error) return { error: error.message }

  return { error: null }
}

// ─── updateFlowName ───────────────────────────────────────────────────────────

export async function updateFlowName(
  flowId: string,
  newName: string
): Promise<{ error: string | null }> {
  const { user, claims } = await getSessionClaims()
  if (!user) return { error: 'Unauthenticated' }
  if (claims.role !== 'admin') return { error: 'Unauthorized' }
  if (!claims.tenant_id) return { error: 'Tenant not found' }

  const trimmed = newName.trim()
  if (!trimmed) return { error: 'Flow name cannot be empty' }
  if (trimmed.length > 100) return { error: 'Flow name must be 100 characters or fewer' }

  const admin = createAdminClient()

  const { data: existing, error: fetchError } = await admin
    .from('flows')
    .select('id')
    .eq('id', flowId)
    .eq('tenant_id', claims.tenant_id)
    .single()

  if (fetchError || !existing) return { error: 'Flow not found' }

  const { error } = await admin
    .from('flows')
    .update({ name: trimmed, updated_at: new Date().toISOString() })
    .eq('id', flowId)

  if (error) return { error: error.message }

  return { error: null }
}

// ─── triggerFlow ──────────────────────────────────────────────────────────────
// Phase 3 Week 12 — triggers a published flow for the current user.
//
// Steps:
//   1. Verify flow is published + belongs to tenant
//   2. Load the graph from latest_version_id
//   3. Find the trigger node, then resolve the first step node (outbound edge from trigger)
//   4. Create flow_instance row (status=pending, triggered_by=current user)
//   5. Call resolveAssignee() Edge Function server-side for the first step
//   6. Create step_instance row for the first step (status=pending)
//   7. Update flow_instance.current_step_id to the new step_instance id
//
// Returns the new flow_instance id so the client can redirect to /my-flows/[id].

export async function triggerFlow(flowId: string): Promise<{
  instanceId: string | null
  error: string | null
}> {
  const gate = await requireAuthWithTenant()
  if (!gate.ok) return { instanceId: null, error: gate.error }

  const { userId, tenantId, db } = gate

  // ── 1. Verify the flow is published and belongs to the tenant ──────────────
  const { data: flow, error: flowError } = await db
    .from('flows')
    .select('id, status, latest_version_id, name')
    .eq('id', flowId)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (flowError) return { instanceId: null, error: flowError.message }
  if (!flow) return { instanceId: null, error: 'Flow not found.' }
  if (flow.status !== 'published') return { instanceId: null, error: 'Flow is not published.' }
  if (!flow.latest_version_id) return { instanceId: null, error: 'Flow has no published version.' }

  // ── 2. Load the graph ──────────────────────────────────────────────────────
  const { data: versionRow, error: verError } = await db
    .from('flow_versions')
    .select('id, graph')
    .eq('id', flow.latest_version_id)
    .single()

  if (verError || !versionRow) {
    return { instanceId: null, error: 'Could not load flow version.' }
  }

  const graph = versionRow.graph as SerializedGraph

  // ── 3. Find the trigger node → first step node ────────────────────────────
  const triggerNode = graph.nodes.find((n) => n.type === 'trigger')
  if (!triggerNode) return { instanceId: null, error: 'Flow has no trigger node.' }

  // The first step is the node the trigger's outbound edge points to
  const triggerEdge = graph.edges.find((e) => e.source === triggerNode.id)
  if (!triggerEdge) return { instanceId: null, error: 'Trigger node has no outbound connection.' }

  const firstStepNode = graph.nodes.find((n) => n.id === triggerEdge.target)
  if (!firstStepNode) return { instanceId: null, error: 'First step node not found in graph.' }

  // ── 4. Create flow_instance ────────────────────────────────────────────────
  const { data: instance, error: instanceError } = await db
    .from('flow_instances')
    .insert({
      flow_version_id: versionRow.id,
      triggered_by: userId,
      current_step_id: null, // updated after step_instance is created (step 7)
      status: 'pending',
    })
    .select('id')
    .single()

  if (instanceError || !instance) {
    return { instanceId: null, error: instanceError?.message ?? 'Failed to create instance.' }
  }

  // ── 5. Call resolveAssignee() Edge Function server-side ───────────────────
  // The assignee rule lives in the first step node's data.
  const assigneeRule = firstStepNode.data?.assigneeRule ?? null

  let assignedTo: string | null = null

  if (assigneeRule && (assigneeRule as { type?: string }).type) {
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

      const res = await fetch(`${supabaseUrl}/functions/v1/resolve-assignee`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Service role key — this runs server-side only, never exposed to the client
          Authorization: `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({
          rule: assigneeRule,
          triggered_by_user_id: userId,
          tenant_id: tenantId,
        }),
      })

      if (res.ok) {
        const result = (await res.json()) as {
          assigned_to_user_id: string | null
          error: string | null
        }
        if (result.assigned_to_user_id) {
          assignedTo = result.assigned_to_user_id
        }
        // If Edge Function returns an error we proceed with assignedTo=null
        // rather than blocking the whole trigger. Admin can reassign later (Phase 3 Week 18).
      }
    } catch {
      // Network / parse error — non-fatal, proceed with unassigned step
    }
  }

  // ── 6. Create step_instance for the first step ────────────────────────────
  const { data: stepInstance, error: stepError } = await db
    .from('step_instances')
    .insert({
      instance_id: instance.id,
      step_id: firstStepNode.id, // node id from the graph (not a DB id)
      assigned_to: assignedTo,
      form_data: {},
      status: 'pending',
    })
    .select('id')
    .single()

  if (stepError || !stepInstance) {
    // Roll back the flow_instance to avoid orphans
    await db.from('flow_instances').delete().eq('id', instance.id)
    return { instanceId: null, error: stepError?.message ?? 'Failed to create step.' }
  }

  // ── 7. Update flow_instance.current_step_id ────────────────────────────────
  const { error: updateError } = await db
    .from('flow_instances')
    .update({ current_step_id: stepInstance.id })
    .eq('id', instance.id)

  if (updateError) {
    // Non-fatal — instance exists, current_step_id just isn't set yet
    console.error('triggerFlow: failed to set current_step_id', updateError.message)
  }

  return { instanceId: instance.id, error: null }
}

// ─── getMyInstances ───────────────────────────────────────────────────────────
// Phase 3 Week 16 — returns all flow instances triggered by the current user.
// currentStepName is resolved by looking up the step_id in the graph.

export async function getMyInstances(): Promise<{
  instances: FlowInstanceListItem[]
  error: string | null
}> {
  const gate = await requireAuthWithTenant()
  if (!gate.ok) return { instances: [], error: gate.error }

  const { userId, db } = gate

  // Step 1: fetch instances triggered by this user only
  const { data: instanceRows, error: instanceError } = await db
    .from('flow_instances')
    .select('id, status, current_step_id, created_at, updated_at, flow_version_id')
    .eq('triggered_by', userId)
    .order('updated_at', { ascending: false })

  if (instanceError) return { instances: [], error: instanceError.message }
  if (!instanceRows || instanceRows.length === 0) return { instances: [], error: null }

  // Step 2: fetch flow names via version ids (separate query — avoids PostgREST join issues)
  const versionIds = instanceRows.map((r: { flow_version_id: string }) => r.flow_version_id)

  const { data: versionRows, error: versionError } = await db
    .from('flow_versions')
    .select('id, flow_id')
    .in('id', versionIds)

  if (versionError) return { instances: [], error: versionError.message }

  const flowIds = (versionRows ?? []).map((v: { flow_id: string }) => v.flow_id)

  const { data: flowRows, error: flowError } = await db
    .from('flows')
    .select('id, name')
    .in('id', flowIds)

  if (flowError) return { instances: [], error: flowError.message }

  // Build lookup maps
  const flowNameMap = new Map<string, string>(
    (flowRows ?? []).map((f: { id: string; name: string }) => [f.id, f.name])
  )
  const versionToFlowMap = new Map<string, string>(
    (versionRows ?? []).map((v: { id: string; flow_id: string }) => [v.id, v.flow_id])
  )

  const instances: FlowInstanceListItem[] = instanceRows.map(
    (row: {
      id: string
      status: string
      current_step_id: string | null
      created_at: string
      updated_at: string
      flow_version_id: string
    }) => {
      const flowId = versionToFlowMap.get(row.flow_version_id) ?? null
      const flowName = flowId ? (flowNameMap.get(flowId) ?? 'Unknown Flow') : 'Unknown Flow'

      return {
        id: row.id,
        flowName,
        status: row.status as FlowInstanceListItem['status'],
        currentStepId: row.current_step_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        currentStepName: null,
      }
    }
  )

  return { instances, error: null }
}
// ─────────────────────────────────────────────────────────────────────────────
// PASTE THESE FUNCTIONS AT THE BOTTOM OF: src/lib/flows/actions.ts
// No new imports needed — SerializedGraph and createAdminClient are already
// imported at the top of that file.
// ─────────────────────────────────────────────────────────────────────────────

// ─── getStepInstance ─────────────────────────────────────────────────────────
// Returns a single step_instance row so the modal can pre-populate saved draft
// data. Accessible by the assignee, the flow triggerer, or any tenant admin.

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

  // Unwrap PostgREST nested FK rows
  const fi = Array.isArray(data.flow_instances) ? data.flow_instances[0] : data.flow_instances
  const fv = fi ? (Array.isArray(fi.flow_versions) ? fi.flow_versions[0] : fi.flow_versions) : null
  const fl = fv ? (Array.isArray(fv.flows) ? fv.flows[0] : fv.flows) : null

  // Tenant isolation
  if (!fl || fl.tenant_id !== tenantId) return { stepInstance: null, error: 'Not found.' }

  // Access control: assignee, flow triggerer, or admin
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
// Persists form_data without changing step status (used by "Save Draft" button).

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

  if (siError || !si) return { error: 'Step not found.' }

  const fi = Array.isArray(si.flow_instances) ? si.flow_instances[0] : si.flow_instances
  const fv = fi ? (Array.isArray(fi.flow_versions) ? fi.flow_versions[0] : fi.flow_versions) : null
  const fl = fv ? (Array.isArray(fv.flows) ? fv.flows[0] : fv.flows) : null

  if (!fl || fl.tenant_id !== tenantId) return { error: 'Not found.' }
  if (si.status !== 'pending') return { error: 'This step is already completed.' }
  if (role !== 'admin' && si.assigned_to !== userId && fi?.triggered_by !== userId) {
    return { error: 'Access denied.' }
  }

  const { error: updateError } = await db
    .from('step_instances')
    .update({ form_data: formData })
    .eq('id', stepInstanceId)

  return { error: updateError?.message ?? null }
}

// ─── submitStep ───────────────────────────────────────────────────────────────
// Marks the step completed, saves final form_data, and advances the flow to the
// next step. advanceFlow handles the stub logic (full branch eval in Week 14).

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
  if (role !== 'admin' && si.assigned_to !== userId && fi?.triggered_by !== userId) {
    return { error: 'Access denied.' }
  }

  // Mark step as completed
  const { error: completeError } = await db
    .from('step_instances')
    .update({
      form_data: formData,
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('id', stepInstanceId)

  if (completeError) return { error: completeError.message }

  // Advance the flow to the next step
  if (fi?.id && fv?.graph) {
    await advanceFlow(
      fi.id,
      si.step_id,
      fv.graph as SerializedGraph,
      fi.triggered_by ?? userId,
      tenantId,
      db
    )
  }

  return { error: null }
}

// ─── advanceFlow (stub — full implementation in Phase 3 Week 14) ──────────────
// Finds the next node via outbound edge from the completed step.
// No branch evaluation yet — takes the first outbound edge.
// If next node is type=complete (or missing), marks the flow_instance as completed.

async function advanceFlow(
  instanceId: string,
  completedStepNodeId: string,
  graph: SerializedGraph,
  triggeredByUserId: string,
  tenantId: string,
  db: ReturnType<typeof createAdminClient>
): Promise<void> {
  // Take first outbound edge (branch eval added in Week 14)
  const outboundEdge = graph.edges.find((e) => e.source === completedStepNodeId)

  if (!outboundEdge) {
    await db
      .from('flow_instances')
      .update({ status: 'completed', updated_at: new Date().toISOString() })
      .eq('id', instanceId)
    return
  }

  const nextNode = graph.nodes.find((n) => n.id === outboundEdge.target)

  if (!nextNode || nextNode.type === 'complete') {
    await db
      .from('flow_instances')
      .update({ status: 'completed', updated_at: new Date().toISOString() })
      .eq('id', instanceId)
    return
  }

  // Resolve assignee for the next step
  const assigneeRule = (nextNode.data?.assigneeRule ?? null) as { type?: string } | null
  let assignedTo: string | null = null

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
          rule: assigneeRule,
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
      }
    } catch {
      // Non-fatal — step is created unassigned; admin can reassign later
    }
  }

  // Create the next step_instance
  const { data: nextStep, error: stepError } = await db
    .from('step_instances')
    .insert({
      instance_id: instanceId,
      step_id: nextNode.id,
      assigned_to: assignedTo,
      form_data: {},
      status: 'pending',
    })
    .select('id')
    .single()

  if (stepError || !nextStep) return // non-fatal

  // Update flow_instance.current_step_id to the new step
  await db
    .from('flow_instances')
    .update({
      current_step_id: nextStep.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', instanceId)
}
