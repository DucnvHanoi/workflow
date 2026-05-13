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

async function requireAdminWithTenant(): Promise<
  { ok: true; tenantId: string; db: AdminDb } | { ok: false; error: string }
> {
  const { user, claims } = await getSessionClaims()
  if (!user) return { ok: false, error: 'Unauthenticated' }
  if (claims.role !== 'admin') return { ok: false, error: 'Unauthorized' }
  if (!claims.tenant_id) return { ok: false, error: 'Tenant not found' }
  return { ok: true, tenantId: claims.tenant_id, db: createAdminClient() }
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

// ─── Save a draft version ─────────────────────────────────────────────────────

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
// Fetches all flows for the current tenant with version + category info.
// CHANGED: added category_id join and categoryId/categoryName/categoryColor fields.
export async function getFlows(): Promise<{
  flows: FlowListItem[]
  error: string | null
}> {
  const gate = await requireAdminWithTenant()
  if (!gate.ok) return { flows: [], error: gate.error }

  const { tenantId, db } = gate

  const { data, error } = await db
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
