// Fire-and-forget webhook notifications for Slack and Microsoft Teams.
// Called from flows/actions.ts (step assigned) and cron/sla (SLA overdue).

import { createAdminClient } from '@/lib/supabase/admin'

export type WebhookEvent =
  | {
      type: 'step_assigned'
      flowName: string
      stepName: string
      assigneeName: string
      taskLink: string
    }
  | {
      type: 'sla_overdue'
      overdueCount: number
      dueSoonCount: number
      taskLink: string
    }
  | {
      type: 'comment_added'
      flowName: string
      commenterName: string
      body: string
      taskLink: string
    }

// ── Platform detection ────────────────────────────────────────────────────────

function detectPlatform(url: string): 'slack' | 'teams' | null {
  try {
    const { hostname } = new URL(url)
    if (hostname === 'hooks.slack.com') return 'slack'
    if (
      hostname === 'outlook.office.com' ||
      hostname === 'prod-xx.westus.logic.azure.com' ||
      hostname.endsWith('.webhook.office.com')
    )
      return 'teams'
  } catch {
    // invalid URL
  }
  return null
}

// ── Payload builders ──────────────────────────────────────────────────────────

function buildSlackPayload(event: WebhookEvent): object {
  if (event.type === 'step_assigned') {
    return {
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*New task assigned: ${event.stepName}*\nFlow: *${event.flowName}*\nAssigned to: ${event.assigneeName}`,
          },
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: { type: 'plain_text', text: 'Open Task' },
              url: event.taskLink,
              action_id: 'open_task',
            },
          ],
        },
      ],
    }
  }

  // comment_added
  if (event.type === 'comment_added') {
    return {
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `:speech_balloon: *New comment on "${event.flowName}"*\n*${event.commenterName}:* ${event.body}`,
          },
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: { type: 'plain_text', text: 'View Flow' },
              url: event.taskLink,
              action_id: 'view_flow',
            },
          ],
        },
      ],
    }
  }

  // sla_overdue
  const parts: string[] = []
  if (event.overdueCount > 0)
    parts.push(`*${event.overdueCount} overdue task${event.overdueCount > 1 ? 's' : ''}*`)
  if (event.dueSoonCount > 0)
    parts.push(`*${event.dueSoonCount} task${event.dueSoonCount > 1 ? 's' : ''}* due within 24 h`)

  return {
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `:warning: *SLA Alert* — ${parts.join(' and ')}`,
        },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'View Tasks' },
            url: event.taskLink,
            action_id: 'view_tasks',
          },
        ],
      },
    ],
  }
}

function buildTeamsPayload(event: WebhookEvent): object {
  if (event.type === 'step_assigned') {
    return {
      type: 'message',
      attachments: [
        {
          contentType: 'application/vnd.microsoft.card.adaptive',
          content: {
            $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
            type: 'AdaptiveCard',
            version: '1.4',
            body: [
              {
                type: 'TextBlock',
                text: `New task assigned: ${event.stepName}`,
                weight: 'Bolder',
                size: 'Medium',
              },
              {
                type: 'FactSet',
                facts: [
                  { title: 'Flow', value: event.flowName },
                  { title: 'Assigned to', value: event.assigneeName },
                ],
              },
            ],
            actions: [{ type: 'Action.OpenUrl', title: 'Open Task', url: event.taskLink }],
          },
        },
      ],
    }
  }

  // comment_added
  if (event.type === 'comment_added') {
    return {
      type: 'message',
      attachments: [
        {
          contentType: 'application/vnd.microsoft.card.adaptive',
          content: {
            $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
            type: 'AdaptiveCard',
            version: '1.4',
            body: [
              {
                type: 'TextBlock',
                text: `New comment on "${event.flowName}"`,
                weight: 'Bolder',
                size: 'Medium',
              },
              {
                type: 'FactSet',
                facts: [{ title: 'From', value: event.commenterName }],
              },
              { type: 'TextBlock', text: event.body, wrap: true },
            ],
            actions: [{ type: 'Action.OpenUrl', title: 'View Flow', url: event.taskLink }],
          },
        },
      ],
    }
  }

  // sla_overdue
  const facts: { title: string; value: string }[] = []
  if (event.overdueCount > 0) facts.push({ title: 'Overdue', value: String(event.overdueCount) })
  if (event.dueSoonCount > 0)
    facts.push({ title: 'Due within 24 h', value: String(event.dueSoonCount) })

  return {
    type: 'message',
    attachments: [
      {
        contentType: 'application/vnd.microsoft.card.adaptive',
        content: {
          $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
          type: 'AdaptiveCard',
          version: '1.4',
          body: [
            {
              type: 'TextBlock',
              text: 'SLA Alert',
              weight: 'Bolder',
              size: 'Medium',
              color: 'Warning',
            },
            { type: 'FactSet', facts },
          ],
          actions: [{ type: 'Action.OpenUrl', title: 'View Tasks', url: event.taskLink }],
        },
      },
    ],
  }
}

// ── Low-level POST ────────────────────────────────────────────────────────────

async function postToWebhook(url: string, body: object): Promise<void> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    // Hosts are allowlisted to Slack/Teams, but don't follow redirects — avoids
    // any open-redirect on those domains being used to reach internal targets.
    redirect: 'manual',
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Webhook POST failed (${res.status}): ${text}`)
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function sendWebhookNotification(
  tenantId: string,
  event: WebhookEvent
): Promise<void> {
  try {
    const db = createAdminClient()
    const { data: tenant } = await db
      .from('tenants')
      .select('slack_webhook_url, teams_webhook_url')
      .eq('id', tenantId)
      .single()

    const urls = [
      tenant?.slack_webhook_url as string | null,
      tenant?.teams_webhook_url as string | null,
    ].filter((u): u is string => !!u)

    if (urls.length === 0) return

    await Promise.all(
      urls.map(async (url) => {
        const platform = detectPlatform(url)
        if (!platform) return
        const payload = platform === 'slack' ? buildSlackPayload(event) : buildTeamsPayload(event)
        await postToWebhook(url, payload)
      })
    )
  } catch (err) {
    console.error('[webhook] sendWebhookNotification failed:', err)
  }
}

// Used by the settings "Test" button — accepts the URL directly (no DB lookup).
export async function testWebhookUrl(url: string): Promise<{ error: string | null }> {
  try {
    const platform = detectPlatform(url)
    if (!platform) return { error: 'URL must be a valid Slack or Teams webhook URL.' }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.aitomicflow.com'
    const payload = buildSlackPayload({
      type: 'step_assigned',
      flowName: 'Sample Flow',
      stepName: 'Sample Step',
      assigneeName: 'Your Team',
      taskLink: `${siteUrl}/tasks`,
    })
    const teamsPayload = buildTeamsPayload({
      type: 'step_assigned',
      flowName: 'Sample Flow',
      stepName: 'Sample Step',
      assigneeName: 'Your Team',
      taskLink: `${siteUrl}/tasks`,
    })

    await postToWebhook(url, platform === 'slack' ? payload : teamsPayload)
    return { error: null }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Webhook test failed.' }
  }
}
