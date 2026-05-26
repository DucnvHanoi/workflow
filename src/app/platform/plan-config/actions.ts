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

function nullableInt(value: string | null): number | null {
  if (!value || value.trim() === '' || value.trim() === 'null') return null
  const n = parseInt(value, 10)
  return isNaN(n) ? null : n
}

function nullableFloat(value: string | null): number | null {
  if (!value || value.trim() === '' || value.trim() === 'null') return null
  const n = parseFloat(value)
  return isNaN(n) ? null : n
}

export async function updatePlanConfig(fd: FormData) {
  await assertPlatformAdmin()

  const plan = fd.get('plan') as string
  const db = createAdminClient()

  const { error } = await db
    .from('plan_configs')
    .update({
      max_users: nullableInt(fd.get('max_users') as string),
      max_flows: nullableInt(fd.get('max_flows') as string),
      max_departments: nullableInt(fd.get('max_departments') as string),
      report_window_days: nullableInt(fd.get('report_window_days') as string),
      ai_enabled: fd.get('ai_enabled') === 'true',
      ai_credit_limit_usd: nullableFloat(fd.get('ai_credit_limit_usd') as string),
      ai_credit_reset: (fd.get('ai_credit_reset') as string) || null,
      price_per_user_cents: parseInt(fd.get('price_per_user_cents') as string, 10) || 0,
      updated_at: new Date().toISOString(),
    })
    .eq('plan', plan)

  if (error) throw new Error(error.message)

  revalidatePath('/platform/plan-config')
  revalidateTag('plan-limits')
}
