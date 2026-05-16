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
