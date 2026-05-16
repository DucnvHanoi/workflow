/**
 * src/lib/email/resend.ts
 *
 * Resend email client + two send functions.
 *
 * RULES (from project architecture):
 *   - NEVER throws — all errors are caught, logged to notification_logs, and returned
 *   - Always uses createAdminClient for DB writes (no session cookie in server actions)
 *   - Never blocks the flow — caller must not await result before continuing
 *
 * Usage:
 *   // Fire-and-forget (recommended — never blocks the flow)
 *   void sendAssignmentEmail({ ... })
 *
 *   // Or awaited if you want to log the outcome before continuing
 *   await sendAssignmentEmail({ ... })
 */

import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  buildAssignmentEmail,
  buildCompletionEmail,
  type AssignmentEmailData,
  type CompletionEmailData,
} from './templates'

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

// Resend is instantiated once at module load.
// RESEND_API_KEY must be set in .env.local and in Vercel environment variables.
const resend = new Resend(process.env.RESEND_API_KEY)

// The "from" address.
// During dev/testing: use "onboarding@resend.dev" (Resend's shared sender —
//   emails go to your own verified address only, no custom domain needed).
// In production: use "noreply@yourdomain.com" after domain is verified in Resend.
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev'

// ---------------------------------------------------------------------------
// Internal log writer
// ---------------------------------------------------------------------------

interface LogEmailParams {
  tenantId: string
  instanceId: string
  stepInstanceId?: string | null
  recipientEmail: string
  emailType: 'step_assigned' | 'flow_completed'
  status: 'sent' | 'failed'
  resendId?: string | null
  errorMessage?: string | null
}

/**
 * Writes one row to notification_logs.
 * Non-fatal: if this itself fails, we just console.error — never throw.
 */
async function logEmail(params: LogEmailParams): Promise<void> {
  try {
    const db = createAdminClient()
    await db.from('notification_logs').insert({
      tenant_id: params.tenantId,
      instance_id: params.instanceId,
      step_instance_id: params.stepInstanceId ?? null,
      recipient_email: params.recipientEmail,
      email_type: params.emailType,
      status: params.status,
      resend_id: params.resendId ?? null,
      error_message: params.errorMessage ?? null,
    })
  } catch (err) {
    // Log writer itself failed — don't propagate, just note it
    console.error('[email] Failed to write notification_log:', err)
  }
}

// ---------------------------------------------------------------------------
// sendAssignmentEmail
// ---------------------------------------------------------------------------

export interface SendAssignmentEmailParams extends AssignmentEmailData {
  recipientEmail: string // email address to send to
  tenantId: string
  instanceId: string
  stepInstanceId: string
}

/**
 * Sends a "you have been assigned a step" email.
 * Called from triggerFlow() and advanceFlow() after resolveAssignee() succeeds.
 * Fire-and-forget safe: never throws.
 */
export async function sendAssignmentEmail(params: SendAssignmentEmailParams): Promise<void> {
  const { subject, html } = buildAssignmentEmail(params)

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: params.recipientEmail,
      subject,
      html,
    })

    if (error) {
      console.error('[email] Resend API error (assignment):', error)
      await logEmail({
        tenantId: params.tenantId,
        instanceId: params.instanceId,
        stepInstanceId: params.stepInstanceId,
        recipientEmail: params.recipientEmail,
        emailType: 'step_assigned',
        status: 'failed',
        errorMessage: error.message,
      })
      return
    }

    await logEmail({
      tenantId: params.tenantId,
      instanceId: params.instanceId,
      stepInstanceId: params.stepInstanceId,
      recipientEmail: params.recipientEmail,
      emailType: 'step_assigned',
      status: 'sent',
      resendId: data?.id ?? null,
    })
  } catch (err) {
    // Network error, misconfigured key, etc.
    const message = err instanceof Error ? err.message : String(err)
    console.error('[email] Unexpected error sending assignment email:', message)
    await logEmail({
      tenantId: params.tenantId,
      instanceId: params.instanceId,
      stepInstanceId: params.stepInstanceId,
      recipientEmail: params.recipientEmail,
      emailType: 'step_assigned',
      status: 'failed',
      errorMessage: message,
    })
  }
}

// ---------------------------------------------------------------------------
// sendCompletionEmail
// ---------------------------------------------------------------------------

export interface SendCompletionEmailParams extends CompletionEmailData {
  triggererEmail: string // email address of the person who started the flow
  tenantId: string
  instanceId: string
}

/**
 * Sends a "your flow is complete" email to the flow triggerer.
 * Called from advanceFlow() when flow status becomes 'completed'.
 * Fire-and-forget safe: never throws.
 */
export async function sendCompletionEmail(params: SendCompletionEmailParams): Promise<void> {
  const { subject, html } = buildCompletionEmail(params)

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: params.triggererEmail,
      subject,
      html,
    })

    if (error) {
      console.error('[email] Resend API error (completion):', error)
      await logEmail({
        tenantId: params.tenantId,
        instanceId: params.instanceId,
        stepInstanceId: null,
        recipientEmail: params.triggererEmail,
        emailType: 'flow_completed',
        status: 'failed',
        errorMessage: error.message,
      })
      return
    }

    await logEmail({
      tenantId: params.tenantId,
      instanceId: params.instanceId,
      stepInstanceId: null,
      recipientEmail: params.triggererEmail,
      emailType: 'flow_completed',
      status: 'sent',
      resendId: data?.id ?? null,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[email] Unexpected error sending completion email:', message)
    await logEmail({
      tenantId: params.tenantId,
      instanceId: params.instanceId,
      stepInstanceId: null,
      recipientEmail: params.triggererEmail,
      emailType: 'flow_completed',
      status: 'failed',
      errorMessage: message,
    })
  }
}
