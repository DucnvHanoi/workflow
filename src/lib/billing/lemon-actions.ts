'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidateTag } from 'next/cache'

export async function upgradeTenantToPro(
  tenantId: string,
  lemonCustomerId: string,
  lemonSubscriptionId: string,
  renewsAt: string | null
): Promise<void> {
  const admin = createAdminClient()
  const { error } = await admin
    .from('tenants')
    .update({
      plan: 'pro',
      lemon_customer_id: lemonCustomerId,
      lemon_subscription_id: lemonSubscriptionId,
      lemon_renews_at: renewsAt,
    })
    .eq('id', tenantId)

  if (error) {
    throw new Error(`[lemon-actions] upgradeTenantToPro failed: ${error.message}`)
  }

  revalidateTag('plan-limits')
}

export async function downgradeTenantToFree(tenantId: string): Promise<void> {
  const admin = createAdminClient()
  const { error } = await admin
    .from('tenants')
    .update({
      plan: 'free',
      lemon_subscription_id: null,
      lemon_renews_at: null,
    })
    .eq('id', tenantId)

  if (error) {
    throw new Error(`[lemon-actions] downgradeTenantToFree failed: ${error.message}`)
  }

  revalidateTag('plan-limits')
}
