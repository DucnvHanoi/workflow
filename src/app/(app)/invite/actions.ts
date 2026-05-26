'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionClaims } from '@/lib/supabase/auth-helpers'
import { getTenantLimits } from '@/lib/billing/limits'
import { sendInviteEmail } from '@/lib/email/resend'
import { checkInviteRate } from '@/lib/rate-limit'
import type { PendingInvitation } from './pending/pending-client'

type InviteResult = { success: true; email: string } | { success: false; error: string }
type ActionResult = { success: true } | { success: false; error: string }

export type BulkImportRow = {
  email: string
  full_name?: string
  role: 'admin' | 'user'
  password?: string
  invite: boolean
}
export type BulkImportResult = {
  email: string
  success: boolean
  error?: string
  invited?: boolean
}

export async function bulkImportUsers(rows: BulkImportRow[]): Promise<BulkImportResult[]> {
  const { user, claims } = await getSessionClaims()
  if (!user)
    return rows.map((r) => ({ email: r.email, success: false, error: 'Not authenticated.' }))
  if (claims.role !== 'admin')
    return rows.map((r) => ({ email: r.email, success: false, error: 'Admin only.' }))
  if (!claims.tenant_id)
    return rows.map((r) => ({ email: r.email, success: false, error: 'Tenant not found.' }))

  const MAX_ROWS = 100
  const batch = rows.slice(0, MAX_ROWS)
  const adminClient = createAdminClient()

  // Plan enforcement — cap batch to remaining user slots
  const limits = await getTenantLimits(claims.tenant_id as string)
  if (limits.maxUsers !== null) {
    const { count: currentCount } = await adminClient
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', claims.tenant_id)
    const remaining = limits.maxUsers - (currentCount ?? 0)
    if (remaining <= 0) {
      return rows.map((r) => ({
        email: r.email,
        success: false,
        error: `You've reached your plan limit of ${limits.maxUsers} users. Upgrade to Pro to invite more.`,
      }))
    }
    if (batch.length > remaining) {
      batch.splice(remaining)
    }
  }

  // Fetch inviter + tenant name once for invite emails
  const [{ data: inviter }, { data: tenant }] = await Promise.all([
    adminClient.from('users').select('full_name, email').eq('id', user.id).single(),
    adminClient.from('tenants').select('name').eq('id', claims.tenant_id).single(),
  ])

  const results: BulkImportResult[] = []

  for (const row of batch) {
    const email = row.email.trim().toLowerCase()
    const fullName = row.full_name?.trim() || null
    const role = row.role === 'admin' ? 'admin' : 'user'

    // Check duplicate in tenant
    const { data: existing } = await adminClient
      .from('users')
      .select('id')
      .eq('email', email)
      .eq('tenant_id', claims.tenant_id)
      .maybeSingle()

    if (existing) {
      results.push({ email, success: false, error: 'User already exists in this tenant.' })
      continue
    }

    if (row.invite) {
      // Invite flow: generate magic link, send email, track in pending_invitations
      const { data: inviteData, error: inviteError } = await adminClient.auth.admin.generateLink({
        type: 'invite',
        email,
        options: { redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/confirm` },
      })

      if (inviteError || !inviteData?.user) {
        results.push({
          email,
          success: false,
          error: inviteError?.message ?? 'Failed to generate invite link.',
        })
        continue
      }

      const { error: insertError } = await adminClient.from('users').insert({
        id: inviteData.user.id,
        tenant_id: claims.tenant_id,
        email,
        role,
        ...(fullName ? { full_name: fullName } : {}),
      })

      if (insertError) {
        results.push({
          email,
          success: false,
          error: 'Failed to create user record: ' + insertError.message,
        })
        continue
      }

      // Track in pending_invitations (non-fatal)
      await adminClient.from('pending_invitations').insert({
        tenant_id: claims.tenant_id,
        email,
        invited_by: user.id,
        user_id: inviteData.user.id,
      })

      await sendInviteEmail({
        tenantId: claims.tenant_id,
        inviteeEmail: email,
        inviterName: inviter?.full_name ?? inviter?.email ?? 'Your admin',
        tenantName: tenant?.name ?? 'your team',
        actionLink: inviteData.properties.action_link,
      })

      results.push({ email, success: true, invited: true })
    } else {
      // Password flow: create user with the provided password
      if (!row.password?.trim()) {
        results.push({
          email,
          success: false,
          error: 'Password is required when invite is "no".',
        })
        continue
      }

      const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
        email,
        password: row.password.trim(),
        email_confirm: true,
      })

      if (authError || !authData.user) {
        results.push({
          email,
          success: false,
          error: authError?.message ?? 'Failed to create auth user.',
        })
        continue
      }

      const { error: insertError } = await adminClient.from('users').insert({
        id: authData.user.id,
        tenant_id: claims.tenant_id,
        email,
        role,
        ...(fullName ? { full_name: fullName } : {}),
      })

      if (insertError) {
        await adminClient.auth.admin.deleteUser(authData.user.id)
        results.push({
          email,
          success: false,
          error: 'Failed to create user record: ' + insertError.message,
        })
        continue
      }

      results.push({ email, success: true, invited: false })
    }
  }

  revalidatePath('/users')
  revalidatePath('/invite/pending')
  return results
}

export async function inviteUser(email: string, role: 'admin' | 'user'): Promise<InviteResult> {
  const { user, claims } = await getSessionClaims()

  if (!user) return { success: false, error: 'Not authenticated.' }
  if (claims.role !== 'admin') return { success: false, error: 'Only admins can invite users.' }
  if (!claims.tenant_id) return { success: false, error: 'Tenant not found.' }

  // Rate limit — 30 invitations per hour per tenant
  const allowed = await checkInviteRate(claims.tenant_id as string)
  if (!allowed) {
    return {
      success: false,
      error: 'Too many invitations sent recently. Please try again in an hour.',
    }
  }

  const adminClient = createAdminClient()

  // Check if user already exists in this tenant (admin client + explicit tenant scope)
  const { data: existing } = await adminClient
    .from('users')
    .select('id')
    .eq('email', email)
    .eq('tenant_id', claims.tenant_id)
    .maybeSingle()

  if (existing) {
    return { success: false, error: 'A user with this email already exists.' }
  }

  // Plan enforcement — check user cap
  const limits = await getTenantLimits(claims.tenant_id as string)
  if (limits.maxUsers !== null) {
    const { count } = await adminClient
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', claims.tenant_id)
    if ((count ?? 0) >= limits.maxUsers) {
      return {
        success: false,
        error: `You've reached your plan limit of ${limits.maxUsers} users. Upgrade to Pro to invite more.`,
      }
    }
  }

  // Fetch inviter name + tenant name for the email
  const [{ data: inviter }, { data: tenant }] = await Promise.all([
    adminClient.from('users').select('full_name, email').eq('id', user.id).single(),
    adminClient.from('tenants').select('name').eq('id', claims.tenant_id).single(),
  ])

  const { data: inviteData, error: inviteError } = await adminClient.auth.admin.generateLink({
    type: 'invite',
    email,
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/confirm`,
    },
  })
  if (inviteError || !inviteData.user) {
    return {
      success: false,
      error: inviteError?.message ?? 'Failed to generate invite link.',
    }
  }

  // Pre-insert public.users row so JWT hook works on first login
  const { error: insertError } = await adminClient.from('users').insert({
    id: inviteData.user.id,
    tenant_id: claims.tenant_id,
    email,
    role,
  })

  if (insertError) {
    return {
      success: false,
      error: 'Failed to create user record: ' + insertError.message,
    }
  }

  // Track in pending_invitations (non-fatal)
  const { error: piError } = await adminClient.from('pending_invitations').insert({
    tenant_id: claims.tenant_id,
    email,
    invited_by: user.id,
    user_id: inviteData.user.id,
  })
  if (piError) {
    console.error('Failed to record pending invitation:', piError.message)
  }

  await sendInviteEmail({
    tenantId: claims.tenant_id,
    inviteeEmail: email,
    inviterName: inviter?.full_name ?? inviter?.email ?? 'Your admin',
    tenantName: tenant?.name ?? 'your team',
    actionLink: inviteData.properties.action_link,
  })

  return { success: true, email }
}

export async function getPendingInvitations(): Promise<PendingInvitation[]> {
  const { user, claims } = await getSessionClaims()
  if (!user || claims.role !== 'admin') return []

  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from('pending_invitations')
    .select(
      'id, email, invited_at, resend_count, last_resent_at, inviter:users!invited_by(full_name), invitee:users!user_id(full_name)'
    )
    .eq('tenant_id', claims.tenant_id)
    .neq('status', 'revoked')
    .order('invited_at', { ascending: false })

  if (error || !data) return []

  return data.map((row) => {
    const inviter = Array.isArray(row.inviter) ? row.inviter[0] : row.inviter
    const invitee = Array.isArray(row.invitee) ? row.invitee[0] : row.invitee
    return {
      id: row.id,
      email: row.email,
      invited_at: row.invited_at,
      resend_count: row.resend_count,
      last_resent_at: row.last_resent_at,
      invited_by_name: (inviter as { full_name: string } | null)?.full_name ?? null,
      is_accepted: !!(invitee as { full_name: string } | null)?.full_name,
    }
  })
}

export async function resendInvitation(id: string): Promise<ActionResult> {
  const { user, claims } = await getSessionClaims()
  if (!user) return { success: false, error: 'Not authenticated.' }
  if (claims.role !== 'admin') return { success: false, error: 'Admin only.' }
  if (!claims.tenant_id) return { success: false, error: 'Tenant not found.' }

  const adminClient = createAdminClient()

  const { data: invitation } = await adminClient
    .from('pending_invitations')
    .select('id, email, resend_count, status')
    .eq('id', id)
    .eq('tenant_id', claims.tenant_id)
    .single()

  if (!invitation) return { success: false, error: 'Invitation not found.' }
  if (invitation.status !== 'pending') {
    return { success: false, error: 'This invitation has already been accepted or revoked.' }
  }

  const { data: inviteData, error: inviteError } = await adminClient.auth.admin.generateLink({
    type: 'invite',
    email: invitation.email,
    options: { redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/confirm` },
  })

  if (inviteError || !inviteData) {
    return { success: false, error: inviteError?.message ?? 'Failed to generate invite link.' }
  }

  const [{ data: inviter }, { data: tenant }] = await Promise.all([
    adminClient.from('users').select('full_name, email').eq('id', user.id).single(),
    adminClient.from('tenants').select('name').eq('id', claims.tenant_id).single(),
  ])

  await sendInviteEmail({
    tenantId: claims.tenant_id!,
    inviteeEmail: invitation.email,
    inviterName: inviter?.full_name ?? inviter?.email ?? 'Your admin',
    tenantName: tenant?.name ?? 'your team',
    actionLink: inviteData.properties.action_link,
  })

  await adminClient
    .from('pending_invitations')
    .update({
      resend_count: invitation.resend_count + 1,
      last_resent_at: new Date().toISOString(),
    })
    .eq('id', id)

  revalidatePath('/invite/pending')
  return { success: true }
}

export async function revokeInvitation(id: string): Promise<ActionResult> {
  const { user, claims } = await getSessionClaims()
  if (!user) return { success: false, error: 'Not authenticated.' }
  if (claims.role !== 'admin') return { success: false, error: 'Admin only.' }

  const adminClient = createAdminClient()

  const { data: invitation } = await adminClient
    .from('pending_invitations')
    .select('id, user_id, status')
    .eq('id', id)
    .eq('tenant_id', claims.tenant_id)
    .single()

  if (!invitation) return { success: false, error: 'Invitation not found.' }
  if (invitation.status !== 'pending') {
    return { success: false, error: 'Invitation is not pending.' }
  }

  // Mark revoked first (captures user_id before ON DELETE SET NULL triggers)
  await adminClient
    .from('pending_invitations')
    .update({ status: 'revoked', revoked_at: new Date().toISOString() })
    .eq('id', id)

  if (invitation.user_id) {
    // Delete public.users row, then auth.users
    await adminClient
      .from('users')
      .delete()
      .eq('id', invitation.user_id)
      .eq('tenant_id', claims.tenant_id)
    await adminClient.auth.admin.deleteUser(invitation.user_id)
  }

  revalidatePath('/invite/pending')
  revalidatePath('/users')
  return { success: true }
}
