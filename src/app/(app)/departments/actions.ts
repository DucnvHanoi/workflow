'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionClaims } from '@/lib/supabase/auth-helpers'

// ─── types ───────────────────────────────────────────────────────────────────

export interface FlatDepartment {
  id: string
  name: string
  parent_id: string | null
  created_at: string
}

// ─── helpers ─────────────────────────────────────────────────────────────────

// Build a map of id → depth (1 = root, 2 = child, 3 = grandchild)
function buildDepthMap(depts: FlatDepartment[]): Record<string, number> {
  const parentMap: Record<string, string | null> = {}
  for (const d of depts) parentMap[d.id] = d.parent_id

  function depth(id: string, visited = new Set<string>()): number {
    if (visited.has(id)) return 1 // loop guard
    visited.add(id)
    const pid = parentMap[id]
    if (!pid) return 1
    return 1 + depth(pid, visited)
  }

  const result: Record<string, number> = {}
  for (const d of depts) result[d.id] = depth(d.id)
  return result
}

// ─── create ──────────────────────────────────────────────────────────────────

export async function createDepartment(
  name: string,
  parentId: string | null
): Promise<{ error: string | null }> {
  const { user, claims } = await getSessionClaims()
  if (!user || claims.role !== 'admin') return { error: 'Unauthorised' }

  const trimmed = name.trim()
  if (!trimmed) return { error: 'Department name is required.' }
  if (trimmed.length > 100) return { error: 'Name must be 100 characters or fewer.' }

  const adminClient = createAdminClient()

  // If a parent is specified, validate it exists in the tenant and check depth
  if (parentId) {
    const { data: allDepts } = await adminClient
      .from('departments')
      .select('id, name, parent_id, created_at')
      .eq('tenant_id', claims.tenant_id)

    const depthMap = buildDepthMap(allDepts ?? [])
    const parentDepth = depthMap[parentId] ?? 0

    if (parentDepth === 0) return { error: 'Parent department not found.' }
    if (parentDepth >= 3) {
      return { error: 'Maximum 3 levels of hierarchy allowed.' }
    }
  }

  // Duplicate name check within same parent
  const { data: existing } = await adminClient
    .from('departments')
    .select('id')
    .eq('tenant_id', claims.tenant_id)
    .ilike('name', trimmed)
    .eq('parent_id', parentId ?? '') // won't match nulls — handled below
    .maybeSingle()

  // Also check null parent separately
  const { data: existingNull } = !parentId
    ? await adminClient
        .from('departments')
        .select('id')
        .eq('tenant_id', claims.tenant_id)
        .ilike('name', trimmed)
        .is('parent_id', null)
        .maybeSingle()
    : { data: null }

  if (existing || existingNull) {
    return { error: 'A department with this name already exists at this level.' }
  }

  const { error } = await adminClient.from('departments').insert({
    name: trimmed,
    tenant_id: claims.tenant_id,
    parent_id: parentId ?? null,
  })

  if (error) return { error: error.message }

  revalidatePath('/departments')
  return { error: null }
}

// ─── edit (rename + reparent) ────────────────────────────────────────────────

