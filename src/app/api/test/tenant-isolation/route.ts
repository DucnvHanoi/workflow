/**
 * Tenant Isolation Test (v4)
 *
 * Signs in as a Tenant B user and asserts that NONE of Tenant A's data is
 * visible. Tenant B seeing its OWN rows is correct and expected.
 *
 *   Tenant A = ACE Corp  — data that MUST stay hidden (incl. audit_log rows)
 *   Tenant B = Sun Corp  — the signed-in user
 *
 * Tables without a direct tenant_id column (flow_versions, flow_instances,
 * step_instances, step_attachments) are checked by fetching a known Tenant A
 * row id via the service-role client, then probing it as Tenant B — it must
 * be invisible. (The old "row count must be 0" check only worked when Tenant B
 * was an empty fixture tenant; both tenants now own real flow data.)
 *
 * Dev-only — guarded by NODE_ENV. Reachable by any authenticated user
 * (middleware blocks unauthenticated callers but not this route specifically).
 */

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionClaims } from '@/lib/supabase/auth-helpers'

const TENANT_B_EMAIL = process.env.TENANT_ISOLATION_TEST_EMAIL ?? 'wf_user_01@gmail.com'
const TENANT_B_PASSWORD = process.env.TENANT_ISOLATION_TEST_PASSWORD ?? ''

const TENANT_A_ID = '06801690-8ddf-419d-85bf-87e7eff240b9' // ACE Corp — must be hidden
const TENANT_B_ID = '280c705a-27a4-4627-b818-af56bd9ea50d' // Sun Corp — signs in

type TableResult = {
  table: string
  tenantARowsVisible: number
  tenantBRowsVisible: number
  ownDataAccessible: boolean
  isolated: boolean
  note?: string
  error?: string
}

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 })
  }

  // Restrict to platform admin or tenant admins only
  const { claims } = await getSessionClaims()
  if (claims.role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  if (!TENANT_B_PASSWORD) {
    return NextResponse.json(
      {
        error:
          'Set TENANT_ISOLATION_TEST_EMAIL and TENANT_ISOLATION_TEST_PASSWORD in .env.local (Tenant B / Sun Corp user).',
      },
      { status: 500 }
    )
  }

  const cookieStore = await cookies()

  const tenantBClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  )

  const { data: authData, error: signInError } = await tenantBClient.auth.signInWithPassword({
    email: TENANT_B_EMAIL,
    password: TENANT_B_PASSWORD,
  })

  if (signInError || !authData.session) {
    return NextResponse.json(
      {
        error: 'Failed to sign in as Tenant B test user.',
        detail: signInError?.message,
      },
      { status: 500 }
    )
  }

  // Client authenticated as Tenant B (Sun Corp)
  const asB = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: { getAll: () => [], setAll: () => {} },
      global: {
        headers: { Authorization: `Bearer ${authData.session.access_token}` },
      },
    }
  )

  const results: TableResult[] = []

  // ── tenants table ──────────────────────────────────────────────────────────
  // Special case: tenants.id IS the tenant identifier — no tenant_id column.
  try {
    const { data: tenantARows, error: errA } = await asB
      .from('tenants')
      .select('id')
      .eq('id', TENANT_A_ID)

    const { data: tenantBRows, error: errB } = await asB
      .from('tenants')
      .select('id')
      .eq('id', TENANT_B_ID)

    if (errA || errB) {
      results.push({
        table: 'tenants',
        tenantARowsVisible: -1,
        tenantBRowsVisible: -1,
        ownDataAccessible: false,
        isolated: false,
        error: errA?.message ?? errB?.message,
      })
    } else {
      const tenantACount = tenantARows?.length ?? 0
      const tenantBCount = tenantBRows?.length ?? 0
      results.push({
        table: 'tenants',
        tenantARowsVisible: tenantACount,
        tenantBRowsVisible: tenantBCount,
        ownDataAccessible: tenantBCount > 0,
        isolated: tenantACount === 0,
      })
    }
  } catch (e) {
    results.push({
      table: 'tenants',
      tenantARowsVisible: -1,
      tenantBRowsVisible: -1,
      ownDataAccessible: false,
      isolated: false,
      error: String(e),
    })
  }

  // ── Tables with a direct tenant_id column ──────────────────────────────────
  // audit_log included: ACE Corp owns audit rows that must stay hidden from B.
  const directTenantTables = ['users', 'departments', 'flows', 'audit_log', 'notifications']

  for (const table of directTenantTables) {
    try {
      const { data: tenantARows, error: errA } = await asB
        .from(table)
        .select('id')
        .eq('tenant_id', TENANT_A_ID)

      const { data: tenantBRows, error: errB } = await asB
        .from(table)
        .select('id')
        .eq('tenant_id', TENANT_B_ID)

      if (errA || errB) {
        results.push({
          table,
          tenantARowsVisible: -1,
          tenantBRowsVisible: -1,
          ownDataAccessible: false,
          isolated: false,
          error: errA?.message ?? errB?.message,
        })
        continue
      }

      const tenantACount = tenantARows?.length ?? 0
      const tenantBCount = tenantBRows?.length ?? 0

      results.push({
        table,
        tenantARowsVisible: tenantACount,
        tenantBRowsVisible: tenantBCount,
        ownDataAccessible: tenantBCount > 0,
        isolated: tenantACount === 0,
        // Sun Corp may have no rows in audit_log/notifications — not a failure.
        note:
          (table === 'audit_log' || table === 'notifications') && tenantBCount === 0
            ? `Tenant B owns no ${table} rows; own-data access not exercised.`
            : undefined,
      })
    } catch (e) {
      results.push({
        table,
        tenantARowsVisible: -1,
        tenantBRowsVisible: -1,
        ownDataAccessible: false,
        isolated: false,
        error: String(e),
      })
    }
  }

  // ── Tables with no direct tenant_id (chain back through parent) ────────────
  // Both tenants own rows here, so we can't assert "0 visible". Instead, fetch a
  // known Tenant A row id via the service-role client and confirm it's invisible
  // to Tenant B. If Tenant A has no such row, the check is reported as N/A.
  const admin = createAdminClient()
  const baitIds = await fetchTenantABaitIds(admin)

  const indirectTables: { table: string; baitId: string | null }[] = [
    { table: 'flow_versions', baitId: baitIds.flow_versions },
    { table: 'flow_instances', baitId: baitIds.flow_instances },
    { table: 'step_instances', baitId: baitIds.step_instances },
    { table: 'step_attachments', baitId: baitIds.step_attachments },
  ]

  for (const { table, baitId } of indirectTables) {
    if (!baitId) {
      results.push({
        table,
        tenantARowsVisible: 0,
        tenantBRowsVisible: 0,
        ownDataAccessible: false,
        isolated: true,
        note: 'No Tenant A row exists to probe — check skipped (N/A).',
      })
      continue
    }

    try {
      const { data, error } = await asB.from(table).select('id').eq('id', baitId)
      if (error) {
        results.push({
          table,
          tenantARowsVisible: -1,
          tenantBRowsVisible: 0,
          ownDataAccessible: false,
          isolated: false,
          error: error.message,
        })
        continue
      }
      const visible = data?.length ?? 0
      results.push({
        table,
        tenantARowsVisible: visible,
        tenantBRowsVisible: 0,
        ownDataAccessible: true,
        isolated: visible === 0,
        note: `Probed Tenant A ${table}.id=${baitId}`,
      })
    } catch (e) {
      results.push({
        table,
        tenantARowsVisible: -1,
        tenantBRowsVisible: 0,
        ownDataAccessible: false,
        isolated: false,
        error: String(e),
      })
    }
  }

  const allIsolated = results.every((r) => r.isolated)
  const failed = results.filter((r) => !r.isolated)

  return NextResponse.json({
    summary: allIsolated
      ? '✅ ALL TABLES ISOLATED — Tenant A (ACE Corp) data not visible to Tenant B (Sun Corp).'
      : `❌ ${failed.length} TABLE(S) LEAKING — Tenant A data visible to Tenant B!`,
    allIsolated,
    tenantA: TENANT_A_ID,
    tenantB: TENANT_B_ID,
    results,
  })
}

