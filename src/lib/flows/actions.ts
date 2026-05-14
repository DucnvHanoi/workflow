'use server'

// FILE PATH: src/lib/flows/actions.ts
// All flow server actions live here — stable path, safe to import from client components.
// See project_info.txt: SERVER ACTIONS LOCATION RULE

import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionClaims } from '@/lib/supabase/auth-helpers'
import type { SerializedGraph } from '@/lib/flows/graph'
import type { FormField, BranchCondition } from '@/store/canvas-store'

export type FlowListItem = {
  id: string
  name: string
  status: 'draft' | 'published'
  // ADDED: description field (nullable — not all flows have one)
  description: string | null
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
  description?: string | null
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
  // ADDED
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
        // ADDED
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
// ADDED: allows admins to set a short description on a flow (max 100 words).
// Called from flows-client.tsx inline edit UI.

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

  // Word count check — split on whitespace, ignore empty tokens
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
// ADDED (Day 33): creates a flow_instance + first step_instance for a published flow.
// Returns the new instance ID so the client can redirect to /my-flows/[id].

export async function triggerFlow(
  flowId: string
): Promise<{ instanceId: string | null; error: string | null }> {
  const gate = await requireAuthWithTenant()
  if (!gate.ok) return { instanceId: null, error: gate.error }

  const { userId, tenantId, db } = gate

  // 1. Verify flow is published and belongs to tenant
  const { data: flow, error: flowError } = await db
    .from('flows')
    .select('id, status, latest_version_id')
    .eq('id', flowId)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (flowError || !flow) return { instanceId: null, error: 'Flow not found.' }
  if (flow.status !== 'published') return { instanceId: null, error: 'Flow is not published.' }
  if (!flow.latest_version_id) return { instanceId: null, error: 'Flow has no published version.' }

  // 2. Fetch the graph from the latest version
  const { data: version, error: versionError } = await db
    .from('flow_versions')
    .select('id, graph')
    .eq('id', flow.latest_version_id)
    .single()

  if (versionError || !version) return { instanceId: null, error: 'Could not load flow version.' }

  const graph = version.graph as SerializedGraph

  // 3. Find the trigger node
  const triggerNode = graph.nodes.find((n) => n.type === 'trigger')
  if (!triggerNode) return { instanceId: null, error: 'Flow has no trigger node.' }

  // 4. Create the flow_instance
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

  // 5. Find the first action node (outbound from trigger)
  const firstEdge = graph.edges.find((e) => e.source === triggerNode.id)
  const firstNode = firstEdge ? graph.nodes.find((n) => n.id === firstEdge.target) : null

  if (!firstNode || firstNode.type === 'complete') {
    // Trivial flow — mark complete immediately
    await db
      .from('flow_instances')
      .update({ status: 'completed', updated_at: new Date().toISOString() })
      .eq('id', instance.id)
    return { instanceId: instance.id, error: null }
  }

  // 6. Resolve assignee for the first step
  const assigneeRule = (firstNode.data?.assigneeRule ?? null) as { type?: string } | null
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
      }
    } catch {
      // Non-fatal — step created unassigned; admin can reassign later
    }
  }

  // 7. Create the first step_instance
  const { data: stepInstance, error: stepError } = await db
    .from('step_instances')
    .insert({
      instance_id: instance.id,
      step_id: firstNode.id,
      assigned_to: assignedTo,
      form_data: {},
      status: 'pending',
    })
    .select('id')
    .single()

  if (stepError || !stepInstance) {
    return { instanceId: instance.id, error: stepError?.message ?? 'Could not create step.' }
  }

  // 8. Update flow_instance.current_step_id
  await db
    .from('flow_instances')
    .update({
      current_step_id: stepInstance.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', instance.id)

  return { instanceId: instance.id, error: null }
}

// ─── getMyInstances ──────────────────────────────────────────────────────────
// Returns all flow instances triggered by the current user, sorted by most recent.

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
        flows!flow_id ( name )
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

      // Verify tenant isolation via the nested flow
      const flowTenantId = (fl as Record<string, unknown> | null)?.tenant_id
      if (flowTenantId && flowTenantId !== tenantId) return null

      return {
        id: row.id as string,
        flowName: ((fl as Record<string, unknown> | null)?.name as string) ?? 'Unknown flow',
        status: row.status as 'pending' | 'completed' | 'cancelled',
        currentStepId: (row.current_step_id as string | null) ?? null,
        createdAt: row.created_at as string,
        updatedAt: row.updated_at as string,
        currentStepName: null, // resolved client-side from graph when needed
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
// Fetches a single step_instance for display/submission in StepFormModal.
// Access: assigned user, flow triggerer, or tenant admin.

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
      formData,
      db
    )
  }

  return { error: null }
}

