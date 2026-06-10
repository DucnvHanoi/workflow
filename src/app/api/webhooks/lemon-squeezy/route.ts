import { createHmac, timingSafeEqual } from 'crypto'
import { type NextRequest, NextResponse } from 'next/server'
import { upgradeTenantToPro, downgradeTenantToFree } from '@/lib/billing/lemon-actions'

interface LemonAttributes {
  status: string
  customer_id: number
  renews_at: string | null
  ends_at: string | null
}

interface LemonPayload {
  meta: {
    event_name: string
    custom_data?: {
      tenant_id?: string
    }
  }
  data: {
    id: string
    attributes: LemonAttributes
  }
}

export async function POST(request: NextRequest) {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET
  if (!secret) {
    console.error('[lemon-squeezy] LEMONSQUEEZY_WEBHOOK_SECRET not set')
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }

  // --- Verify HMAC-SHA256 signature ------------------------------------------
  const rawBody = await request.text()
  const signature = request.headers.get('x-signature') ?? ''

  const digest = createHmac('sha256', secret).update(rawBody).digest('hex')

  let isValid = false
  try {
    isValid = timingSafeEqual(Buffer.from(digest, 'hex'), Buffer.from(signature, 'hex'))
  } catch {
    isValid = false
  }

  if (!isValid) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  // --- Parse payload ---------------------------------------------------------
  let payload: LemonPayload
  try {
    payload = JSON.parse(rawBody) as LemonPayload
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const event = payload.meta?.event_name
  const tenantId = payload.meta?.custom_data?.tenant_id
  const attrs = payload.data?.attributes
  const subscriptionId = payload.data?.id

  // order_created fires without tenant_id — safe to ack and skip
  if (!tenantId) {
    console.warn('[lemon-squeezy] No tenant_id for event:', event)
    return NextResponse.json({ ok: true })
  }

  // --- Handle events ---------------------------------------------------------
  try {
    switch (event) {
      case 'subscription_created':
      case 'subscription_updated': {
        const activeStatuses = new Set(['active', 'on_trial', 'past_due', 'paused', 'unpaid'])
        if (activeStatuses.has(attrs?.status)) {
          await upgradeTenantToPro(
            tenantId,
            String(attrs.customer_id),
            subscriptionId,
            attrs.renews_at ?? null
          )
        } else if (attrs?.status === 'expired') {
          await downgradeTenantToFree(tenantId)
        }
        break
      }

      case 'subscription_expired':
        await downgradeTenantToFree(tenantId)
        break

      case 'subscription_cancelled':
        // Subscriber keeps Pro access until the period ends (subscription_expired fires then)
        console.log(
          '[lemon-squeezy] subscription_cancelled tenant:',
          tenantId,
          'ends_at:',
          attrs?.ends_at
        )
        break

      case 'order_created':
        // subscription_created handles the upgrade; nothing to do here
        break

      default:
        console.log('[lemon-squeezy] unhandled event:', event)
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[lemon-squeezy] handler error:', message)
    // Return 500 so Lemon Squeezy retries the delivery
    return NextResponse.json({ error: message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
