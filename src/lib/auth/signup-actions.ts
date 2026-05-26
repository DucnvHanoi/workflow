'use server'

import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/admin'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev'
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

export type SignupResult = { success: true } | { error: string }

export async function createTenantAccount(email: string, password: string): Promise<SignupResult> {
  const admin = createAdminClient()

  // 1. Create auth user — unconfirmed so user must click the confirmation email
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: false,
  })

  if (authError) {
    const msg = authError.message.toLowerCase()
    if (
      msg.includes('already been registered') ||
      msg.includes('already exists') ||
      (msg.includes('email address') && msg.includes('taken'))
    ) {
      return { error: 'An account with this email already exists. Try logging in instead.' }
    }
    return { error: authError.message }
  }

  const userId = authData.user.id

  // 2. Create tenant row (plan = 'free' via DB default)
  const { data: tenant, error: tenantError } = await admin
    .from('tenants')
    .insert({ name: 'My Organization', plan: 'free' })
    .select('id')
    .single()

  if (tenantError || !tenant) {
    await admin.auth.admin.deleteUser(userId)
    return { error: 'Failed to set up your workspace. Please try again.' }
  }

  const tenantId = tenant.id

  // 3. Create user row linking auth identity to tenant
  const { error: userError } = await admin
    .from('users')
    .insert({ id: userId, tenant_id: tenantId, email, role: 'admin' })

  if (userError) {
    await admin.auth.admin.deleteUser(userId)
    await admin.from('tenants').delete().eq('id', tenantId)
    return { error: 'Failed to set up your workspace. Please try again.' }
  }

  // 4. Stamp app_metadata so every issued JWT carries tenant_id + role
  const { error: metaError } = await admin.auth.admin.updateUserById(userId, {
    app_metadata: { tenant_id: tenantId, role: 'admin' },
  })

  if (metaError) {
    await admin.auth.admin.deleteUser(userId)
    await admin.from('tenants').delete().eq('id', tenantId)
    return { error: 'Failed to set up your workspace. Please try again.' }
  }

  // 5. Generate a magic link — same pattern as the invite flow
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo: `${SITE_URL}/auth/confirm` },
  })

  if (linkError || !linkData?.properties?.action_link) {
    // Account is created and ready — user can request a new link via login
    console.error('[signup] generateLink failed:', linkError?.message)
    return { success: true }
  }

  // 6. Send confirmation email via Resend
  const confirmUrl = linkData.properties.action_link
  await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: 'Confirm your DragFlow account',
    html: buildConfirmationEmail(confirmUrl),
  })

  return { success: true }
}

function buildConfirmationEmail(confirmUrl: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden">
        <!-- Header -->
        <tr>
          <td style="background:#4f46e5;padding:28px 40px;text-align:center">
            <table cellpadding="0" cellspacing="0" style="margin:0 auto">
              <tr>
                <td style="background:rgba(255,255,255,0.2);border-radius:10px;padding:8px 12px;display:inline-block">
                  <span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:-0.5px">DragFlow</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:40px 40px 32px">
            <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#0f172a;letter-spacing:-0.3px">
              Confirm your account
            </h1>
            <p style="margin:0 0 24px;font-size:15px;color:#64748b;line-height:1.6">
              Thanks for signing up to DragFlow! Click the button below to verify your email address and activate your account.
            </p>
            <table cellpadding="0" cellspacing="0" style="margin-bottom:24px">
              <tr>
                <td style="background:#4f46e5;border-radius:10px">
                  <a href="${confirmUrl}" style="display:inline-block;padding:14px 28px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;letter-spacing:-0.2px">
                    Confirm my account &rarr;
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.5">
              This link expires in 24 hours. If you didn&apos;t create a DragFlow account, you can safely ignore this email.
            </p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:20px 40px;background:#f8fafc;border-top:1px solid #e2e8f0">
            <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center">
              &copy; ${new Date().getFullYear()} DragFlow &middot;
              <a href="${SITE_URL}" style="color:#4f46e5;text-decoration:none">dragflow.io</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}
