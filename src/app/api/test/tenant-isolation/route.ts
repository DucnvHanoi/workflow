/**
 * Day 22 — Tenant Isolation Test (v3)
 *
 * Checks that Tenant B CANNOT see any of Tenant A's data.
 * Tenant B seeing their OWN rows is correct and expected.
 *
 * REMOVE or keep NODE_ENV guard before production deploy.
 */

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

const TENANT_B_EMAIL = 'tenant_b_user@test.com'
const TENANT_B_PASSWORD = 'TestPassword123!'

const TENANT_A_ID = '280c705a-27a4-4627-b818-af56bd9ea50d'
const TENANT_B_ID = 'aaaaaaaa-0000-0000-0000-000000000000'

type TableResult = {
  table: string
  tenantARowsVisible: number
  tenantBRowsVisible: number
  ownDataAccessible: boolean
  isolated: boolean
  error?: string
}

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 })
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

  // Client authenticated as Tenant B
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
  const directTenantTables = ['users', 'departments', 'flows']

  for (const table of directTenantTables) {
    try {
      const { data: tenantARows, error: errA } = await asB
        .from(table)
        .select('id, tenant_id')
        .eq('tenant_id', TENANT_A_ID)

      const { data: tenantBRows, error: errB } = await asB
        .from(table)
        .select('id, tenant_id')
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
  // Tenant B has no data in these tables, so any visible row = Tenant A leak.
  const indirectTables = ['flow_versions', 'flow_instances', 'step_instances', 'step_attachments']

  for (const table of indirectTables) {
    try {
      const { data, error } = await asB.from(table).select('id')
      if (error) {
        results.push({
          table,
          tenantARowsVisible: -1,
          tenantBRowsVisible: 0,
          ownDataAccessible: true,
          isolated: false,
          error: error.message,
        })
        continue
      }
      const count = data?.length ?? 0
      results.push({
        table,
        tenantARowsVisible: count,
        tenantBRowsVisible: 0,
        ownDataAccessible: true,
        isolated: count === 0,
      })
    } catch (e) {
      results.push({
        table,
        tenantARowsVisible: -1,
        tenantBRowsVisible: 0,
        ownDataAccessible: true,
        isolated: false,
        error: String(e),
      })
    }
  }

  const allIsolated = results.every((r) => r.isolated)
  const failed = results.filter((r) => !r.isolated)

  return NextResponse.json({
    summary: allIsolated
      ? '✅ ALL TABLES ISOLATED — Tenant A data not visible to Tenant B.'
      : `❌ ${failed.length} TABLE(S) LEAKING — Tenant A data visible to Tenant B!`,
    allIsolated,
    results,
  })
}
