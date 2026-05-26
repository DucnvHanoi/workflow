'use server'

import { revalidatePath } from 'next/cache'
import { revalidateTag } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionClaims } from '@/lib/supabase/auth-helpers'

async function assertPlatformAdmin() {
  const { user } = await getSessionClaims()
  const platformEmail = process.env.PLATFORM_ADMIN_EMAIL
  if (!user || !platformEmail || user.email !== platformEmail) {
    throw new Error('Unauthorized')
  }
}

export async function updateTenantPlan(tenantId: string, plan: string) {
  await assertPlatformAdmin()
  const db = createAdminClient()
  const { error } = await db.from('tenants').update({ plan }).eq('id', tenantId)
  if (error) throw new Error(error.message)
  revalidatePath('/platform/tenants')
  revalidateTag('plan-limits')
}

export async function updateTenantStatus(tenantId: string, status: string) {
  await assertPlatformAdmin()
  const db = createAdminClient()
  const { error } = await db.from('tenants').update({ status }).eq('id', tenantId)
  if (error) throw new Error(error.message)
  revalidatePath('/platform/tenants')
}
