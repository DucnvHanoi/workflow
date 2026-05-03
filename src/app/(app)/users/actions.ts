// src/app/users/actions.ts
'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionClaims } from '@/lib/supabase/auth-helpers'
import { revalidatePath } from 'next/cache'

export async function updateUserRole(targetUserId: string, newRole: 'admin' | 'user') {
  const { user, claims } = await getSessionClaims()
  if (!user || claims.role !== 'admin') throw new Error('Unauthorized')
  if (user.id === targetUserId) throw new Error('You cannot change your own role')

  const adminClient = createAdminClient()

  const { data, error } = await adminClient
    .from('users')
    .update({ role: newRole })
    .eq('id', targetUserId)
    .eq('tenant_id', claims.tenant_id)
    .select('id, role')
    .single()

  if (error || !data) throw new Error('Failed to update role')

  // Invalidate their session so JWT hook re-fires on next login
  await adminClient.auth.admin.signOut(targetUserId)

  revalidatePath('/users')
}

export async function deleteUser(targetUserId: string) {
  const { user, claims } = await getSessionClaims()
  if (!user || claims.role !== 'admin') throw new Error('Unauthorized')
  if (user.id === targetUserId) throw new Error('You cannot delete yourself')

  const adminClient = createAdminClient()

  const { error } = await adminClient.auth.admin.deleteUser(targetUserId)
  if (error) throw new Error('Failed to delete user')

  revalidatePath('/users')
}

// ── NEW ──────────────────────────────────────────────────────────────────────
export async function updateUserManager(
  targetUserId: string,
  managerId: string | null // null = remove manager
) {
  const { user, claims } = await getSessionClaims()
  if (!user || claims.role !== 'admin') throw new Error('Unauthorized')

  // Cannot assign someone as their own manager
  if (managerId && managerId === targetUserId) {
    throw new Error('A user cannot be their own manager')
  }

  const adminClient = createAdminClient()

  // Verify the manager candidate belongs to the same tenant
  if (managerId) {
    const { data: managerRow, error: managerErr } = await adminClient
      .from('users')
      .select('id')
      .eq('id', managerId)
      .eq('tenant_id', claims.tenant_id)
      .single()

    if (managerErr || !managerRow) {
      throw new Error('Selected manager not found in this tenant')
    }
  }

  const { error } = await adminClient
    .from('users')
    .update({ manager_id: managerId })
    .eq('id', targetUserId)
    .eq('tenant_id', claims.tenant_id)

  if (error) throw new Error('Failed to update manager')

  revalidatePath('/users')
  revalidatePath(`/users/${targetUserId}`)
}
