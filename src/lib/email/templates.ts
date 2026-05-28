/**
 * Email templates — plain HTML with inline CSS.
 * No external dependencies. Works in all email clients (Gmail, Outlook, Apple Mail).
 *
 * Two templates:
 *   buildAssignmentEmail()  — sent when a step is assigned to a user
 *   buildCompletionEmail()  — sent to the flow triggerer when the flow completes
 */

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

/** Wraps content in the shared outer shell (header + footer). */
function shell(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">

          <!-- Header -->
          <tr>
            <td style="background-color:#18181b;padding:24px 32px;">
              <span style="color:#ffffff;font-size:18px;font-weight:600;letter-spacing:-0.3px;">Workflow</span>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              ${body}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f4f4f5;padding:20px 32px;border-top:1px solid #e4e4e7;">
              <p style="margin:0;font-size:12px;color:#71717a;text-align:center;">
                This email was sent by Workflow. If you have questions, contact your administrator.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

/** Escape HTML special characters to prevent XSS in email content. */
function escHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Primary CTA button. */
function ctaButton(label: string, href: string): string {
  return `<a href="${escHtml(href)}"
    style="display:inline-block;background-color:#18181b;color:#ffffff;font-size:14px;font-weight:600;padding:12px 24px;border-radius:6px;text-decoration:none;margin-top:24px;">
    ${escHtml(label)}
  </a>`
}

/** Muted label + value row used in detail tables. */
function detailRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:6px 0;font-size:13px;color:#71717a;width:140px;vertical-align:top;">${escHtml(label)}</td>
    <td style="padding:6px 0;font-size:13px;color:#18181b;font-weight:500;">${escHtml(value)}</td>
  </tr>`
}

// ---------------------------------------------------------------------------
// Template 1 — Step Assignment
// ---------------------------------------------------------------------------

export interface AssignmentEmailData {
  recipientName: string // full name of the person being assigned
  flowName: string
  stepName: string
  triggeredByName: string // who started the flow
  instanceId: string // used to build the direct link
  stepInstanceId: string
}

export function buildAssignmentEmail(data: AssignmentEmailData): {
  subject: string
  html: string
} {
  const actionUrl = `${BASE_URL}/tasks`

  const body = `
    <h2 style="margin:0 0 8px;font-size:20px;font-weight:600;color:#18181b;">
      You have a new task
    </h2>
    <p style="margin:0 0 24px;font-size:15px;color:#52525b;line-height:1.6;">
      Hi ${escHtml(data.recipientName)}, a step has been assigned to you in the
      <strong>${escHtml(data.flowName)}</strong> flow.
    </p>

    <table cellpadding="0" cellspacing="0" style="width:100%;border:1px solid #e4e4e7;border-radius:6px;padding:16px;background-color:#fafafa;">
      <tbody>
        ${detailRow('Flow', data.flowName)}
        ${detailRow('Step', data.stepName)}
        ${detailRow('Started by', data.triggeredByName)}
      </tbody>
    </table>

    <p style="margin:16px 0 0;font-size:14px;color:#71717a;">
      Open your Tasks page to view the details and complete this step.
    </p>

    ${ctaButton('Open Tasks', actionUrl)}
  `

  return {
    subject: `Action required: "${data.stepName}" in ${data.flowName}`,
    html: shell(`Action required: ${data.stepName}`, body),
  }
}

// ---------------------------------------------------------------------------
// Template 2 — Flow Completion
// ---------------------------------------------------------------------------

export interface CompletionEmailStep {
  stepName: string
  completedByName: string
  completedAt: string // pre-formatted date string
}

export interface CompletionEmailData {
  triggererName: string // the person who started the flow
  flowName: string
  instanceId: string
  steps: CompletionEmailStep[]
}

// ---------------------------------------------------------------------------
// Template 3 — User Invite
// ---------------------------------------------------------------------------

export interface InviteEmailData {
  inviteeEmail: string
  inviterName: string // admin who sent the invite
  tenantName: string
  actionLink: string // magic link from generateLink()
}

export function buildInviteEmail(data: InviteEmailData): {
  subject: string
  html: string
} {
  const body = `
    <h2 style="margin:0 0 8px;font-size:20px;font-weight:600;color:#18181b;">
      You have been invited
    </h2>
    <p style="margin:0 0 24px;font-size:15px;color:#52525b;line-height:1.6;">
      Hi, <strong>${escHtml(data.inviterName)}</strong> has invited you to join
      <strong>${escHtml(data.tenantName)}</strong> on Workflow.
    </p>

    <p style="margin:0 0 8px;font-size:14px;color:#52525b;line-height:1.6;">
      Click the button below to set your password and activate your account.
      This link expires in <strong>24 hours</strong>.
    </p>

    ${ctaButton('Accept invitation', data.actionLink)}

    <p style="margin:24px 0 0;font-size:12px;color:#a1a1aa;">
      If you weren't expecting this invitation, you can safely ignore this email.
    </p>
  `

  return {
    subject: `You've been invited to join ${data.tenantName} on Workflow`,
    html: shell(`Invitation to join ${data.tenantName}`, body),
  }
}

