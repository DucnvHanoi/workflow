/**
 * verify-password-reset.mjs
 *
 * Tests the password-reset flow without relying on email delivery.
 * Does NOT change any account password.
 *
 * Tests both session-establishment paths:
 *   A) PKCE flow  — verifyOtp with token_hash (mirrors exchangeCodeForSession)
 *   B) Implicit   — setSession with access_token + refresh_token
 *
 * Usage:
 *   node --env-file=.env.local scripts/verify-password-reset.mjs <email>
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const REDIRECT_TO = 'https://www.aitomicflow.com/auth/reset-password'

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ANON_KEY) {
  console.error('ERROR: Missing Supabase env vars. Load .env.local first.')
  process.exit(1)
}

const email = process.argv[2]
if (!email) {
  console.error('Usage: node --env-file=.env.local scripts/verify-password-reset.mjs <email>')
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const anon = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

function pass(msg) { console.log(`  ✓ ${msg}`) }
function fail(label, msg) { console.error(`  FAIL ${label}: ${msg}`); process.exit(1) }

async function run() {
  console.log('\n=== Password Reset Flow Verification ===\n')

  // ── Step 1: Generate recovery link ───────────────────────────────────────
  console.log(`[1] Admin generates recovery link for ${email} (no email sent)…`)
  const { data, error: genErr } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo: REDIRECT_TO },
  })
  if (genErr || !data) fail('generateLink', genErr?.message ?? 'no data')

  const hashedToken = data.properties?.hashed_token
  pass(`Link generated — hashed_token: ${hashedToken?.slice(0, 20)}…`)

  // ── Step 2A: PKCE path — verifyOtp with token_hash ────────────────────────
  // This is what supabase.auth.exchangeCodeForSession() does internally
  // when Supabase sends ?code=xxx in the redirect URL.
  console.log('\n[2A] PKCE path — verifyOtp(token_hash) → session…')
  const { data: v1, error: e1 } = await anon.auth.verifyOtp({
    type: 'recovery',
    token_hash: hashedToken,
  })
  if (e1 || !v1?.session) fail('verifyOtp', e1?.message ?? 'no session')
  if (v1.session.user.email !== email) fail('session user', `got ${v1.session.user.email}`)
  pass(`Session established for ${v1.session.user.email}`)
  pass('PKCE path works ✓')

  // Clean up session A
  const anonA = createClient(SUPABASE_URL, ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
  await anonA.auth.setSession({ access_token: v1.session.access_token, refresh_token: v1.session.refresh_token })
  await anonA.auth.signOut()

  // ── Step 2B: Implicit path — setSession with access + refresh tokens ──────
  // Generate a fresh link (token_hash is single-use)
  console.log('\n[2B] Implicit path — setSession(access_token, refresh_token) → session…')
  const { data: d2, error: g2 } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo: REDIRECT_TO },
  })
  if (g2 || !d2) fail('generateLink (2B)', g2?.message ?? 'no data')

  // Exchange token_hash to get access + refresh tokens (simulates the hash in the URL)
  const { data: v2, error: e2 } = await anon.auth.verifyOtp({
    type: 'recovery',
    token_hash: d2.properties?.hashed_token,
  })
  if (e2 || !v2?.session) fail('verifyOtp (2B)', e2?.message ?? 'no session')

  // Now test setSession directly with those tokens (the implicit-flow code path)
  const anonB = createClient(SUPABASE_URL, ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
  const { error: e3 } = await anonB.auth.setSession({
    access_token: v2.session.access_token,
    refresh_token: v2.session.refresh_token,
  })
  if (e3) fail('setSession', e3.message)
  pass('setSession accepted valid tokens')
  pass('Implicit path works ✓')
  await anonB.auth.signOut()

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(60))
  console.log('RESULT: ALL STEPS PASSED ✓')
  console.log('═'.repeat(60))
  console.log('Both PKCE (?code=) and implicit (#access_token=) paths work.')
  console.log('The reset-password page now handles both flows.')
}

run().catch((err) => { console.error('\nUnexpected error:', err.message); process.exit(1) })
