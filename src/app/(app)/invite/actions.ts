'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionClaims } from '@/lib/supabase/auth-helpers'
import { sendInviteEmail } from '@/lib/email/resend'

type InviteResult = { success: true; email: string } | { success: false; error: string }

export async function inviteUser(email: string, role: 'admin' | 'user'): Promise<InviteResult> {
  const { user, claims } = await getSessionClaims()

  if (!user) return { success: false, error: 'Not authenticated.' }
  if (claims.role !== 'admin') return { success: false, error: 'Only admins can invite users.' }
  if (!claims.tenant_id) return { success: false, error: 'Tenant not found.' }

  // Check if user already exists in this tenant
  const supabase = createClient()
  const { data: existing } = await supabase.from('users').select('id').eq('email', email).single()

  if (existing) {
    return { success: false, error: 'A user with this email already exists.' }
  }

  const adminClient = createAdminClient()

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

  // Send invite email — fire-and-forget, never blocks the response
  void sendInviteEmail({
    tenantId: claims.tenant_id,
    inviteeEmail: email,
    inviterName: inviter?.full_name ?? inviter?.email ?? 'Your admin',
    tenantName: tenant?.name ?? 'your team',
    actionLink: inviteData.properties.action_link,
  })

  return { success: true, email }
}