// ---------------------------------------------------------------------------
// Template 4 — Flow Completion
// ---------------------------------------------------------------------------

export function buildCompletionEmail(data: CompletionEmailData): {
  subject: string
  html: string
} {
  const instanceUrl = `${BASE_URL}/my-flows/${data.instanceId}`

  const stepRows = data.steps
    .map(
      (s, i) => `
      <tr style="border-top:${i === 0 ? 'none' : '1px solid #e4e4e7'};">
        <td style="padding:10px 0;font-size:13px;color:#18181b;font-weight:500;">${escHtml(s.stepName)}</td>
        <td style="padding:10px 0;font-size:13px;color:#52525b;">${escHtml(s.completedByName)}</td>
        <td style="padding:10px 0;font-size:12px;color:#71717a;text-align:right;">${escHtml(s.completedAt)}</td>
      </tr>`
    )
    .join('')

  const stepsTable =
    data.steps.length > 0
      ? `
    <table cellpadding="0" cellspacing="0" style="width:100%;border:1px solid #e4e4e7;border-radius:6px;overflow:hidden;margin-top:16px;">
      <thead>
        <tr style="background-color:#f4f4f5;">
          <th style="padding:10px 12px;font-size:12px;color:#71717a;font-weight:600;text-align:left;">Step</th>
          <th style="padding:10px 12px;font-size:12px;color:#71717a;font-weight:600;text-align:left;">Completed by</th>
          <th style="padding:10px 12px;font-size:12px;color:#71717a;font-weight:600;text-align:right;">When</th>
        </tr>
      </thead>
      <tbody style="padding:0 12px;">
        ${stepRows}
      </tbody>
    </table>`
      : ''

  const body = `
    <div style="display:inline-block;background-color:#f0fdf4;border:1px solid #bbf7d0;border-radius:20px;padding:4px 12px;margin-bottom:16px;">
      <span style="font-size:13px;color:#16a34a;font-weight:600;">✓ Completed</span>
    </div>

    <h2 style="margin:0 0 8px;font-size:20px;font-weight:600;color:#18181b;">
      Your flow has completed
    </h2>
    <p style="margin:0 0 8px;font-size:15px;color:#52525b;line-height:1.6;">
      Hi ${escHtml(data.triggererName)}, the <strong>${escHtml(data.flowName)}</strong>
      flow you started has been completed by all assignees.
    </p>

    <p style="margin:16px 0 4px;font-size:13px;font-weight:600;color:#18181b;text-transform:uppercase;letter-spacing:0.5px;">
      Steps summary
    </p>
    ${stepsTable}

    ${ctaButton('View Flow Details', instanceUrl)}
  `

  return {
    subject: `Completed: ${data.flowName}`,
    html: shell(`Flow completed: ${data.flowName}`, body),
  }
}

// ---------------------------------------------------------------------------
// Template 5 — SLA Daily Digest
// ---------------------------------------------------------------------------

export interface SlaDigestStep {
  flowName: string
  stepName: string
  dueAt: Date
}

export interface SlaDigestEmailData {
  recipientName: string
  overdueSteps: SlaDigestStep[]
  dueSoonSteps: SlaDigestStep[]
}

function formatDueDate(d: Date): string {
  return (
    d.toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'UTC',
    }) + ' UTC'
  )
}

