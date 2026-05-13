'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionClaims } from '@/lib/supabase/auth-helpers'
import { redirect } from 'next/navigation'

export async function createFlow() {
  const { user, claims } = await getSessionClaims()
  if (!user || claims.role !== 'admin') {
    throw new Error('Unauthorized')
  }

  const adminClient = createAdminClient()

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