export async function editDepartment(
  departmentId: string,
  name: string,
  parentId: string | null
): Promise<{ error: string | null }> {
  const { user, claims } = await getSessionClaims()
  if (!user || claims.role !== 'admin') return { error: 'Unauthorised' }

  const trimmed = name.trim()
  if (!trimmed) return { error: 'Department name is required.' }
  if (trimmed.length > 100) return { error: 'Name must be 100 characters or fewer.' }

  // Cannot set itself as parent
  if (parentId === departmentId) {
    return { error: 'A department cannot be its own parent.' }
  }

  const adminClient = createAdminClient()

  const { data: allDepts } = await adminClient
    .from('departments')
    .select('id, name, parent_id, created_at')
    .eq('tenant_id', claims.tenant_id)

  const depts = allDepts ?? []

  // Cannot set a child of this dept as its parent (loop prevention)
  function isDescendant(candidateId: string, ancestorId: string): boolean {
    const candidate = depts.find((d) => d.id === candidateId)
    if (!candidate || !candidate.parent_id) return false
    if (candidate.parent_id === ancestorId) return true
    return isDescendant(candidate.parent_id, ancestorId)
  }

  if (parentId && isDescendant(parentId, departmentId)) {
    return { error: 'Cannot set a child department as parent (circular reference).' }
  }

  // Depth check: if this dept has children, new parent depth + existing child depth must stay ≤ 3
  if (parentId) {
    const depthMap = buildDepthMap(depts)
    const parentDepth = depthMap[parentId] ?? 0
    if (parentDepth === 0) return { error: 'Parent department not found.' }

    // Find max depth of children under this dept
    const maxChildDepth = (id: string, currentDepth: number): number => {
      const children = depts.filter((d) => d.parent_id === id)
      if (children.length === 0) return currentDepth
      return Math.max(...children.map((c) => maxChildDepth(c.id, currentDepth + 1)))
    }

    const childLevels = maxChildDepth(departmentId, 0) // depth of subtree below this dept
    if (parentDepth + childLevels >= 3) {
      return { error: 'Moving this department here would exceed the 3-level limit.' }
    }
  }

  const { error } = await adminClient
    .from('departments')
    .update({ name: trimmed, parent_id: parentId ?? null })
    .eq('id', departmentId)
    .eq('tenant_id', claims.tenant_id)

  if (error) return { error: error.message }

  revalidatePath('/departments')
  return { error: null }
}

// ─── delete ──────────────────────────────────────────────────────────────────

export async function deleteDepartment(departmentId: string): Promise<{ error: string | null }> {
  const { user, claims } = await getSessionClaims()
  if (!user || claims.role !== 'admin') return { error: 'Unauthorised' }

  const adminClient = createAdminClient()

  // Block if users are assigned to this department
  const { count: userCount } = await adminClient
    .from('users')
    .select('id', { count: 'exact', head: true })
    .eq('department_id', departmentId)
    .eq('tenant_id', claims.tenant_id)

  if (userCount && userCount > 0) {
    return {
      error: `Cannot delete — ${userCount} user${userCount > 1 ? 's are' : ' is'} assigned to this department. Reassign them first.`,
    }
  }

  // Block if this department has children
  const { count: childCount } = await adminClient
    .from('departments')
    .select('id', { count: 'exact', head: true })
    .eq('parent_id', departmentId)
    .eq('tenant_id', claims.tenant_id)

  if (childCount && childCount > 0) {
    return {
      error: `Cannot delete — this department has ${childCount} sub-department${childCount > 1 ? 's' : ''}. Delete or move them first.`,
    }
  }

  const { error } = await adminClient
    .from('departments')
    .delete()
    .eq('id', departmentId)
    .eq('tenant_id', claims.tenant_id)

  if (error) return { error: error.message }

  revalidatePath('/departments')
  return { error: null }
}

// ─── set department head ──────────────────────────────────────────────────────

export async function setDepartmentHead(
  departmentId: string,
  userId: string | null // null = clear the head
): Promise<{ error: string | null }> {
  const { user, claims } = await getSessionClaims()
  if (!user || claims.role !== 'admin') return { error: 'Unauthorised' }

  const adminClient = createAdminClient()

  // Verify dept belongs to this tenant
  const { data: dept } = await adminClient
    .from('departments')
    .select('id')
    .eq('id', departmentId)
    .eq('tenant_id', claims.tenant_id)
    .maybeSingle()

  if (!dept) return { error: 'Department not found.' }

  // If setting a user, verify they belong to this tenant
  if (userId) {
    const { data: u } = await adminClient
      .from('users')
      .select('id')
      .eq('id', userId)
      .eq('tenant_id', claims.tenant_id)
      .maybeSingle()

    if (!u) return { error: 'User not found in this tenant.' }
  }

  const { error } = await adminClient
    .from('departments')
    .update({ head_user_id: userId })
    .eq('id', departmentId)
    .eq('tenant_id', claims.tenant_id)

  if (error) return { error: error.message }

  revalidatePath('/departments')
  revalidatePath('/users')
  return { error: null }
}