function stepRow(s: SlaDigestStep, color: string): string {
  return `<tr>
    <td style="padding:8px 12px;font-size:13px;color:#18181b;font-weight:500;border-bottom:1px solid #f4f4f5;">${escHtml(s.flowName)}</td>
    <td style="padding:8px 12px;font-size:13px;color:#52525b;border-bottom:1px solid #f4f4f5;">${escHtml(s.stepName)}</td>
    <td style="padding:8px 12px;font-size:12px;color:${color};font-weight:600;text-align:right;border-bottom:1px solid #f4f4f5;">${escHtml(formatDueDate(s.dueAt))}</td>
  </tr>`
}

export function buildSlaDigestEmail(data: SlaDigestEmailData): {
  subject: string
  html: string
} {
  const tasksUrl = `${BASE_URL}/tasks`

  const tableHeader = `
    <table cellpadding="0" cellspacing="0" style="width:100%;border:1px solid #e4e4e7;border-radius:6px;overflow:hidden;margin-top:8px;">
      <thead>
        <tr style="background-color:#f4f4f5;">
          <th style="padding:8px 12px;font-size:12px;color:#71717a;font-weight:600;text-align:left;">Flow</th>
          <th style="padding:8px 12px;font-size:12px;color:#71717a;font-weight:600;text-align:left;">Step</th>
          <th style="padding:8px 12px;font-size:12px;color:#71717a;font-weight:600;text-align:right;">Due</th>
        </tr>
      </thead>
      <tbody>`

  const overdueSection =
    data.overdueSteps.length > 0
      ? `
    <p style="margin:20px 0 4px;font-size:13px;font-weight:700;color:#dc2626;text-transform:uppercase;letter-spacing:0.5px;">
      Overdue (${data.overdueSteps.length})
    </p>
    ${tableHeader}
      ${data.overdueSteps.map((s) => stepRow(s, '#dc2626')).join('')}
    </tbody></table>`
      : ''

  const dueSoonSection =
    data.dueSoonSteps.length > 0
      ? `
    <p style="margin:20px 0 4px;font-size:13px;font-weight:700;color:#d97706;text-transform:uppercase;letter-spacing:0.5px;">
      Due within 24 hours (${data.dueSoonSteps.length})
    </p>
    ${tableHeader}
      ${data.dueSoonSteps.map((s) => stepRow(s, '#d97706')).join('')}
    </tbody></table>`
      : ''

  const totalCount = data.overdueSteps.length + data.dueSoonSteps.length

  const body = `
    <h2 style="margin:0 0 8px;font-size:20px;font-weight:600;color:#18181b;">
      Your daily task summary
    </h2>
    <p style="margin:0 0 4px;font-size:15px;color:#52525b;line-height:1.6;">
      Hi ${escHtml(data.recipientName)}, you have
      <strong>${totalCount} task${totalCount === 1 ? '' : 's'}</strong>
      that need${totalCount === 1 ? 's' : ''} your attention.
    </p>

    ${overdueSection}
    ${dueSoonSection}

    ${ctaButton('Open Tasks', tasksUrl)}
  `

  return {
    subject: `Task reminder: ${totalCount} task${totalCount === 1 ? '' : 's'} need${totalCount === 1 ? 's' : ''} your attention`,
    html: shell('Daily task summary', body),
  }
}

// ---------------------------------------------------------------------------
// Template 6 — Support Reply (AI → customer)
// ---------------------------------------------------------------------------

export interface SupportReplyEmailData {
  senderName: string | null // customer's name (may be null)
  replyText: string // plain-text reply body from Claude
}

export function buildSupportReplyEmail(data: SupportReplyEmailData): {
  subject: string
  html: string
} {
  const greeting = data.senderName ? `Hi ${escHtml(data.senderName.split(' ')[0])},` : 'Hi,'

  // Convert plain-text newlines to <br> for HTML email
  const htmlBody = escHtml(data.replyText).replace(/\n/g, '<br />')

  const body = `
    <p style="margin:0 0 20px;font-size:15px;color:#52525b;line-height:1.6;">${greeting}</p>
    <p style="margin:0 0 24px;font-size:15px;color:#18181b;line-height:1.7;">${htmlBody}</p>
    <p style="margin:24px 0 0;font-size:14px;color:#71717a;line-height:1.6;">
      If you have further questions, just reply to this email and we'll be happy to help.
    </p>
    <hr style="border:none;border-top:1px solid #e4e4e7;margin:24px 0;" />
    <p style="margin:0;font-size:13px;color:#71717a;">
      BizFlow Support Team<br />
      <a href="mailto:contact@bizflow.id.vn" style="color:#71717a;">contact@bizflow.id.vn</a>
    </p>
  `

  return {
    subject: '', // caller sets Re: subject
    html: shell('BizFlow Support', body),
  }
}

