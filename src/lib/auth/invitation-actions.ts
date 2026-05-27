'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionClaims } from '@/lib/supabase/auth-helpers'

/**
 * Called from account-setup-form after the user sets their password.
 * Uses the admin client (bypasses RLS) because invited users have no
 * app_metadata.tenant_id yet — their JWT carries an empty app_metadata,
 * so any browser-client write would be silently blocked by RLS policies
 * that check the tenant_id claim.
 *
 * This action atomically:
 *   1. Saves full_name and activates the account in public.users
 *   2. Marks the pending_invitation row as accepted
 *   3. Stamps app_metadata so all subsequent RLS checks work correctly
 */
export async function markInvitationAccepted(fullName: string): Promise<void> {
  const { user } = await getSessionClaims()
  if (!user) return

  const db = createAdminClient()

  // Fetch tenant_id + role — needed to stamp app_metadata
  const { data: userRow } = await db
    .from('users')
    .select('tenant_id, role')
    .eq('id', user.id)
    .single()

  if (!userRow) return

  await Promise.all([
    db.from('users').update({ full_name: fullName, is_active: true }).eq('id', user.id),
    db
      .from('pending_invitations')
      .update({ status: 'accepted' })
      .eq('user_id', user.id)
      .eq('status', 'pending'),
    db.auth.admin.updateUserById(user.id, {
      app_metadata: { tenant_id: userRow.tenant_id, role: userRow.role },
    }),
  ])
}
