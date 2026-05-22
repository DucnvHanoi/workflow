'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionClaims } from '@/lib/supabase/auth-helpers'
import { revalidatePath } from 'next/cache'

export async function updateOwnFullName(fullName: string): Promise<{ error?: string }> {
  const { user, claims } = await getSessionClaims()
  if (!user || !claims.tenant_id) return { error: 'Not authenticated.' }

  const name = fullName.trim()
  if (!name || name.length < 2) return { error: 'Name must be at least 2 characters.' }

  const db = createAdminClient()
  const { error } = await db
    .from('users')
    .update({ full_name: name })
    .eq('id', user.id)
    .eq('tenant_id', claims.tenant_id)

  if (error) return { error: 'Failed to save. Please try again.' }

  revalidatePath('/settings')
  return {}
}
