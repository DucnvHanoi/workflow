'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionClaims } from '@/lib/supabase/auth-helpers'

async function assertPlatformAdmin() {
  const { user } = await getSessionClaims()
  const platformEmail = process.env.PLATFORM_ADMIN_EMAIL
  if (!user || !platformEmail || user.email !== platformEmail) {
    throw new Error('Unauthorized')
  }
}

export async function updateAIOverride(fd: FormData) {
  await assertPlatformAdmin()

  const tenantId = fd.get('tenantId') as string
  const raw = fd.get('credit_limit_usd') as string
  const creditLimitUsd = raw && raw.trim() !== '' ? parseFloat(raw) : null

  const db = createAdminClient()

  // Upsert so enterprise tenants without a config row still work
  const { error } = await db.from('tenant_ai_configs').upsert(
    {
      tenant_id: tenantId,
      credit_limit_usd: creditLimitUsd ?? 0,
    },
    { onConflict: 'tenant_id' }
  )

  if (error) throw new Error(error.message)
  revalidatePath('/platform/ai-overrides')
}
