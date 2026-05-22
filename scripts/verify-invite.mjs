/**
 * End-to-end verification of the M3 invite email flow.
 * Creates a temporary admin test user (email+password), drives /invite,
 * checks notification_logs, then cleans up.
 */

import { createClient } from '@supabase/supabase-js'
import { chromium } from '@playwright/test'

const SUPABASE_URL = 'https://qdngvdffqsnqikqbhkmw.supabase.co'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const APP_URL = 'http://localhost:3000'

const ts = Date.now()
const TEST_ADMIN_EMAIL = `test.admin.${ts}@mailinator.com`
const TEST_ADMIN_PASS = `TestAdmin${ts}!`
const TEST_INVITE_EMAIL = `verify.invite.${ts}@mailinator.com`

const adminDb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

let testUserId = null

async function cleanup() {
  // Remove the test admin user and the invited user from auth + public.users
  for (const email of [TEST_ADMIN_EMAIL, TEST_INVITE_EMAIL]) {
    const { data: users } = await adminDb.auth.admin.listUsers()
    const match = users?.users?.find((u) => u.email === email)
    if (match) {
      await adminDb.auth.admin.deleteUser(match.id)
      console.log(`   Cleaned up auth user: ${email}`)
    }
  }
}

async function main() {
  console.log('── Step 1: Create temporary test admin user ──')

  // Use ACE Corp tenant (known from DB)
  const tenantId = '06801690-8ddf-419d-85bf-87e7eff240b9'
  console.log('   tenant_id:', tenantId)

  // Create auth user
  const { data: authData, error: authError } = await adminDb.auth.admin.createUser({
    email: TEST_ADMIN_EMAIL,
    password: TEST_ADMIN_PASS,
    email_confirm: true,
  })
  if (authError || !authData?.user) {
    console.error('❌ Failed to create test admin auth user:', authError?.message)
    process.exit(1)
  }
  testUserId = authData.user.id
  console.log('   Auth user created:', testUserId)

  // Set app_metadata so JWT hook gives admin role + tenant_id
  await adminDb.auth.admin.updateUserById(testUserId, {
    app_metadata: { role: 'admin', tenant_id: tenantId },
  })

  // Pre-insert public.users row
  const { error: insertError } = await adminDb.from('users').insert({
    id: testUserId,
    tenant_id: tenantId,
    email: TEST_ADMIN_EMAIL,
    role: 'admin',
    full_name: 'Verify Test Admin',
  })
  if (insertError) {
    console.error('❌ Failed to insert public.users row:', insertError.message)
    await cleanup()
    process.exit(1)
  }
  console.log('✅ Test admin created')

  console.log('\n── Step 2: Launch browser, sign in as test admin ──')
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext()
  const page = await context.newPage()

  // Go to login page
  await page.goto(`${APP_URL}/login`, { waitUntil: 'networkidle' })
  await page.screenshot({ path: 'scripts/verify-01-login.png' })
  console.log('   Login page loaded')

  // Fill email + password form
  const emailInput = page.locator('input[type="email"]')
  const passInput = page.locator('input[type="password"]')
  const submitBtn = page.locator('button[type="submit"]')

  if ((await emailInput.count()) === 0 || (await passInput.count()) === 0) {
    console.error('❌ Login form not found — Google-only login page?')
    await page.screenshot({ path: 'scripts/verify-01-login.png' })
    await browser.close()
    await cleanup()
    process.exit(1)
  }

  await emailInput.fill(TEST_ADMIN_EMAIL)
  await passInput.fill(TEST_ADMIN_PASS)
  await submitBtn.click()
  await page.waitForURL((url) => !url.href.includes('/login'), { timeout: 10000 }).catch(() => {})
  await page.screenshot({ path: 'scripts/verify-02-after-login.png' })
  console.log('   After login → URL:', page.url())

  if (page.url().includes('/login')) {
    console.error('❌ Still on login page after sign-in. Screenshot: verify-02-after-login.png')
    await browser.close()
    await cleanup()
    process.exit(1)
  }
  console.log('✅ Logged in successfully as test admin')

  console.log('\n── Step 3: Navigate to /invite ──')
  await page.goto(`${APP_URL}/invite`, { waitUntil: 'networkidle' })
  await page.screenshot({ path: 'scripts/verify-03-invite-page.png' })
  console.log('   URL:', page.url())

  if (!page.url().includes('/invite')) {
    console.error('❌ /invite redirected to:', page.url(), '— screenshot: verify-03-invite-page.png')
    await browser.close()
    await cleanup()
    process.exit(1)
  }
  console.log('✅ /invite page loaded — screenshot: verify-03-invite-page.png')

  console.log('\n── Step 4: Fill and submit invite form ──')
  console.log('   Inviting:', TEST_INVITE_EMAIL, 'as role: user')

  const inviteEmailInput = page.locator('#invite-email')
  await inviteEmailInput.fill(TEST_INVITE_EMAIL)
  // Role already defaults to 'user' in the Radix Select — no need to interact

  // Button is an <onClick> Button, not type=submit
  const inviteSubmit = page.locator('button', { hasText: /send invite/i })
  await inviteSubmit.click()

  // Wait for response (toast/message usually within 3–5s)
  await page.waitForTimeout(4000)
  await page.screenshot({ path: 'scripts/verify-04-after-submit.png' })
  console.log('   Screenshot: verify-04-after-submit.png')

  const html = await page.content()
  const hasSuccess = /nvit|uccess|sent/i.test(html)
  const hasError = /\berror\b|\bfailed\b|\bFailed\b/i.test(html)

  if (hasSuccess && !hasError) {
    console.log('✅ Success indicator found in page')
  } else if (hasError) {
    console.error('❌ Error detected after submit — check verify-04-after-submit.png')
  } else {
    console.log('⚠️  Ambiguous response — check verify-04-after-submit.png')
  }

  console.log('\n── Step 5: Query notification_logs ──')
  // Fire-and-forget delay
  await new Promise((r) => setTimeout(r, 3000))

  const { data: logs, error: logsError } = await adminDb
    .from('notification_logs')
    .select('id, recipient_email, email_type, status, resend_id, error_message, created_at')
    .eq('email_type', 'invite')
    .eq('recipient_email', TEST_INVITE_EMAIL)
    .order('created_at', { ascending: false })
    .limit(1)

  if (logsError) {
    console.error('❌ notification_logs query failed:', logsError.message)
  } else if (!logs || logs.length === 0) {
    console.error('❌ No notification_log row found for', TEST_INVITE_EMAIL)
  } else {
    const row = logs[0]
    console.log('✅ notification_logs row:')
    console.log('   email_type :', row.email_type)
    console.log('   status     :', row.status)
    console.log('   resend_id  :', row.resend_id ?? '(none)')
    console.log('   error      :', row.error_message ?? '(none)')
    if (row.status === 'sent') {
      console.log('✅ Resend accepted the message (status = sent)')
    } else {
      console.log('⚠️  status =', row.status, '—', row.error_message)
    }
  }

  console.log('\n── Step 6: Probe — duplicate invite rejected ──')
  await page.goto(`${APP_URL}/invite`, { waitUntil: 'networkidle' })
  await page.locator('#invite-email').fill(TEST_INVITE_EMAIL)
  await page.locator('button', { hasText: /send invite/i }).click()
  await page.waitForTimeout(3000)
  await page.screenshot({ path: 'scripts/verify-05-duplicate.png' })
  const dupHtml = await page.content()
  const dupBlocked = /already exists|already/i.test(dupHtml)
  console.log(
    dupBlocked
      ? '✅ Duplicate invite correctly blocked'
      : '⚠️  Duplicate invite — no clear rejection. Check verify-05-duplicate.png'
  )

  await browser.close()

  console.log('\n── Cleanup ──')
  await cleanup()

  console.log('\n── Done ──')
}

main().catch(async (e) => {
  console.error('Unhandled error:', e)
  await cleanup().catch(() => {})
  process.exit(1)
})
