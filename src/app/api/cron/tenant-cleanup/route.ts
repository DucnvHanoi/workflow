import { type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { safeEqual } from '@/lib/security/secret'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const secret = authHeader?.replace('Bearer ', '')
  if (!process.env.CRON_SECRET || !safeEqual(secret, process.env.CRON_SECRET)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createAdminClient()
  const now = new Date().toISOString()

  const { data: tenants, error } = await db
    .from('tenants')
    .select('id, name')
    .eq('status', 'cancelling')
    .lt('cancel_at', now)

  if (error) {
    console.error('[cron/tenant-cleanup] Failed to query cancelling tenants:', error.message)
    return Response.json({ error: error.message }, { status: 500 })
  }

  if (!tenants?.length) {
    return Response.json({ processed: 0, deleted: 0 })
  }

  let deleted = 0
  let failed = 0

  for (const tenant of tenants) {
    try {
      // 1. Collect all user IDs before deleting (public.users cascades with tenant row)
      const { data: tenantUsers } = await db.from('users').select('id').eq('tenant_id', tenant.id)

      // 2. Delete each Supabase Auth user (separate from public.users)
      for (const u of tenantUsers ?? []) {
        const { error: authErr } = await db.auth.admin.deleteUser(u.id)
        if (authErr) {
          console.error(
            `[cron/tenant-cleanup] Auth delete failed for user ${u.id}:`,
            authErr.message
          )
        }
      }

      // 3. Delete tenant row — cascades to all public schema tables
      const { error: deleteErr } = await db.from('tenants').delete().eq('id', tenant.id)

      if (deleteErr) {
        console.error(
          `[cron/tenant-cleanup] Failed to delete tenant ${tenant.name} (${tenant.id}):`,
          deleteErr.message
        )
        failed++
      } else {
        console.log(`[cron/tenant-cleanup] Deleted tenant: ${tenant.name} (${tenant.id})`)
        deleted++
      }
    } catch (err) {
      console.error(
        `[cron/tenant-cleanup] Unexpected error for tenant ${tenant.id}:`,
        err instanceof Error ? err.message : err
      )
      failed++
    }
  }

  return Response.json({ processed: tenants.length, deleted, failed })
}
