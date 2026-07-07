import { type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { safeEqual } from '@/lib/security/secret'
import {
  sendDripConfirmEmail,
  sendDripTeamWaitingEmail,
  sendDripGoLiveEmail,
  sendDripWeekTwoTipsEmail,
} from '@/lib/email/resend'

const DAY_MS = 86_400_000

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const secret = authHeader?.replace('Bearer ', '')
  if (!process.env.CRON_SECRET || !safeEqual(secret, process.env.CRON_SECRET)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createAdminClient()
  const now = new Date()

  // 1. All active tenants created within any drip window (0–20 days)
  const windowStart = new Date(now.getTime() - 20 * DAY_MS).toISOString()
  const { data: tenants, error: tenantsError } = await db
    .from('tenants')
    .select('id, name, created_at')
    .eq('status', 'active')
    .gte('created_at', windowStart)

  if (tenantsError) {
    console.error('[cron/drip] Failed to fetch tenants:', tenantsError.message)
    return Response.json({ error: tenantsError.message }, { status: 500 })
  }
  if (!tenants?.length) {
    return Response.json({ processed: 0, emailsSent: 0 })
  }

  const tenantIds = tenants.map((t) => t.id)

  // 2. Bulk data fetch — all queries in parallel
  const [
    sentDripsResult,
    adminsResult,
    authUsersResult,
    pendingInvitesResult,
    activeUsersResult,
    publishedFlowsResult,
    instancesResult,
  ] = await Promise.all([
    db
      .from('notification_logs')
      .select('tenant_id, email_type')
      .in('tenant_id', tenantIds)
      .like('email_type', 'drip_%'),

    db
      .from('users')
      .select('id, tenant_id, email, full_name')
      .in('tenant_id', tenantIds)
      .eq('role', 'admin')
      .eq('is_active', true)
      .order('created_at', { ascending: true }),

    db.auth.admin.listUsers({ perPage: 1000 }),

    db
      .from('pending_invitations')
      .select('tenant_id')
      .in('tenant_id', tenantIds)
      .eq('status', 'pending'),

    db.from('users').select('tenant_id').in('tenant_id', tenantIds).eq('is_active', true),

    db
      .from('flows')
      .select('tenant_id, name')
      .in('tenant_id', tenantIds)
      .eq('status', 'published')
      .order('created_at', { ascending: true }),

    db.from('flow_instances').select('tenant_id').in('tenant_id', tenantIds),
  ])

  // 3. Build lookup structures
  const sentSet = new Set((sentDripsResult.data ?? []).map((r) => `${r.tenant_id}:${r.email_type}`))

  // First admin per tenant (rows are already ordered by created_at asc)
  const adminByTenant = new Map<string, { id: string; email: string; full_name: string }>()
  for (const u of adminsResult.data ?? []) {
    if (!adminByTenant.has(u.tenant_id)) {
      adminByTenant.set(u.tenant_id, { id: u.id, email: u.email, full_name: u.full_name })
    }
  }

  // email_confirmed_at by auth user id
  const confirmMap = new Map<string, string | null>()
  for (const u of authUsersResult.data?.users ?? []) {
    confirmMap.set(u.id, u.email_confirmed_at ?? null)
  }

  // Pending invitation count per tenant
  const pendingInviteCount = new Map<string, number>()
  for (const r of pendingInvitesResult.data ?? []) {
    pendingInviteCount.set(r.tenant_id, (pendingInviteCount.get(r.tenant_id) ?? 0) + 1)
  }

  // Active user count per tenant
  const activeUserCount = new Map<string, number>()
  for (const r of activeUsersResult.data ?? []) {
    activeUserCount.set(r.tenant_id, (activeUserCount.get(r.tenant_id) ?? 0) + 1)
  }

  // First published flow name per tenant
  const firstPublishedFlow = new Map<string, string>()
  for (const f of publishedFlowsResult.data ?? []) {
    if (!firstPublishedFlow.has(f.tenant_id)) {
      firstPublishedFlow.set(f.tenant_id, f.name)
    }
  }

  // Tenants that have at least one flow instance
  const hasInstances = new Set<string>()
  for (const r of instancesResult.data ?? []) {
    hasInstances.add(r.tenant_id)
  }

  // 4. Evaluate and send
  const sends: Promise<void>[] = []
  let emailsSent = 0

  for (const tenant of tenants) {
    const admin = adminByTenant.get(tenant.id)
    if (!admin) continue

    const ageDays = (now.getTime() - new Date(tenant.created_at).getTime()) / DAY_MS
    const adminName = admin.full_name || admin.email.split('@')[0]

    // Drip 1 — Days 1–3: confirm email
    if (ageDays >= 1 && ageDays <= 3) {
      const key = `${tenant.id}:drip_day1_confirm_email`
      if (!sentSet.has(key) && !confirmMap.get(admin.id)) {
        sends.push(
          sendDripConfirmEmail({
            recipientEmail: admin.email,
            tenantId: tenant.id,
            adminName,
            adminEmail: admin.email,
          })
        )
        emailsSent++
      }
    }

    // Drip 2 — Days 2–5: team waiting (invites sent, nobody accepted)
    if (ageDays >= 2 && ageDays <= 5) {
      const key = `${tenant.id}:drip_day2_team_waiting`
      const pending = pendingInviteCount.get(tenant.id) ?? 0
      const active = activeUserCount.get(tenant.id) ?? 0
      if (!sentSet.has(key) && pending > 0 && active <= 1) {
        sends.push(
          sendDripTeamWaitingEmail({
            recipientEmail: admin.email,
            tenantId: tenant.id,
            adminName,
            pendingCount: pending,
          })
        )
        emailsSent++
      }
    }

    // Drip 3 — Days 5–9: has published flow but never triggered one
    if (ageDays >= 5 && ageDays <= 9) {
      const key = `${tenant.id}:drip_day5_go_live`
      const flowName = firstPublishedFlow.get(tenant.id)
      if (!sentSet.has(key) && flowName && !hasInstances.has(tenant.id)) {
        sends.push(
          sendDripGoLiveEmail({
            recipientEmail: admin.email,
            tenantId: tenant.id,
            adminName,
            flowName,
          })
        )
        emailsSent++
      }
    }

    // Drip 4 — Days 14–20: advanced tips (unconditional)
    if (ageDays >= 14 && ageDays <= 20) {
      const key = `${tenant.id}:drip_week2_tips`
      if (!sentSet.has(key)) {
        sends.push(
          sendDripWeekTwoTipsEmail({
            recipientEmail: admin.email,
            tenantId: tenant.id,
            adminName,
            orgName: tenant.name,
          })
        )
        emailsSent++
      }
    }
  }

  await Promise.all(sends)

  return Response.json({ processed: tenants.length, emailsSent })
}
