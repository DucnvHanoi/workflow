'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { sendPasswordResetEmail } from '@/lib/email/resend'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
const REDIRECT_TO = `${SITE_URL}/auth/reset-password`

/**
 * Generates a Supabase recovery link and sends it via Resend.
 *
 * Always returns { success: true } — even when the email doesn't exist — to
 * prevent user enumeration attacks. Errors are logged server-side only.
 */
export async function requestPasswordReset(email: string): Promise<{ success: true }> {
  const trimmed = email.trim().toLowerCase()
  if (!trimmed) return { success: true }

  try {
    const db = createAdminClient()

    const { data, error } = await db.auth.admin.generateLink({
      type: 'recovery',
      email: trimmed,
      options: { redirectTo: REDIRECT_TO },
    })

    if (error || !data?.properties?.action_link) {
      // Email not found or other Supabase error — log but don't surface to user
      if (error?.message && !error.message.includes('not found')) {
        console.error('[auth] generateLink error:', error.message)
      }
      return { success: true }
    }

    await sendPasswordResetEmail({
      recipientEmail: trimmed,
      actionLink: data.properties.action_link,
    })
  } catch (err) {
    console.error('[auth] requestPasswordReset unexpected error:', err)
  }

  return { success: true }
}