// ─── advanceFlow ─────────────────────────────────────────────────────────────
// Reads outbound edges from the completed step node, evaluates branch conditions
// when the node is a branch type, picks the correct edge, creates the next
// step_instance, resolves the assignee, and updates current_step_id.
// If the next node is type=complete (or no outbound edge exists), the flow
// instance is marked completed.
//
// Branch evaluation (AND logic per handle):
//   - Collects BranchConditions for each handle ('yes' | 'no').
//   - A handle matches when ALL its conditions pass against submittedFormData.
//   - Tries 'yes' first; falls back to 'no'; then falls back to first edge.
//   - Operator 'eq': strict string equality after coercing field value to string.

async function advanceFlow(
  instanceId: string,
  completedStepNodeId: string,
  graph: SerializedGraph,
  triggeredByUserId: string,
  tenantId: string,
  submittedFormData: Record<string, unknown>,
  db: ReturnType<typeof createAdminClient>
): Promise<void> {
  // 1. Find the completed node (needed for branch type check)
  const completedNode = graph.nodes.find((n) => n.id === completedStepNodeId)

  // 2. Collect all outbound edges from completed step
  const outboundEdges = graph.edges.filter((e) => e.source === completedStepNodeId)

  if (outboundEdges.length === 0) {
    await db
      .from('flow_instances')
      .update({ status: 'completed', updated_at: new Date().toISOString() })
      .eq('id', instanceId)
    return
  }

  // 3. Pick the correct outbound edge
  let chosenEdge = outboundEdges[0]

  if (completedNode?.type === 'branch' && outboundEdges.length > 1) {
    const branchConditions = (completedNode.data?.branchConditions ?? []) as BranchCondition[]

    const handleMatches = (handleId: 'yes' | 'no'): boolean => {
      const conds = branchConditions.filter((c) => c.handleId === handleId)
      if (conds.length === 0) return false
      return conds.every((cond) => {
        const fieldValue = String(submittedFormData[cond.fieldId] ?? '')
        if (cond.operator === 'eq') return fieldValue === cond.value
        return false
      })
    }

    const yesEdge = outboundEdges.find((e) => e.sourceHandle === 'yes')
    const noEdge = outboundEdges.find((e) => e.sourceHandle === 'no')

    if (yesEdge && handleMatches('yes')) {
      chosenEdge = yesEdge
    } else if (noEdge && handleMatches('no')) {
      chosenEdge = noEdge
    } else {
      // Misconfigured conditions — safe fallback: yes → no → first
      chosenEdge = yesEdge ?? noEdge ?? outboundEdges[0]
    }
  }

  // 4. Find the next node
  const nextNode = graph.nodes.find((n) => n.id === chosenEdge.target)

  if (!nextNode || nextNode.type === 'complete') {
    await db
      .from('flow_instances')
      .update({ status: 'completed', updated_at: new Date().toISOString() })
      .eq('id', instanceId)
    return
  }

  // 5. Resolve assignee for the next step
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

  // 6. Create the next step_instance
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

  // 7. Update flow_instance.current_step_id
  await db
    .from('flow_instances')
    .update({
      current_step_id: nextStep.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', instanceId)
}

// ─── updateFlowName ──────────────────────────────────────────────────────────
// Allows admins to rename a flow from the canvas editor (FlowNameEditor.tsx).

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
  stepId: string
  instanceId: string
  assignedTo: string | null
  createdAt: string
  stepLabel: string
  flowName: string
  formSchema: FormField[]
  triggeredByName: string | null
  flowInstanceStatus: 'pending' | 'completed' | 'cancelled'
}

// ─── getMyTasks ───────────────────────────────────────────────────────────────
// Returns all pending step_instances assigned to the current user.
// Resolves step label + formSchema from graph JSONB server-side so the client
// can open StepFormModal directly without an extra round-trip.

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
      assignedTo: row.assigned_to,
      createdAt: row.created_at,
      stepLabel,
      flowName: fl.name ?? 'Unknown flow',
      formSchema,
      triggeredByName,
      flowInstanceStatus: fi.status as 'pending' | 'completed' | 'cancelled',
    })
  }

  return { tasks, error: null }
}
