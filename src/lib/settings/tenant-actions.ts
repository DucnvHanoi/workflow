'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionClaims } from '@/lib/supabase/auth-helpers'

export async function updateTenantName(name: string): Promise<{ error: string | null }> {
  const trimmed = name.trim()
  if (!trimmed || trimmed.length > 100) {
    return { error: 'Name must be between 1 and 100 characters.' }
  }

  const { user, claims } = await getSessionClaims()
  if (!user || claims?.role !== 'admin') {
    return { error: 'Unauthorised.' }
  }

  const tenantId = claims.tenant_id as string
  const db = createAdminClient()
  const { error } = await db.from('tenants').update({ name: trimmed }).eq('id', tenantId)

  if (error) return { error: 'Failed to update organisation name.' }

  revalidatePath('/settings')
  return { error: null }
}
