// src/app/(app)/users/actions.ts
'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionClaims } from '@/lib/supabase/auth-helpers'
import { logAuditEvent } from '@/lib/audit/log'
import { revalidatePath } from 'next/cache'

export async function updateUserRole(targetUserId: string, newRole: 'admin' | 'user') {
  const { user, claims } = await getSessionClaims()
  if (!user || claims.role !== 'admin') throw new Error('Unauthorized')
  if (user.id === targetUserId) throw new Error('You cannot change your own role')

  const adminClient = createAdminClient()

  // Capture the previous role + display name for the audit description.
  const { data: before } = await adminClient
    .from('users')
    .select('full_name, email, role')
    .eq('id', targetUserId)
    .eq('tenant_id', claims.tenant_id)
    .maybeSingle()

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

  const targetName = before?.full_name ?? before?.email ?? 'a user'
  await logAuditEvent(adminClient, {
    tenantId: claims.tenant_id!,
    actorId: user.id,
    action: 'role_changed',
    targetType: 'user',
    targetId: targetUserId,
    targetLabel: targetName,
    description: `Changed role of ${targetName} from ${before?.role ?? 'unknown'} to ${newRole}`,
    metadata: { oldRole: before?.role ?? null, newRole },
  })

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

export async function updateUserManager(targetUserId: string, managerId: string | null) {
  const { user, claims } = await getSessionClaims()
  if (!user || claims.role !== 'admin') throw new Error('Unauthorized')
  if (managerId && managerId === targetUserId) {
    throw new Error('A user cannot be their own manager')
  }

  const adminClient = createAdminClient()

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

// ─── NEW: Update full name and email ─────────────────────────────────────────

export async function updateUserProfile(
  targetUserId: string,
  data: { full_name: string; email: string }
) {
  const { user, claims } = await getSessionClaims()
  if (!user || claims.role !== 'admin') throw new Error('Unauthorized')

  const fullName = data.full_name.trim()
  const email = data.email.trim().toLowerCase()

  if (!fullName || fullName.length < 2) throw new Error('Name must be at least 2 characters')
  if (!email || !email.includes('@')) throw new Error('Invalid email address')

  const adminClient = createAdminClient()

  // Check email not already taken by another user in this tenant
  const { data: existing } = await adminClient
    .from('users')
    .select('id')
    .eq('email', email)
    .eq('tenant_id', claims.tenant_id)
    .neq('id', targetUserId)
    .maybeSingle()

  if (existing) throw new Error('Email is already in use by another user')

  // Update public.users (full_name + email)
  const { error: profileError } = await adminClient
    .from('users')
    .update({ full_name: fullName, email })
    .eq('id', targetUserId)
    .eq('tenant_id', claims.tenant_id)

  if (profileError) throw new Error('Failed to update profile')

  // Update auth.users email so login still works
  const { error: authError } = await adminClient.auth.admin.updateUserById(targetUserId, {
    email,
  })

  if (authError) throw new Error('Failed to update auth email: ' + authError.message)

  revalidatePath('/users')
  revalidatePath(`/users/${targetUserId}`)
}

// ─── NEW: Update department ───────────────────────────────────────────────────

export async function updateUserDepartment(targetUserId: string, departmentId: string | null) {
  const { user, claims } = await getSessionClaims()
  if (!user || claims.role !== 'admin') throw new Error('Unauthorized')

  const adminClient = createAdminClient()

  // Verify department belongs to this tenant (if setting one)
  if (departmentId) {
    const { data: dept, error: deptErr } = await adminClient
      .from('departments')
      .select('id')
      .eq('id', departmentId)
      .eq('tenant_id', claims.tenant_id)
      .single()

    if (deptErr || !dept) throw new Error('Department not found in this tenant')
  }

  const { error } = await adminClient
    .from('users')
    .update({ department_id: departmentId })
    .eq('id', targetUserId)
    .eq('tenant_id', claims.tenant_id)

  if (error) throw new Error('Failed to update department')

  revalidatePath('/users')
  revalidatePath(`/users/${targetUserId}`)
}
