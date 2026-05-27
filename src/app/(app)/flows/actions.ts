'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionClaims } from '@/lib/supabase/auth-helpers'
import { getTenantLimits } from '@/lib/billing/limits'
import { redirect } from 'next/navigation'

export async function createFlow() {
  const { user, claims } = await getSessionClaims()
  if (!user || claims.role !== 'admin') {
    throw new Error('Unauthorized')
  }

  const adminClient = createAdminClient()

  // Plan enforcement — check flow cap
  const limits = await getTenantLimits(claims.tenant_id as string)
  if (limits.maxFlows !== null) {
    const { count } = await adminClient
      .from('flows')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', claims.tenant_id)
    if ((count ?? 0) >= limits.maxFlows) {
      redirect(
        `/flows?error=${encodeURIComponent(`You've reached your plan limit of ${limits.maxFlows} flow${limits.maxFlows !== 1 ? 's' : ''}. Upgrade to Pro to create more.`)}`
      )
    }
  }

  const { data: flow, error } = await adminClient
    .from('flows')
    .insert({
      tenant_id: claims.tenant_id,
      name: 'Untitled Flow',
      status: 'draft',
    })
    .select('id')
    .single()

  if (error || !flow) {
    throw new Error('Failed to create flow')
  }

  redirect(`/flows/${flow.id}/edit`)
}