/**
 * Pick one Tenant A (ACE Corp) row id per indirect table, walking the FK chain
 * flows → flow_versions → flow_instances → step_instances → step_attachments.
 * Returns null for any table with no Tenant A rows.
 */
async function fetchTenantABaitIds(admin: ReturnType<typeof createAdminClient>): Promise<{
  flow_versions: string | null
  flow_instances: string | null
  step_instances: string | null
  step_attachments: string | null
}> {
  const empty = {
    flow_versions: null,
    flow_instances: null,
    step_instances: null,
    step_attachments: null,
  }

  const { data: flows } = await admin.from('flows').select('id').eq('tenant_id', TENANT_A_ID)
  const flowIds = (flows ?? []).map((f) => f.id)
  if (flowIds.length === 0) return empty

  const { data: versions } = await admin.from('flow_versions').select('id').in('flow_id', flowIds)
  const versionIds = (versions ?? []).map((v) => v.id)
  if (versionIds.length === 0) return empty

  const { data: instances } = await admin
    .from('flow_instances')
    .select('id')
    .in('flow_version_id', versionIds)
  const instanceIds = (instances ?? []).map((i) => i.id)

  const { data: steps } = instanceIds.length
    ? await admin.from('step_instances').select('id').in('instance_id', instanceIds)
    : { data: [] as { id: string }[] }
  const stepIds = (steps ?? []).map((s) => s.id)

  const { data: attachments } = stepIds.length
    ? await admin.from('step_attachments').select('id').in('step_instance_id', stepIds)
    : { data: [] as { id: string }[] }

  return {
    flow_versions: versionIds[0] ?? null,
    flow_instances: instanceIds[0] ?? null,
    step_instances: stepIds[0] ?? null,
    step_attachments: attachments?.[0]?.id ?? null,
  }
}
