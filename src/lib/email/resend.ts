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
  buildInviteEmail,
  buildSlaDigestEmail,
  buildEscalationEmail,
  type AssignmentEmailData,
  type CompletionEmailData,
  type InviteEmailData,
  type SlaDigestEmailData,
  type EscalationEmailData,
} from './templates'

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

// Resend is instantiated once at module load.
// RESEND_API_KEY must be set in .env.local and in Vercel environment variables.
const resend = new Resend(process.env.RESEND_API_KEY)

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev'

// ---------------------------------------------------------------------------
// Internal log writer
// ---------------------------------------------------------------------------

interface LogEmailParams {
  tenantId: string
  instanceId: string | null
  stepInstanceId?: string | null
  recipientEmail: string
  emailType: 'step_assigned' | 'flow_completed' | 'invite' | 'sla_reminder' | 'sla_escalation'
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

// ---------------------------------------------------------------------------
// sendInviteEmail
// ---------------------------------------------------------------------------

export interface SendInviteEmailParams extends InviteEmailData {
  tenantId: string
}

/**
 * Sends an invitation email with the Supabase magic link.
 * Called from inviteUser() after generateLink() succeeds.
 * Fire-and-forget safe: never throws.
 */
export async function sendInviteEmail(params: SendInviteEmailParams): Promise<void> {
  const { subject, html } = buildInviteEmail(params)

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: params.inviteeEmail,
      subject,
      html,
    })

    if (error) {
      console.error('[email] Resend API error (invite):', error)
      await logEmail({
        tenantId: params.tenantId,
        instanceId: null,
        recipientEmail: params.inviteeEmail,
        emailType: 'invite',
        status: 'failed',
        errorMessage: error.message,
      })
      return
    }

    await logEmail({
      tenantId: params.tenantId,
      instanceId: null,
      recipientEmail: params.inviteeEmail,
      emailType: 'invite',
      status: 'sent',
      resendId: data?.id ?? null,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[email] Unexpected error sending invite email:', message)
    await logEmail({
      tenantId: params.tenantId,
      instanceId: null,
      recipientEmail: params.inviteeEmail,
      emailType: 'invite',
      status: 'failed',
      errorMessage: message,
    })
  }
}

// ---------------------------------------------------------------------------
// sendSlaDigestEmail
// ---------------------------------------------------------------------------

export interface SendSlaDigestEmailParams extends SlaDigestEmailData {
  recipientEmail: string
  tenantId: string
}

/**
 * Sends the daily SLA digest to an assignee.
 * Called from the /api/cron/sla route. Fire-and-forget safe: never throws.
 */
export async function sendSlaDigestEmail(params: SendSlaDigestEmailParams): Promise<void> {
  const { subject, html } = buildSlaDigestEmail(params)

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: params.recipientEmail,
      subject,
      html,
    })

    if (error) {
      console.error('[email] Resend API error (sla-digest):', error)
      await logEmail({
        tenantId: params.tenantId,
        instanceId: null,
        recipientEmail: params.recipientEmail,
        emailType: 'sla_reminder',
        status: 'failed',
        errorMessage: error.message,
      })
      return
    }

    await logEmail({
      tenantId: params.tenantId,
      instanceId: null,
      recipientEmail: params.recipientEmail,
      emailType: 'sla_reminder',
      status: 'sent',
      resendId: data?.id ?? null,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[email] Unexpected error sending SLA digest:', message)
    await logEmail({
      tenantId: params.tenantId,
      instanceId: null,
      recipientEmail: params.recipientEmail,
      emailType: 'sla_reminder',
      status: 'failed',
      errorMessage: message,
    })
  }
}

// ---------------------------------------------------------------------------
// sendEscalationEmail
// ---------------------------------------------------------------------------

export interface SendEscalationEmailParams extends EscalationEmailData {
  managerEmail: string
  tenantId: string
  instanceId: string
  stepInstanceId: string
}

/**
 * Sends an escalation alert to the assignee's manager.
 * Called from the /api/cron/sla route. Fire-and-forget safe: never throws.
 */
export async function sendEscalationEmail(params: SendEscalationEmailParams): Promise<void> {
  const { subject, html } = buildEscalationEmail(params)

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: params.managerEmail,
      subject,
      html,
    })

    if (error) {
      console.error('[email] Resend API error (escalation):', error)
      await logEmail({
        tenantId: params.tenantId,
        instanceId: params.instanceId,
        stepInstanceId: params.stepInstanceId,
        recipientEmail: params.managerEmail,
        emailType: 'sla_escalation',
        status: 'failed',
        errorMessage: error.message,
      })
      return
    }

    await logEmail({
      tenantId: params.tenantId,
      instanceId: params.instanceId,
      stepInstanceId: params.stepInstanceId,
      recipientEmail: params.managerEmail,
      emailType: 'sla_escalation',
      status: 'sent',
      resendId: data?.id ?? null,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[email] Unexpected error sending escalation email:', message)
    await logEmail({
      tenantId: params.tenantId,
      instanceId: params.instanceId,
      stepInstanceId: params.stepInstanceId,
      recipientEmail: params.managerEmail,
      emailType: 'sla_escalation',
      status: 'failed',
      errorMessage: message,
    })
  }
}
