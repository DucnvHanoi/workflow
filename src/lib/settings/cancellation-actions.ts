'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionClaims } from '@/lib/supabase/auth-helpers'
import { logAuditEvent } from '@/lib/audit/log'
import { revalidatePath } from 'next/cache'
import { sendCancellationConfirmEmail, sendCancellationReversedEmail } from '@/lib/email/resend'
import { buildExportCsvs } from '@/lib/email/export-builder'

const COOLING_OFF_DAYS = 7

export interface CancellationState {
  status: string
  cancelAt: string | null
}

export async function getCancellationState(): Promise<CancellationState> {
  const { user, claims } = await getSessionClaims()
  if (!user || claims?.role !== 'admin') throw new Error('Unauthorized')

  const db = createAdminClient()
  const { data } = await db
    .from('tenants')
    .select('status, cancel_at')
    .eq('id', claims.tenant_id!)
    .single()

  return { status: data?.status ?? 'active', cancelAt: data?.cancel_at ?? null }
}

export async function initiateAccountCancellation(): Promise<{ error: string | null }> {
  const { user, claims } = await getSessionClaims()
  if (!user || claims?.role !== 'admin') return { error: 'Unauthorized' }

  const db = createAdminClient()
  const tenantId = claims.tenant_id!

  const [{ data: tenant }, { data: adminUser }] = await Promise.all([
    db.from('tenants').select('name, status').eq('id', tenantId).single(),
    db.from('users').select('full_name, email').eq('id', user.id).single(),
  ])

  if (!tenant) return { error: 'Tenant not found' }
  if (tenant.status === 'cancelling') return { error: 'Account is already being cancelled' }

  const cancelAt = new Date(Date.now() + COOLING_OFF_DAYS * 86_400_000)

  const { error } = await db
    .from('tenants')
    .update({ status: 'cancelling', cancel_at: cancelAt.toISOString() })
    .eq('id', tenantId)

  if (error) return { error: error.message }

  const adminName = adminUser?.full_name ?? adminUser?.email ?? user.email ?? 'Admin'
  const adminEmail = adminUser?.email ?? user.email!

  await logAuditEvent(db, {
    tenantId,
    actorId: user.id,
    action: 'account_cancellation_initiated',
    targetType: 'tenant',
    targetId: tenantId,
    targetLabel: tenant.name,
    description: `Account cancellation initiated. Data will be permanently deleted on ${cancelAt.toLocaleDateString('en-GB')}.`,
    metadata: { cancelAt: cancelAt.toISOString() },
  })

  // Fire confirmation email + data export attachments (non-blocking)
  void (async () => {
    try {
      const csvs = await buildExportCsvs(db, tenantId)
      await sendCancellationConfirmEmail({
        recipientEmail: adminEmail,
        tenantId,
        adminName,
        orgName: tenant.name,
        cancelAt,
        csvs,
      })
    } catch (err) {
      console.error('[cancellation] Failed to send confirmation email:', err)
    }
  })()

  revalidatePath('/settings')
  return { error: null }
}

export async function undoCancellation(): Promise<{ error: string | null }> {
  const { user, claims } = await getSessionClaims()
  if (!user || claims?.role !== 'admin') return { error: 'Unauthorized' }

  const db = createAdminClient()
  const tenantId = claims.tenant_id!

  const [{ data: tenant }, { data: adminUser }] = await Promise.all([
    db.from('tenants').select('name, status, cancel_at').eq('id', tenantId).single(),
    db.from('users').select('full_name, email').eq('id', user.id).single(),
  ])

  if (!tenant) return { error: 'Tenant not found' }
  if (tenant.status !== 'cancelling') return { error: 'Account is not being cancelled' }
  if (tenant.cancel_at && new Date(tenant.cancel_at) < new Date()) {
    return { error: 'Cancellation window has expired — contact support' }
  }

  const { error } = await db
    .from('tenants')
    .update({ status: 'active', cancel_at: null })
    .eq('id', tenantId)

  if (error) return { error: error.message }

  const adminName = adminUser?.full_name ?? adminUser?.email ?? user.email ?? 'Admin'
  const adminEmail = adminUser?.email ?? user.email!

  await logAuditEvent(db, {
    tenantId,
    actorId: user.id,
    action: 'account_cancellation_reversed',
    targetType: 'tenant',
    targetId: tenantId,
    targetLabel: tenant.name,
    description: 'Account cancellation reversed. Account is active again.',
  })

  void sendCancellationReversedEmail({
    recipientEmail: adminEmail,
    tenantId,
    adminName,
    orgName: tenant.name,
  })

  revalidatePath('/settings')
  return { error: null }
}
