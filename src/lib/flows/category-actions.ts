'use server'

// FILE PATH: src/lib/flows/category-actions.ts
// Separate file for category server actions to keep lib/flows/actions.ts focused
// on flow + version operations. page.tsx imports getCategories from here.

import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionClaims } from '@/lib/supabase/auth-helpers'

// ─── Shared type ─────────────────────────────────────────────────────────────

export interface FlowCategory {
  id: string
  name: string
  color: string
}

// ─── Internal helper ──────────────────────────────────────────────────────────
// Mirrors requireAdminWithTenant in actions.ts — duplicated to keep this file
// self-contained (no cross-'use server' imports allowed in Next.js 14).

async function requireAdmin() {
  const { user, claims } = await getSessionClaims()
  if (!user) return { ok: false as const, error: 'Unauthenticated' }
  if (claims.role !== 'admin') return { ok: false as const, error: 'Unauthorized' }
  if (!claims.tenant_id) return { ok: false as const, error: 'Tenant not found' }
  return { ok: true as const, tenantId: claims.tenant_id, db: createAdminClient() }
}

// ─── getCategories ────────────────────────────────────────────────────────────
// Used by /flows page.tsx (server component) — returns all categories for the
// current tenant sorted alphabetically.

export async function getCategories(): Promise<{
  categories: FlowCategory[]
  error: string | null
}> {
  // CHANGED (Day 33): all authenticated users need categories for display
  // on the /flows page. Mutations (create/rename/delete) remain admin-only.
  const { user, claims } = await getSessionClaims()
  if (!user) return { categories: [], error: null } // not logged in — return empty silently
  if (!claims.tenant_id) return { categories: [], error: null }

  const db = createAdminClient()

  const { data, error } = await db
    .from('flow_categories')
    .select('id, name, color')
    .eq('tenant_id', claims.tenant_id)
    .order('name', { ascending: true })

  if (error) return { categories: [], error: error.message }
  return { categories: (data as FlowCategory[]) ?? [], error: null }
}

// ─── createCategory ───────────────────────────────────────────────────────────

export async function createCategory(
  name: string,
  color = '#6b7280'
): Promise<{ category: FlowCategory | null; error: string | null }> {
  const gate = await requireAdmin()
  if (!gate.ok) return { category: null, error: gate.error }

  const trimmed = name.trim()
  if (!trimmed) return { category: null, error: 'Category name cannot be empty.' }
  if (trimmed.length > 80) return { category: null, error: 'Name must be 80 characters or fewer.' }

  const { tenantId, db } = gate

  const { data, error } = await db
    .from('flow_categories')
    .insert({ tenant_id: tenantId, name: trimmed, color })
    .select('id, name, color')
    .single()

  if (error || !data) return { category: null, error: error?.message ?? 'Insert failed.' }
  return { category: data as FlowCategory, error: null }
}

// ─── renameCategory ───────────────────────────────────────────────────────────

export async function renameCategory(
  categoryId: string,
  name: string
): Promise<{ error: string | null }> {
  const gate = await requireAdmin()
  if (!gate.ok) return { error: gate.error }

  const trimmed = name.trim()
  if (!trimmed) return { error: 'Category name cannot be empty.' }
  if (trimmed.length > 80) return { error: 'Name must be 80 characters or fewer.' }

  const { tenantId, db } = gate

  const { error } = await db
    .from('flow_categories')
    .update({ name: trimmed })
    .eq('id', categoryId)
    .eq('tenant_id', tenantId)

  return { error: error?.message ?? null }
}

// ─── updateCategory ───────────────────────────────────────────────────────────
// Name + colour (used by manage-categories dialog inline edit).

export async function updateCategory(
  categoryId: string,
  name: string,
  color: string
): Promise<{ error: string | null }> {
  const gate = await requireAdmin()
  if (!gate.ok) return { error: gate.error }

  const trimmed = name.trim()
  if (!trimmed) return { error: 'Category name cannot be empty.' }
  if (trimmed.length > 80) return { error: 'Name must be 80 characters or fewer.' }

  const { tenantId, db } = gate

  const { error } = await db
    .from('flow_categories')
    .update({ name: trimmed, color })
    .eq('id', categoryId)
    .eq('tenant_id', tenantId)

  return { error: error?.message ?? null }
}

// ─── deleteCategory ───────────────────────────────────────────────────────────
// ON DELETE SET NULL on flows.category_id handles orphaning automatically.
// No guard needed — flows just move to Uncategorised.

export async function deleteCategory(categoryId: string): Promise<{ error: string | null }> {
  const gate = await requireAdmin()
  if (!gate.ok) return { error: gate.error }

  const { tenantId, db } = gate

  const { error } = await db
    .from('flow_categories')
    .delete()
    .eq('id', categoryId)
    .eq('tenant_id', tenantId)

  return { error: error?.message ?? null }
}

// ─── updateFlowCategory ───────────────────────────────────────────────────────
// Sets flows.category_id (null = uncategorised). Category must belong to the tenant.

export async function updateFlowCategory(
  flowId: string,
  categoryId: string | null
): Promise<{ error: string | null }> {
  const gate = await requireAdmin()
  if (!gate.ok) return { error: gate.error }

  const { tenantId, db } = gate

  const { data: flow, error: flowErr } = await db
    .from('flows')
    .select('id')
    .eq('id', flowId)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (flowErr) return { error: flowErr.message }
  if (!flow) return { error: 'Flow not found or access denied' }

  if (categoryId !== null) {
    const { data: cat, error: catErr } = await db
      .from('flow_categories')
      .select('id')
      .eq('id', categoryId)
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (catErr) return { error: catErr.message }
    if (!cat) return { error: 'Category not found or access denied' }
  }

  const { error } = await db
    .from('flows')
    .update({ category_id: categoryId })
    .eq('id', flowId)
    .eq('tenant_id', tenantId)

  return { error: error?.message ?? null }
}
