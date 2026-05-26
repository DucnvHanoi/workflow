'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionClaims } from '@/lib/supabase/auth-helpers'

/**
 * Called from account-setup-form after the user sets their full_name.
 * Marks the pending invitation as accepted and activates the user account.
 */
export async function markInvitationAccepted(): Promise<void> {
  const { user } = await getSessionClaims()
  if (!user) return

  const db = createAdminClient()

  await Promise.all([
    db
      .from('pending_invitations')
      .update({ status: 'accepted' })
      .eq('user_id', user.id)
      .eq('status', 'pending'),
    db.from('users').update({ is_active: true }).eq('id', user.id),
  ])
}
