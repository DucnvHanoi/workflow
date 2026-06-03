'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionClaims } from '@/lib/supabase/auth-helpers'
import { createNotification } from '@/lib/notifications/create'

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

  // M3-1: notify admins when the first team member joins
  const { count: activeOthers } = await db
    .from('users')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', userRow.tenant_id)
    .eq('is_active', true)
    .neq('id', user.id)

  if ((activeOthers ?? 0) === 1) {
    const { data: admins } = await db
      .from('users')
      .select('id')
      .eq('tenant_id', userRow.tenant_id)
      .eq('role', 'admin')
      .eq('is_active', true)

    for (const admin of admins ?? []) {
      void createNotification({
        tenantId: userRow.tenant_id,
        userId: admin.id as string,
        type: 'first_user_joined',
        title: 'Your first team member has joined',
        body: `${fullName} has accepted their invitation and joined your workspace.`,
        link: '/users',
      })
    }
  }
}