// ─── member management ────────────────────────────────────────────────────────

export async function addMemberToDepartment(
  userId: string,
  departmentId: string
): Promise<{ error: string | null }> {
  const { user, claims } = await getSessionClaims()
  if (!user || claims.role !== 'admin') return { error: 'Unauthorised' }

  const adminClient = createAdminClient()

  const { data: dept } = await adminClient
    .from('departments')
    .select('id')
    .eq('id', departmentId)
    .eq('tenant_id', claims.tenant_id)
    .maybeSingle()

  if (!dept) return { error: 'Department not found.' }

  const { error } = await adminClient
    .from('users')
    .update({ department_id: departmentId })
    .eq('id', userId)
    .eq('tenant_id', claims.tenant_id)

  if (error) return { error: error.message }

  revalidatePath('/departments')
  revalidatePath('/users')
  revalidatePath('/org-chart')
  return { error: null }
}

export async function removeMemberFromDepartment(
  userId: string,
  departmentId: string
): Promise<{ error: string | null }> {
  const { user, claims } = await getSessionClaims()
  if (!user || claims.role !== 'admin') return { error: 'Unauthorised' }

  const adminClient = createAdminClient()

  const { error } = await adminClient
    .from('users')
    .update({ department_id: null })
    .eq('id', userId)
    .eq('department_id', departmentId)
    .eq('tenant_id', claims.tenant_id)

  if (error) return { error: error.message }

  revalidatePath('/departments')
  revalidatePath('/users')
  revalidatePath('/org-chart')
  return { error: null }
}

// ─── merge ────────────────────────────────────────────────────────────────────

export async function mergeDepartment(
  sourceId: string,
  targetId: string,
  deleteSource: boolean
): Promise<{ error: string | null; movedCount: number }> {
  const { user, claims } = await getSessionClaims()
  if (!user || claims.role !== 'admin') return { error: 'Unauthorised', movedCount: 0 }
  if (sourceId === targetId) return { error: 'Source and target must be different.', movedCount: 0 }

  const adminClient = createAdminClient()

  // Verify both departments belong to this tenant
  const { data: depts } = await adminClient
    .from('departments')
    .select('id, head_user_id')
    .in('id', [sourceId, targetId])
    .eq('tenant_id', claims.tenant_id)

  const sourceDept = depts?.find((d) => d.id === sourceId)
  const targetDept = depts?.find((d) => d.id === targetId)
  if (!sourceDept) return { error: 'Source department not found.', movedCount: 0 }
  if (!targetDept) return { error: 'Target department not found.', movedCount: 0 }

  // Move all users from source → target
  const { data: movedRows, error: moveError } = await adminClient
    .from('users')
    .update({ department_id: targetId })
    .eq('department_id', sourceId)
    .eq('tenant_id', claims.tenant_id)
    .select('id')

  if (moveError) return { error: moveError.message, movedCount: 0 }
  const movedCount = movedRows?.length ?? 0

  // Transfer department head if source has one and target does not
  if (sourceDept.head_user_id && !targetDept.head_user_id) {
    await adminClient
      .from('departments')
      .update({ head_user_id: sourceDept.head_user_id })
      .eq('id', targetId)
      .eq('tenant_id', claims.tenant_id)
  }

  // Optionally delete source department (only if it has no children)
  if (deleteSource) {
    const { count: childCount } = await adminClient
      .from('departments')
      .select('id', { count: 'exact', head: true })
      .eq('parent_id', sourceId)
      .eq('tenant_id', claims.tenant_id)

    if (childCount && childCount > 0) {
      return {
        error: `Merged ${movedCount} user${movedCount !== 1 ? 's' : ''} successfully, but could not delete source — it still has ${childCount} sub-department${childCount > 1 ? 's' : ''}. Delete them first.`,
        movedCount,
      }
    }

    await adminClient
      .from('departments')
      .delete()
      .eq('id', sourceId)
      .eq('tenant_id', claims.tenant_id)
  }

  revalidatePath('/departments')
  revalidatePath('/users')
  revalidatePath('/org-chart')
  return { error: null, movedCount }
}