// ---------------------------------------------------------------------------
// Template 7 — Agent Alert (AI escalation → platform agent)
// ---------------------------------------------------------------------------

export interface AgentAlertEmailData {
  ticketId: string
  subject: string
  senderEmail: string
  senderName: string | null
  category: string
  reason: string // why this needs human review
}

export function buildAgentAlertEmail(data: AgentAlertEmailData): {
  subject: string
  html: string
} {
  const BASE_URL_INTERNAL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  const ticketUrl = `${BASE_URL_INTERNAL}/platform/support/${data.ticketId}`
  const from = data.senderName
    ? `${escHtml(data.senderName)} (${escHtml(data.senderEmail)})`
    : escHtml(data.senderEmail)

  const body = `
    <div style="display:inline-block;background-color:#fef9c3;border:1px solid #fde047;border-radius:20px;padding:4px 12px;margin-bottom:16px;">
      <span style="font-size:13px;color:#854d0e;font-weight:600;">Needs human review</span>
    </div>

    <h2 style="margin:0 0 8px;font-size:20px;font-weight:600;color:#18181b;">
      New support ticket
    </h2>
    <p style="margin:0 0 20px;font-size:15px;color:#52525b;line-height:1.6;">
      A new ticket requires your attention — the AI could not auto-reply.
    </p>

    <table cellpadding="0" cellspacing="0" style="width:100%;border:1px solid #e4e4e7;border-radius:6px;padding:16px;background-color:#fafafa;">
      <tbody>
        ${detailRow('From', from)}
        ${detailRow('Subject', data.subject)}
        ${detailRow('Category', data.category)}
        ${detailRow('Reason', data.reason)}
      </tbody>
    </table>

    ${ctaButton('View Ticket', ticketUrl)}
  `

  return {
    subject: `[Support] Needs review: ${data.subject}`,
    html: shell('Support ticket needs review', body),
  }
}

// ---------------------------------------------------------------------------
// Template 8 — Escalation (to manager)
// ---------------------------------------------------------------------------

export interface EscalationEmailData {
  managerName: string
  assigneeName: string
  flowName: string
  stepName: string
  hoursOverdue: number
}

export function buildEscalationEmail(data: EscalationEmailData): {
  subject: string
  html: string
} {
  const tasksUrl = `${BASE_URL}/tasks`
  const overdueLabel =
    data.hoursOverdue >= 48
      ? `${Math.round(data.hoursOverdue / 24)} days`
      : `${data.hoursOverdue} hours`

  const body = `
    <div style="display:inline-block;background-color:#fef2f2;border:1px solid #fecaca;border-radius:20px;padding:4px 12px;margin-bottom:16px;">
      <span style="font-size:13px;color:#dc2626;font-weight:600;">Escalation alert</span>
    </div>

    <h2 style="margin:0 0 8px;font-size:20px;font-weight:600;color:#18181b;">
      A task is overdue
    </h2>
    <p style="margin:0 0 24px;font-size:15px;color:#52525b;line-height:1.6;">
      Hi ${escHtml(data.managerName)}, a task assigned to
      <strong>${escHtml(data.assigneeName)}</strong> is overdue by
      <strong>${escHtml(overdueLabel)}</strong> and may need your attention.
    </p>

    <table cellpadding="0" cellspacing="0" style="width:100%;border:1px solid #e4e4e7;border-radius:6px;padding:16px;background-color:#fafafa;">
      <tbody>
        ${detailRow('Assignee', data.assigneeName)}
        ${detailRow('Flow', data.flowName)}
        ${detailRow('Step', data.stepName)}
        ${detailRow('Overdue by', overdueLabel)}
      </tbody>
    </table>

    <p style="margin:16px 0 0;font-size:14px;color:#71717a;">
      You may want to follow up with ${escHtml(data.assigneeName)} or reassign this task.
    </p>

    ${ctaButton('View Tasks', tasksUrl)}
  `

  return {
    subject: `Escalation: "${data.stepName}" is overdue by ${overdueLabel}`,
    html: shell(`Escalation: ${data.stepName}`, body),
  }
}
