import { createAdminClient } from '@/lib/supabase/admin'

const HOUR_MS = 60 * 60 * 1000

async function countRecent(key: string): Promise<number> {
  const db = createAdminClient()
  const since = new Date(Date.now() - HOUR_MS).toISOString()
  const { count } = await db
    .from('rate_limit_log')
    .select('*', { count: 'exact', head: true })
    .eq('key', key)
    .gte('created_at', since)
  return count ?? 0
}

async function logAttempt(key: string): Promise<void> {
  const db = createAdminClient()
  const cutoff = new Date(Date.now() - 2 * HOUR_MS).toISOString()
  await Promise.all([
    db.from('rate_limit_log').insert({ key }),
    db.from('rate_limit_log').delete().lt('created_at', cutoff),
  ])
}

// 5 new tenant signups per hour per IP
export async function checkSignupRate(ip: string): Promise<boolean> {
  const key = `signup:${ip}`
  const count = await countRecent(key)
  if (count >= 5) return false
  await logAttempt(key)
  return true
}

// 30 invitations per hour per tenant — reads pending_invitations directly
export async function checkInviteRate(tenantId: string): Promise<boolean> {
  const db = createAdminClient()
  const since = new Date(Date.now() - HOUR_MS).toISOString()
  const { count } = await db
    .from('pending_invitations')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .gte('invited_at', since)
  return (count ?? 0) < 30
}
