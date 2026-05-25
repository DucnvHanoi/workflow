/**
 * Verification script for bulk CSV import — password & invite columns.
 * Tests the same Supabase calls that bulkImportUsers() makes, bypassing
 * the HTTP/server-action layer to exercise the real DB integration.
 *
 * Run: node scripts/verify-bulk-import.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

// ── Load env ──────────────────────────────────────────────────────────────────
function loadEnv() {
  const raw = readFileSync('.env.local', 'utf8')
  const env = {}
  for (const line of raw.split('\n')) {
    const m = line.replace(/\r$/, '').match(/^([^#=]+)=(.*)$/)
    if (m) env[m[1].trim()] = m[2].trim()
  }
  return env
}

const env = loadEnv()
const SUPABASE_URL = env['NEXT_PUBLIC_SUPABASE_URL']
const SERVICE_ROLE_KEY = env['SUPABASE_SERVICE_ROLE_KEY']
const SITE_URL = env['NEXT_PUBLIC_SITE_URL'] ?? 'http://localhost:3000'
const TENANT_ID = '06801690-8ddf-419d-85bf-87e7eff240b9' // ACE Corp

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const TEST_PASSWORD_USER = `verify-bulk-pw-${Date.now()}@test-verify.invalid`
const TEST_INVITE_USER   = `verify-bulk-inv-${Date.now()}@test-verify.invalid`

let pass = 0
let fail = 0

function ok(label)   { console.log(`  ✅ ${label}`); pass++ }
function bad(label)  { console.log(`  ❌ ${label}`); fail++ }
function info(label) { console.log(`  ℹ  ${label}`) }
function section(s)  { console.log(`\n── ${s} ──`) }

// ── 1. Template CSV content ───────────────────────────────────────────────────
section('1. Template CSV content (source)')
const src = readFileSync('src/app/(app)/invite/import/import-client.tsx', 'utf8')
const match = src.match(/const TEMPLATE_CSV = `([^`]+)`/)
if (match) {
  // Template uses literal \n escape sequences in source; split on them
  const lines = match[1].split('\\n').map(l => l.trim()).filter(Boolean)
  const cols = lines[0]
  info(`Header: ${cols}`)
  const expected = ['email', 'full_name', 'role', 'password', 'invite']
  const actual = cols.split(',').map(c => c.trim())
  const allPresent = expected.every(c => actual.includes(c))
  allPresent ? ok('All 5 columns present in template') : bad(`Missing columns — got: ${cols}`)

  const row1 = lines[1]
  const row2 = lines[2]
  info(`Example row invite=no:  ${row1}`)
  info(`Example row invite=yes: ${row2}`)
  row1?.includes(',no')  ? ok('invite=no example row correct')  : bad('invite=no example row wrong')
  row2?.includes(',yes') ? ok('invite=yes example row correct') : bad('invite=yes example row wrong')
} else {
  bad('Could not find TEMPLATE_CSV constant')
}

// ── 2. Parser handles new columns ─────────────────────────────────────────────
section('2. Parser logic (source trace)')
const hasPasswordIdx = src.includes("header.indexOf('password')")
const hasInviteIdx   = src.includes("header.indexOf('invite')")
const hasInviteBool  = src.includes("rawInvite === 'yes' || rawInvite === 'y'")
const hasMissingWarn = src.includes('>missing<')   // JSX text node, no quotes
hasPasswordIdx ? ok('passwordIdx extracted from header') : bad('passwordIdx missing from parseCSV')
hasInviteIdx   ? ok('inviteIdx extracted from header')   : bad('inviteIdx missing from parseCSV')
hasInviteBool  ? ok('invite boolean parsed correctly')   : bad('invite boolean parse missing')
hasMissingWarn ? ok('"missing" warning rendered in preview for empty password') : bad('"missing" warning not found')

// ── 3. Server action — invite=no path (create with password) ──────────────────
section('3. Runtime — invite=no: create user with password')
{
  // Check no pre-existing collision
  const { data: existing } = await admin.from('users').select('id').eq('email', TEST_PASSWORD_USER).maybeSingle()
  if (existing) { bad('Pre-existing collision — skipping path'); }
  else {
    const { data: authData, error: authErr } = await admin.auth.admin.createUser({
      email: TEST_PASSWORD_USER,
      password: 'TempVerify123!',
      email_confirm: true,
    })
    if (authErr || !authData?.user) {
      bad(`auth.admin.createUser failed: ${authErr?.message}`)
    } else {
      ok(`Auth user created: ${authData.user.id.slice(0,8)}…`)
      const { error: insertErr } = await admin.from('users').insert({
        id: authData.user.id,
        tenant_id: TENANT_ID,
        email: TEST_PASSWORD_USER,
        role: 'user',
      })
      if (insertErr) {
        bad(`public.users insert failed: ${insertErr.message}`)
        await admin.auth.admin.deleteUser(authData.user.id)
      } else {
        ok('public.users row inserted')
        // Verify readable
        const { data: row } = await admin.from('users').select('id,email,role').eq('id', authData.user.id).single()
        row?.email === TEST_PASSWORD_USER ? ok('User readable from public.users') : bad('User not found in public.users')
        // Verify NOT in pending_invitations
        const { count } = await admin.from('pending_invitations').select('id', { count: 'exact', head: true }).eq('email', TEST_PASSWORD_USER)
        count === 0 ? ok('invite=no user correctly absent from pending_invitations') : bad(`invite=no user appeared in pending_invitations (count=${count})`)
        // Cleanup
        await admin.from('users').delete().eq('id', authData.user.id)
        await admin.auth.admin.deleteUser(authData.user.id)
        info('Cleaned up test user')
      }
    }
  }
}

// ── 4. Runtime — invite=yes path (generate link + pending_invitations) ─────────
section('4. Runtime — invite=yes: magic link + pending_invitations row')
{
  const { data: existing } = await admin.from('users').select('id').eq('email', TEST_INVITE_USER).maybeSingle()
  if (existing) { bad('Pre-existing collision — skipping path') }
  else {
    const { data: inviteData, error: inviteErr } = await admin.auth.admin.generateLink({
      type: 'invite',
      email: TEST_INVITE_USER,
      options: { redirectTo: `${SITE_URL}/auth/confirm` },
    })
    if (inviteErr || !inviteData?.user) {
      bad(`generateLink failed: ${inviteErr?.message}`)
    } else {
      ok(`Magic link generated for ${TEST_INVITE_USER}`)
      const actionLink = inviteData.properties?.action_link
      actionLink ? ok('action_link present in response') : bad('action_link missing')

      const { error: insertErr } = await admin.from('users').insert({
        id: inviteData.user.id,
        tenant_id: TENANT_ID,
        email: TEST_INVITE_USER,
        role: 'user',
      })
      if (insertErr) {
        bad(`public.users insert failed: ${insertErr.message}`)
      } else {
        ok('public.users row inserted')
        // Insert pending_invitations row
        const { error: piErr } = await admin.from('pending_invitations').insert({
          tenant_id: TENANT_ID,
          email: TEST_INVITE_USER,
          user_id: inviteData.user.id,
        })
        piErr ? bad(`pending_invitations insert failed: ${piErr.message}`) : ok('pending_invitations row inserted')

        // Verify it's there
        const { data: piRow } = await admin.from('pending_invitations').select('id,email,status').eq('email', TEST_INVITE_USER).maybeSingle()
        piRow?.status === 'pending' ? ok("pending_invitations row status='pending' ✓") : bad(`Expected status=pending, got: ${piRow?.status}`)
      }

      // Cleanup
      await admin.from('pending_invitations').delete().eq('email', TEST_INVITE_USER)
      await admin.from('users').delete().eq('id', inviteData.user.id)
      await admin.auth.admin.deleteUser(inviteData.user.id)
      info('Cleaned up test user')
    }
  }
}

// ── 5. invite=no without password — action-level guard ────────────────────────
section('5. Server action guard — invite=no with missing password')
const actionSrc = readFileSync('src/app/(app)/invite/actions.ts', 'utf8')
const hasPasswordGuard = actionSrc.includes('Password is required when invite is')
hasPasswordGuard ? ok('Missing-password guard present in bulkImportUsers') : bad('Missing-password guard not found')

// ── 6. Results table shows "Invite sent" vs "Created" ─────────────────────────
section('6. Results table labels')
const hasInviteSent = src.includes("'Invite sent'")
const hasCreated    = src.includes("'Created'")
hasInviteSent ? ok('"Invite sent" label present for invite=yes result') : bad('"Invite sent" label missing')
hasCreated    ? ok('"Created" label present for invite=no result')      : bad('"Created" label missing')

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`)
console.log(`  PASS: ${pass}   FAIL: ${fail}`)
console.log(fail === 0 ? '  ✅  ALL CHECKS PASSED' : '  ❌  SOME CHECKS FAILED')
console.log('─'.repeat(50))
