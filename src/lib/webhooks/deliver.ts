import { createHmac } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import type { OutboundWebhookEventType } from '@/lib/webhooks/events'

export type { OutboundWebhookEventType }

export interface OutboundWebhookPayload {
  event: OutboundWebhookEventType
  tenantId: string
  instanceId?: string
  flowId?: string
  flowName?: string
  stepId?: string
  stepName?: string
  actorName?: string
  reason?: string
  occurredAt: string
}

interface WebhookRow {
  id: string
  url: string
  secret: string
}

const RETRY_DELAYS_MS = [0, 1000, 2000]

async function deliverOne(
  db: ReturnType<typeof createAdminClient>,
  webhook: WebhookRow,
  event: OutboundWebhookEventType,
  payload: OutboundWebhookPayload
): Promise<void> {
  const body = JSON.stringify(payload)
  const signature = createHmac('sha256', webhook.secret).update(body).digest('hex')
  const headers = {
    'Content-Type': 'application/json',
    'X-Webhook-Signature': `sha256=${signature}`,
    'X-Aitomic-Event': event,
    'User-Agent': 'AitomicFlow-Webhooks/1.0',
  }

  let lastStatus: number | undefined
  let lastBody: string | undefined
  let lastError: string | undefined

  for (let attempt = 1; attempt <= 3; attempt++) {
    if (attempt > 1) {
      await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt - 1]))
    }

    try {
      const res = await fetch(webhook.url, {
        method: 'POST',
        headers,
        body,
        signal: AbortSignal.timeout(10_000),
      })

      lastStatus = res.status
      lastBody = (await res.text().catch(() => '')).slice(0, 500)

      if (res.ok) {
        await db.from('webhook_delivery_log').insert({
          webhook_id: webhook.id,
          event_type: event,
          payload,
          status: 'delivered',
          attempt,
          response_status: lastStatus,
          response_body: lastBody,
          delivered_at: new Date().toISOString(),
        })
        return
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err)
    }
  }

  // All 3 attempts failed — log the final failure
  await db.from('webhook_delivery_log').insert({
    webhook_id: webhook.id,
    event_type: event,
    payload,
    status: 'failed',
    attempt: 3,
    response_status: lastStatus ?? null,
    response_body: lastBody ?? null,
    error_message: lastError ?? null,
  })
}

/**
 * Fire an outbound webhook event to all active subscribers for the tenant.
 * Always fire-and-forget (call with `void`).
 */
export async function fireWebhookEvent(
  tenantId: string,
  event: OutboundWebhookEventType,
  payload: Omit<OutboundWebhookPayload, 'event' | 'tenantId' | 'occurredAt'>
): Promise<void> {
  try {
    const db = createAdminClient()

    const { data: webhooks } = await db
      .from('tenant_custom_webhooks')
      .select('id, url, secret')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .contains('events', [event])

    if (!webhooks || webhooks.length === 0) return

    const fullPayload: OutboundWebhookPayload = {
      event,
      tenantId,
      occurredAt: new Date().toISOString(),
      ...payload,
    }

    await Promise.allSettled(
      (webhooks as WebhookRow[]).map((wh) => deliverOne(db, wh, event, fullPayload))
    )
  } catch (err) {
    console.error('[webhooks] fireWebhookEvent error:', err)
  }
}
