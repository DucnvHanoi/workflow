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

// ─── NEW: Deactivate user ─────────────────────────────────────────────────────

export async function deactivateUser(targetUserId: string) {
  const { user, claims } = await getSessionClaims()
  if (!user || claims.role !== 'admin') throw new Error('Unauthorized')
  if (user.id === targetUserId) throw new Error('You cannot deactivate yourself')

  const adminClient = createAdminClient()

  const { data: target } = await adminClient
    .from('users')
    .select('full_name, email, is_active')
    .eq('id', targetUserId)
    .eq('tenant_id', claims.tenant_id)
    .maybeSingle()

  if (!target) throw new Error('User not found')
  if (target.is_active === false) throw new Error('User is already deactivated')

  // Ban in Supabase Auth (~100 year duration = effectively permanent)
  const { error: banError } = await adminClient.auth.admin.updateUserById(targetUserId, {
    ban_duration: '876000h',
  })
  if (banError) throw new Error('Failed to ban user: ' + banError.message)

  const { error } = await adminClient
    .from('users')
    .update({ is_active: false })
    .eq('id', targetUserId)
    .eq('tenant_id', claims.tenant_id)
  if (error) throw new Error('Failed to deactivate user')

  const targetName = target.full_name ?? target.email
  await logAuditEvent(adminClient, {
    tenantId: claims.tenant_id!,
    actorId: user.id,
    action: 'user_deactivated',
    targetType: 'user',
    targetId: targetUserId,
    targetLabel: targetName,
    description: `Deactivated user ${targetName}`,
  })

  revalidatePath('/users')
  revalidatePath(`/users/${targetUserId}`)
}

// ─── NEW: Reactivate user ─────────────────────────────────────────────────────

export async function reactivateUser(targetUserId: string) {
  const { user, claims } = await getSessionClaims()
  if (!user || claims.role !== 'admin') throw new Error('Unauthorized')

  const adminClient = createAdminClient()

  const { data: target } = await adminClient
    .from('users')
    .select('full_name, email, is_active')
    .eq('id', targetUserId)
    .eq('tenant_id', claims.tenant_id)
    .maybeSingle()

  if (!target) throw new Error('User not found')
  if (target.is_active === true) throw new Error('User is already active')

  // Lift the Supabase Auth ban
  const { error: unbanError } = await adminClient.auth.admin.updateUserById(targetUserId, {
    ban_duration: 'none',
  })
  if (unbanError) throw new Error('Failed to unban user: ' + unbanError.message)

  const { error } = await adminClient
    .from('users')
    .update({ is_active: true })
    .eq('id', targetUserId)
    .eq('tenant_id', claims.tenant_id)
  if (error) throw new Error('Failed to reactivate user')

  const targetName = target.full_name ?? target.email
  await logAuditEvent(adminClient, {
    tenantId: claims.tenant_id!,
    actorId: user.id,
    action: 'user_reactivated',
    targetType: 'user',
    targetId: targetUserId,
    targetLabel: targetName,
    description: `Reactivated user ${targetName}`,
  })

  revalidatePath('/users')
  revalidatePath(`/users/${targetUserId}`)
}

// ─── NEW: Update department ───────────────────────────────────────────────────

// ─── Offboarding helpers ──────────────────────────────────────────────────────

export async function clearManagerRelationships(targetUserId: string): Promise<void> {
  const { user, claims } = await getSessionClaims()
  if (!user || claims.role !== 'admin') throw new Error('Unauthorized')

  const adminClient = createAdminClient()
  const { error } = await adminClient
    .from('users')
    .update({ manager_id: null })
    .eq('manager_id', targetUserId)
    .eq('tenant_id', claims.tenant_id)

  if (error) throw new Error('Failed to clear manager relationships')

  revalidatePath('/users')
  revalidatePath(`/users/${targetUserId}`)
  revalidatePath('/org-chart')
}

export async function removeDeptHeadRoles(targetUserId: string): Promise<void> {
  const { user, claims } = await getSessionClaims()
  if (!user || claims.role !== 'admin') throw new Error('Unauthorized')

  const adminClient = createAdminClient()
  const { error } = await adminClient
    .from('departments')
    .update({ head_user_id: null })
    .eq('head_user_id', targetUserId)
    .eq('tenant_id', claims.tenant_id)

  if (error) throw new Error('Failed to remove dept head roles')

  revalidatePath('/departments')
  revalidatePath('/org-chart')
  revalidatePath('/users')
}

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
