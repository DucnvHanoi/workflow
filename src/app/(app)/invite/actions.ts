'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionClaims } from '@/lib/supabase/auth-helpers'

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

  // Use admin client to generate invite link
  const adminClient = createAdminClient()

  const { data: inviteData, error: inviteError } = await adminClient.auth.admin.generateLink({
    type: 'invite',
    email,
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/confirm`,
    },
  })
  // TEMPORARY: log the actual invite link for dev testing
  console.log('=== INVITE LINK ===')
  console.log(inviteData?.properties?.action_link)
  console.log('===================')
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

  return { success: true, email }
}
