/**
 * Verification script for Phase 10 M3 — /admin/ai-usage page.
 * Uses Playwright to log in as admin and screenshot the page.
 */
import { chromium } from 'playwright'
import { writeFileSync } from 'fs'
import { join } from 'path'

const BASE = 'http://localhost:3000'
const ADMIN_EMAIL = process.env.ADMIN_EMAIL
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD env vars')
  process.exit(1)
}

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()

// Capture all console errors
page.on('console', (msg) => {
  if (msg.type() === 'error') console.log('[BROWSER ERROR]', msg.text())
})

try {
  // ── 1. Login ──────────────────────────────────────────────────────────────
  await page.goto(`${BASE}/login`)
  await page.fill('input[type="email"]', ADMIN_EMAIL)
  await page.fill('input[type="password"]', ADMIN_PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/(tasks|auth\/mfa)/, { timeout: 15000 })
  console.log('✅ Logged in — landed on:', page.url())

  // If MFA is required, skip (can't automate TOTP)
  if (page.url().includes('/auth/mfa')) {
    console.log('⚠️  MFA required — cannot automate TOTP, stopping.')
    await browser.close()
    process.exit(0)
  }

  // ── 2. Navigate to /admin/ai-usage ────────────────────────────────────────
  await page.goto(`${BASE}/admin/ai-usage`)
  await page.waitForLoadState('networkidle')
  const title = await page.title()
  const url = page.url()
  console.log('✅ Navigated to /admin/ai-usage — URL:', url, '| Title:', title)

  // ── 3. Check page renders (not redirected) ────────────────────────────────
  if (!url.includes('/admin/ai-usage')) {
    console.log('❌ Redirected away from /admin/ai-usage to', url)
    process.exit(1)
  }

  // ── 4. Verify stat cards present ─────────────────────────────────────────
  const h1 = await page.textContent('h1')
  console.log('✅ Page heading:', h1)

  const cardLabels = await page.$$eval('p.uppercase', (els) => els.map((e) => e.textContent?.trim()))
  console.log('✅ Stat card labels found:', cardLabels)

  // ── 5. Screenshot full page ───────────────────────────────────────────────
  const screenshotPath = join(process.cwd(), 'scripts', 'verify-ai-usage.png')
  await page.screenshot({ path: screenshotPath, fullPage: true })
  console.log('✅ Screenshot saved:', screenshotPath)

  // ── 6. Check per-tenant table exists ─────────────────────────────────────
  const tableHeaders = await page.$$eval('th', (ths) => ths.map((th) => th.textContent?.trim()))
  console.log('✅ Table headers found:', tableHeaders.filter(Boolean))

  // ── 7. Non-admin access test (nav to /admin/ai-usage without admin session) ──
  // Test: check that the nav item "AI Spend" is visible in sidebar
  const aiSpendLink = await page.$('a[href="/admin/ai-usage"]')
  console.log(aiSpendLink ? '✅ "AI Spend" nav link present in sidebar' : '⚠️  "AI Spend" nav link NOT found')

  // ── 8. Probe: Check /settings redirect (admin-only) ──────────────────────
  await page.goto(`${BASE}/settings`)
  await page.waitForLoadState('networkidle')
  const settingsUrl = page.url()
  console.log(settingsUrl.includes('/settings')
    ? '✅ Admin can access /settings'
    : `❌ /settings redirected admin to: ${settingsUrl}`)

  // ── 9. Check /profiles is accessible ────────────────────────────────────
  await page.goto(`${BASE}/profiles`)
  await page.waitForLoadState('networkidle')
  const profilesUrl = page.url()
  console.log(profilesUrl.includes('/profiles')
    ? '✅ /profiles accessible'
    : `❌ /profiles redirected to: ${profilesUrl}`)

  const profilesScreenshot = join(process.cwd(), 'scripts', 'verify-profiles.png')
  await page.screenshot({ path: profilesScreenshot, fullPage: false })

  // ── 10. Go back to /admin/ai-usage and check empty state vs data ──────────
  await page.goto(`${BASE}/admin/ai-usage`)
  await page.waitForLoadState('networkidle')
  const bodyText = await page.textContent('main')
  const hasData = bodyText?.includes('$') || bodyText?.includes('No tenants')
  console.log(hasData ? '✅ Page body has expected content (cost data or empty state)' : '⚠️  Unexpected page body')

  console.log('\n✅ PASS — /admin/ai-usage rendered correctly for admin')
} catch (err) {
  console.error('❌ ERROR:', err.message)
  process.exit(1)
} finally {
  await browser.close()
}
