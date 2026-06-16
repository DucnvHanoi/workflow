/**
 * End-to-end verification of Phase 19 M2: REST API trigger + instance GET.
 *
 * Tests (no browser required — pure HTTP):
 *   1.  No auth header                    → 401
 *   2.  Invalid Bearer key                → 401
 *   3.  Trigger non-existent flow         → 404
 *   4.  Trigger draft (unpublished) flow  → 400
 *   5.  Trigger a published flow          → 201 + instanceId
 *   6.  GET the returned instance         → 200 + expected shape
 *   7.  GET with wrong-tenant key         → 404 (tenant isolation)
 *   8.  Revoked key                       → 401
 *   9.  POST body formData forwarded      → 201 (formData prefill stored)
 *
 * Usage:
 *   node --env-file=.env.local scripts/verify-api-v1.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { createHash, randomBytes } from 'crypto'

const SUPABASE_URL = 'https://qdngvdffqsnqikqbhkmw.supabase.co'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const APP_URL = process.env.NEXT_PUBLIC_SITE_URL?.startsWith('http')
  ? process.env.NEXT_PUBLIC_SITE_URL.replace('https://', 'http://localhost').replace(':443', '')
  : 'http://localhost:3000'

// Override to always target local dev server
const BASE_URL = 'http://localhost:3000'

if (!SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not set. Run: node --env-file=.env.local scripts/verify-api-v1.mjs')
  process.exit(1)
}

const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// Known test tenant (ACE Corp)
const TENANT_A_ID = '06801690-8ddf-419d-85bf-87e7eff240b9'
// Second tenant (Sun Corp) for isolation test
const TENANT_B_ID = '280c705a-77de-4d62-a27d-f56b5d9d2437'

let createdKeyIds = []
let createdInstanceIds = []

// ─── helpers ──────────────────────────────────────────────────────────────────

function makeRawKey() {
  return randomBytes(32).toString('hex')
}
function hashKey(raw) {
  return createHash('sha256').update(raw).digest('hex')
}

async function createApiKey(tenantId, label, revoked = false) {
  // Find a user in this tenant to use as created_by
  const { data: user } = await db
    .from('users')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('role', 'admin')
    .limit(1)
    .maybeSingle()

  if (!user) throw new Error(`No admin user found for tenant ${tenantId}`)

  const raw = makeRawKey()
  const { data, error } = await db
    .from('tenant_api_keys')
    .insert({
      tenant_id: tenantId,
      name: label,
      key_hash: hashKey(raw),
      created_by: user.id,
      revoked_at: revoked ? new Date().toISOString() : null,
    })
    .select('id')
    .single()

  if (error) throw new Error(`Failed to create API key: ${error.message}`)
  createdKeyIds.push(data.id)
  return { raw, id: data.id }
}

async function findPublishedFlow(tenantId) {
  const { data } = await db
    .from('flows')
    .select('id, name, status, latest_version_id')
    .eq('tenant_id', tenantId)
    .eq('status', 'published')
    .not('latest_version_id', 'is', null)
    .limit(1)
    .maybeSingle()
  return data
}

async function findDraftFlow(tenantId) {
  const { data } = await db
    .from('flows')
    .select('id, name, status')
    .eq('tenant_id', tenantId)
    .eq('status', 'draft')
    .limit(1)
    .maybeSingle()
  return data
}

async function cleanup() {
  if (createdKeyIds.length > 0) {
    await db.from('tenant_api_keys').delete().in('id', createdKeyIds)
    console.log(`   Cleaned up ${createdKeyIds.length} API key(s)`)
  }
  if (createdInstanceIds.length > 0) {
    await db.from('flow_instances').delete().in('id', createdInstanceIds)
    console.log(`   Cleaned up ${createdInstanceIds.length} instance(s)`)
  }
}

// ─── test helpers ─────────────────────────────────────────────────────────────

let passed = 0
let failed = 0

function assert(label, condition, detail = '') {
  if (condition) {
    console.log(`   ✅ ${label}`)
    passed++
  } else {
    console.error(`   ❌ ${label}${detail ? ' — ' + detail : ''}`)
    failed++
  }
}

async function post(path, rawKey, body) {
  const headers = { 'Content-Type': 'application/json' }
  if (rawKey) headers['Authorization'] = `Bearer ${rawKey}`
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  let json
  try { json = await res.json() } catch { json = null }
  return { status: res.status, json }
}

async function get(path, rawKey) {
  const headers = {}
  if (rawKey) headers['Authorization'] = `Bearer ${rawKey}`
  const res = await fetch(`${BASE_URL}${path}`, { headers })
  let json
  try { json = await res.json() } catch { json = null }
  return { status: res.status, json }
}

// ─── wait for local server ────────────────────────────────────────────────────

async function waitForServer(maxMs = 30000) {
  const start = Date.now()
  while (Date.now() - start < maxMs) {
    try {
      const r = await fetch(`${BASE_URL}/api/health`, { signal: AbortSignal.timeout(2000) })
      if (r.status < 500) return true
    } catch {
      // not ready yet
    }
    await new Promise(r => setTimeout(r, 1500))
  }
  // Try the root as fallback
  try {
    const r = await fetch(`${BASE_URL}/`, { signal: AbortSignal.timeout(3000) })
    return r.status < 500
  } catch {
    return false
  }
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════════')
  console.log(' Phase 19 M2 — REST API Verification')
  console.log(`  Target: ${BASE_URL}`)
  console.log('═══════════════════════════════════════════════════════\n')

  // Check server is up
  console.log('── Waiting for local dev server ──')
  const serverReady = await waitForServer(30000)
  if (!serverReady) {
    console.error('❌ Dev server not responding at', BASE_URL)
    console.error('   Start it with: npm run dev')
    process.exit(1)
  }
  console.log('✅ Dev server is up\n')

  // ── Setup ────────────────────────────────────────────────────────────────

  console.log('── Setup: creating test fixtures ──')

  // Tenant A API key (valid)
  const keyA = await createApiKey(TENANT_A_ID, 'verify-api-v1-test')
  console.log(`   Created API key for Tenant A: ${keyA.id.slice(0, 8)}…`)

  // Tenant A revoked key
  const revokedKey = await createApiKey(TENANT_A_ID, 'verify-api-v1-revoked', true)
  console.log(`   Created revoked API key: ${revokedKey.id.slice(0, 8)}…`)

  // Tenant B API key (for isolation test)
  let keyB = null
  try {
    keyB = await createApiKey(TENANT_B_ID, 'verify-api-v1-tenantB')
    console.log(`   Created API key for Tenant B: ${keyB.id.slice(0, 8)}…`)
  } catch (e) {
    console.warn('   ⚠️  Could not create Tenant B key:', e.message, '— isolation test will be skipped')
  }

  // Find a published flow in Tenant A
  const publishedFlow = await findPublishedFlow(TENANT_A_ID)
  if (!publishedFlow) {
    console.error('❌ No published flow found in Tenant A — publish a flow first')
    await cleanup()
    process.exit(1)
  }
  console.log(`   Published flow: "${publishedFlow.name}" (${publishedFlow.id.slice(0, 8)}…)`)

  // Find a draft flow in Tenant A
  const draftFlow = await findDraftFlow(TENANT_A_ID)
  if (draftFlow) {
    console.log(`   Draft flow: "${draftFlow.name}" (${draftFlow.id.slice(0, 8)}…)`)
  } else {
    console.log('   No draft flow found — draft test will use a random UUID')
  }

  console.log()

  // ── Test 1: No auth header → 401 ─────────────────────────────────────────
  console.log('── Test 1: No Authorization header ──')
  {
    const { status, json } = await post(`/api/v1/flows/${publishedFlow.id}/trigger`, null, {})
    assert('POST returns 401', status === 401, `got ${status}`)
    assert('Error message present', typeof json?.error === 'string', JSON.stringify(json))
  }

  // ── Test 2: Invalid Bearer key → 401 ─────────────────────────────────────
  console.log('\n── Test 2: Invalid Bearer key ──')
  {
    const { status, json } = await post(`/api/v1/flows/${publishedFlow.id}/trigger`, 'not-a-real-key', {})
    assert('POST returns 401', status === 401, `got ${status}`)
    assert('Error message present', typeof json?.error === 'string', JSON.stringify(json))
  }

  // ── Test 3: Trigger non-existent flow → 404 ──────────────────────────────
  console.log('\n── Test 3: Trigger a non-existent flow ID ──')
  {
    const fakeId = '00000000-0000-0000-0000-000000000000'
    const { status, json } = await post(`/api/v1/flows/${fakeId}/trigger`, keyA.raw, {})
    assert('POST returns 404', status === 404, `got ${status}`)
    assert('Error message present', typeof json?.error === 'string', JSON.stringify(json))
  }

  // ── Test 4: Trigger draft flow → 400 ─────────────────────────────────────
  if (draftFlow) {
    console.log('\n── Test 4: Trigger a draft (unpublished) flow ──')
    const { status, json } = await post(`/api/v1/flows/${draftFlow.id}/trigger`, keyA.raw, {})
    assert('POST returns 400', status === 400, `got ${status}`)
    assert('Error mentions published', /published/i.test(json?.error ?? ''), JSON.stringify(json))
  } else {
    console.log('\n── Test 4: SKIPPED (no draft flow available) ──')
  }

  // ── Test 5: Trigger a published flow → 201 ───────────────────────────────
  console.log('\n── Test 5: Trigger a published flow (happy path) ──')
  let instanceId = null
  {
    const { status, json } = await post(`/api/v1/flows/${publishedFlow.id}/trigger`, keyA.raw, {})
    assert('POST returns 201', status === 201, `got ${status}`)
    assert('instanceId in response', typeof json?.instanceId === 'string', JSON.stringify(json))
    assert('status in response', ['pending', 'completed'].includes(json?.status), JSON.stringify(json))
    assert('detailUrl in response', typeof json?.detailUrl === 'string', JSON.stringify(json))
    instanceId = json?.instanceId
    if (instanceId) createdInstanceIds.push(instanceId)
    console.log(`   instanceId: ${instanceId?.slice(0, 8)}… status: ${json?.status}`)
  }

  // ── Test 6: GET the instance → 200 ───────────────────────────────────────
  if (instanceId) {
    console.log('\n── Test 6: GET /api/v1/instances/:instanceId ──')
    const { status, json } = await get(`/api/v1/instances/${instanceId}`, keyA.raw)
    assert('GET returns 200', status === 200, `got ${status}`)
    assert('instanceId matches', json?.instanceId === instanceId, JSON.stringify(json))
    assert('flowId present', typeof json?.flowId === 'string', JSON.stringify(json))
    assert('flowName present', typeof json?.flowName === 'string', JSON.stringify(json))
    assert('status present', typeof json?.status === 'string', JSON.stringify(json))
    assert('createdAt present', typeof json?.createdAt === 'string', JSON.stringify(json))
    assert('currentStep field exists', 'currentStep' in (json ?? {}), JSON.stringify(json))
    console.log(`   flow: "${json?.flowName}" status: ${json?.status}`)
  }

  // ── Test 7: Tenant isolation — Tenant B key cannot GET Tenant A instance ──
  if (keyB && instanceId) {
    console.log('\n── Test 7: Tenant isolation — wrong-tenant key ──')
    const { status, json } = await get(`/api/v1/instances/${instanceId}`, keyB.raw)
    assert('GET returns 404 (not 200)', status === 404, `got ${status} — ${JSON.stringify(json)}`)
  } else {
    console.log('\n── Test 7: SKIPPED (no Tenant B key) ──')
  }

  // ── Test 7b: Tenant isolation — Tenant B key cannot TRIGGER Tenant A flow ──
  if (keyB) {
    console.log('\n── Test 7b: Tenant isolation — wrong-tenant key on trigger ──')
    const { status } = await post(`/api/v1/flows/${publishedFlow.id}/trigger`, keyB.raw, {})
    assert('POST returns 404 (not 201)', status === 404, `got ${status}`)
  }

  // ── Test 8: Revoked key → 401 ─────────────────────────────────────────────
  console.log('\n── Test 8: Revoked API key ──')
  {
    const { status, json } = await post(`/api/v1/flows/${publishedFlow.id}/trigger`, revokedKey.raw, {})
    assert('POST returns 401', status === 401, `got ${status}`)
    assert('Error mentions revoked', /revoked/i.test(json?.error ?? ''), JSON.stringify(json))
  }

  // ── Test 9: formData prefill forwarded ────────────────────────────────────
  console.log('\n── Test 9: POST with formData body ──')
  {
    const body = { formData: { field_1: 'Annual Leave', field_2: 'test value' } }
    const { status, json } = await post(`/api/v1/flows/${publishedFlow.id}/trigger`, keyA.raw, body)
    assert('POST returns 201', status === 201, `got ${status}`)
    if (json?.instanceId) createdInstanceIds.push(json.instanceId)

    // Verify formData was stored in the step_instance
    if (json?.instanceId && json?.status === 'pending') {
      const { data: si } = await db
        .from('step_instances')
        .select('form_data')
        .eq('instance_id', json.instanceId)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()
      const stored = si?.form_data ?? {}
      const hasData = Object.keys(stored).length > 0
      assert('formData stored in step_instance', hasData, JSON.stringify(stored))
    } else if (json?.status === 'completed') {
      console.log('   ⚠️  Flow completed instantly — no step_instance to check formData')
    }
  }

  // ── GET without auth → 401 ────────────────────────────────────────────────
  console.log('\n── Test 10: GET instance with no auth ──')
  if (instanceId) {
    const { status } = await get(`/api/v1/instances/${instanceId}`, null)
    assert('GET returns 401', status === 401, `got ${status}`)
  }

  // ── Verify flow_event_log recorded api source ─────────────────────────────
  console.log('\n── Test 11: Event log records API source ──')
  if (instanceId) {
    const { data: logs } = await db
      .from('flow_event_logs')
      .select('event_type, description, metadata')
      .eq('instance_id', instanceId)
      .order('created_at', { ascending: true })
    const triggered = logs?.find((l) => l.event_type === 'flow_triggered')
    assert('flow_triggered event exists', !!triggered, JSON.stringify(logs?.map(l => l.event_type)))
    assert('metadata.source = api', triggered?.metadata?.source === 'api', JSON.stringify(triggered?.metadata))
    assert('description mentions REST API', /REST API/i.test(triggered?.description ?? ''), triggered?.description)
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════')
  console.log(` Results: ${passed} passed, ${failed} failed`)
  console.log('═══════════════════════════════════════════════════════\n')

  await cleanup()

  if (failed > 0) process.exit(1)
}

main().catch(async (e) => {
  console.error('\n❌ Unhandled error:', e.message)
  await cleanup().catch(() => {})
  process.exit(1)
})
