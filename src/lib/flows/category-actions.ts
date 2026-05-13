'use server'

// FILE PATH: src/lib/flows/category-actions.ts
// Server actions for flow_categories CRUD.
// All writes use adminClient (same pattern as actions.ts).

import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionClaims } from '@/lib/supabase/auth-helpers'
import { revalidatePath } from 'next/cache'

export type FlowCategory = {
  id: string
  name: string
  color: string
  createdAt: string
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

// ─── getCategories ────────────────────────────────────────────────────────────
// Fetches all categories for the current tenant, sorted alphabetically.
// Safe to call from both admin and normal user contexts (RLS allows SELECT).
export async function getCategories(): Promise<{
  categories: FlowCategory[]
  error: string | null
}> {
  const { user, claims } = await getSessionClaims()
  if (!user) return { categories: [], error: 'Unauthenticated' }
  if (!claims.tenant_id) return { categories: [], error: 'Tenant not found' }

  const db = createAdminClient()

  const { data, error } = await db
    .from('flow_categories')
    .select('id, name, color, created_at')
    .eq('tenant_id', claims.tenant_id)
    .order('name', { ascending: true })

  if (error) return { categories: [], error: error.message }

  const categories: FlowCategory[] =
    data?.map((r) => ({
      id: r.id,
      name: r.name,
      color: r.color,
      createdAt: r.created_at,
    })) ?? []

  return { categories, error: null }
}

// ─── createCategory ───────────────────────────────────────────────────────────
export async function createCategory(
  name: string,
  color: string
): Promise<{ category: FlowCategory | null; error: string | null }> {
  const gate = await requireAdminWithTenant()
  if (!gate.ok) return { category: null, error: gate.error }

  const trimmed = name.trim()
  if (!trimmed) return { category: null, error: 'Category name cannot be empty' }
  if (trimmed.length > 60) return { category: null, error: 'Name must be 60 characters or fewer' }

  const { tenantId, db } = gate

  const { data, error } = await db
    .from('flow_categories')
    .insert({ tenant_id: tenantId, name: trimmed, color })
    .select('id, name, color, created_at')
    .single()

  if (error) {
    // Unique constraint violation = duplicate name
    if (error.code === '23505') {
      return { category: null, error: `A category named "${trimmed}" already exists.` }
    }
    return { category: null, error: error.message }
  }

  revalidatePath('/flows')

  return {
    category: { id: data.id, name: data.name, color: data.color, createdAt: data.created_at },
    error: null,
  }
}

// ─── updateCategory ───────────────────────────────────────────────────────────
export async function updateCategory(
  categoryId: string,
  name: string,
  color: string
): Promise<{ error: string | null }> {
  const gate = await requireAdminWithTenant()
  if (!gate.ok) return { error: gate.error }

  const trimmed = name.trim()
  if (!trimmed) return { error: 'Category name cannot be empty' }
  if (trimmed.length > 60) return { error: 'Name must be 60 characters or fewer' }

  const { tenantId, db } = gate

  const { error } = await db
    .from('flow_categories')
    .update({ name: trimmed, color })
    .eq('id', categoryId)
    .eq('tenant_id', tenantId)

  if (error) {
    if (error.code === '23505') {
      return { error: `A category named "${trimmed}" already exists.` }
    }
    return { error: error.message }
  }

  revalidatePath('/flows')
  return { error: null }
}

// ─── deleteCategory ───────────────────────────────────────────────────────────
// ON DELETE SET NULL means flows keep working — they just become Uncategorized.
export async function deleteCategory(categoryId: string): Promise<{ error: string | null }> {
  const gate = await requireAdminWithTenant()
  if (!gate.ok) return { error: gate.error }

  const { tenantId, db } = gate

  // Verify ownership before deleting
  const { data: existing } = await db
    .from('flow_categories')
    .select('id')
    .eq('id', categoryId)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (!existing) return { error: 'Category not found' }

  const { error } = await db
    .from('flow_categories')
    .delete()
    .eq('id', categoryId)
    .eq('tenant_id', tenantId)

  if (error) return { error: error.message }

  revalidatePath('/flows')
  return { error: null }
}

// ─── updateFlowCategory ───────────────────────────────────────────────────────
// Assigns or clears a category on a flow. Pass null to unset.
export async function updateFlowCategory(
  flowId: string,
  categoryId: string | null
): Promise<{ error: string | null }> {
  const gate = await requireAdminWithTenant()
  if (!gate.ok) return { error: gate.error }

  const { tenantId, db } = gate

  // Verify the flow belongs to this tenant
  const { data: flow } = await db
    .from('flows')
    .select('id')
    .eq('id', flowId)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (!flow) return { error: 'Flow not found' }

  // If a categoryId is provided, verify it belongs to the same tenant
  if (categoryId !== null) {
    const { data: cat } = await db
      .from('flow_categories')
      .select('id')
      .eq('id', categoryId)
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (!cat) return { error: 'Category not found' }
  }

  const { error } = await db
    .from('flows')
    .update({ category_id: categoryId, updated_at: new Date().toISOString() })
    .eq('id', flowId)
    .eq('tenant_id', tenantId)

  if (error) return { error: error.message }

  revalidatePath('/flows')
  return { error: null }
}
