'use server'

import { revalidatePath } from 'next/cache'
import { getSessionClaims } from '@/lib/supabase/auth-helpers'
import { createAdminClient } from '@/lib/supabase/admin'

export async function updateUserManager(
  userId: string,
  managerId: string | null
): Promise<{ error?: string }> {
  const { user, claims } = await getSessionClaims()
  if (!user) return { error: 'Not authenticated.' }
  if (claims.role !== 'admin') return { error: 'Admin only.' }
  if (!claims.tenant_id) return { error: 'Tenant not found.' }

  const db = createAdminClient()

  // Verify proposed manager belongs to the same tenant
  if (managerId) {
    const { data: mgr } = await db
      .from('users')
      .select('id')
      .eq('id', managerId)
      .eq('tenant_id', claims.tenant_id)
      .maybeSingle()
    if (!mgr) return { error: 'Manager not found in this organisation.' }
  }

  const { error } = await db
    .from('users')
    .update({ manager_id: managerId })
    .eq('id', userId)
    .eq('tenant_id', claims.tenant_id)

  if (error) return { error: error.message }

  revalidatePath('/org-chart')
  revalidatePath('/users')
  return {}
}
