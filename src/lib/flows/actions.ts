'use server'

// FILE PATH: src/lib/flows/actions.ts
// All flow server actions live here — stable path, safe to import from client components.
// See project_info.txt: SERVER ACTIONS LOCATION RULE

import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionClaims } from '@/lib/supabase/auth-helpers'
import type { SerializedGraph } from '@/lib/flows/graph'

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
// Stamps published_at on the latest version row and sets flows.status = published.
// Caller must validate the graph before calling this.

export async function publishFlow(flowId: string): Promise<{ error: string | null }> {
  const gate = await requireAdminWithTenant()
  if (!gate.ok) return { error: gate.error }

  const { tenantId, db } = gate
  const access = await assertFlowInTenant(db, flowId, tenantId)
  if (!access.ok) return { error: access.error }

  // Get the latest_version_id from the flows row
  const { data: flow, error: flowError } = await db
    .from('flows')
    .select('latest_version_id')
    .eq('id', flowId)
    .eq('tenant_id', tenantId)
    .single()

  if (flowError || !flow?.latest_version_id) {
    return { error: 'Could not find a saved version to publish.' }
  }

  // Stamp published_at on the version row
  const { error: verError } = await db
    .from('flow_versions')
    .update({ published_at: new Date().toISOString() })
    .eq('id', flow.latest_version_id)
    .eq('flow_id', flowId)

  if (verError) return { error: verError.message }

  // Mark the flow itself as published
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
// Sets flows.status back to draft.
// Running flow_instances are unaffected — they hold their own flow_version_id snapshot.

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
// Copies an old version's graph into a brand-new draft row (append-only).
// After this returns, the caller re-hydrates the canvas via getLatestDraftGraph.

export async function restoreVersion(
  flowId: string,
  versionId: string
): Promise<{ error: string | null }> {
  const gate = await requireAdminWithTenant()
  if (!gate.ok) return { error: gate.error }

  const { tenantId, db } = gate
  const access = await assertFlowInTenant(db, flowId, tenantId)
  if (!access.ok) return { error: access.error }

  // Fetch the graph from the target version (must belong to this flow)
  const { data: ver, error: verError } = await db
    .from('flow_versions')
    .select('graph, version_number')
    .eq('id', versionId)
    .eq('flow_id', flowId)
    .single()

  if (verError || !ver) return { error: 'Version not found.' }

  // Get the current highest version_number
  const { data: maxRow } = await db
    .from('flow_versions')
    .select('version_number')
    .eq('flow_id', flowId)
    .order('version_number', { ascending: false })
    .limit(1)
    .single()

  const nextVersion = (maxRow?.version_number ?? 0) + 1

  // Insert as a new draft row — append-only, nothing is deleted or overwritten
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

  // Update flows.latest_version_id so the next page load gets the restored graph
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
