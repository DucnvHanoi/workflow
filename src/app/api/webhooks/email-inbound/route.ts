import { type NextRequest, NextResponse } from 'next/server'
import { processInboundEmail, type ResendInboundPayload } from '@/lib/support/inbound'

/**
 * POST /api/webhooks/email-inbound
 *
 * Receives inbound emails forwarded by Resend.
 * Security: secret query param (?secret=SUPPORT_INBOUND_SECRET).
 * Resend does not sign inbound payloads, so we guard with a shared secret
 * embedded in the webhook URL configured on the Resend dashboard.
 *
 * After parsing and persisting the ticket/message this handler returns 200
 * immediately. The AI response (M3) is triggered asynchronously.
 */
export async function POST(request: NextRequest) {
  // --- Auth ------------------------------------------------------------------
  const secret = request.nextUrl.searchParams.get('secret')
  const expected = process.env.SUPPORT_INBOUND_SECRET

  if (!expected || secret !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // --- Parse body ------------------------------------------------------------
  let payload: ResendInboundPayload
  try {
    payload = (await request.json()) as ResendInboundPayload
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!payload.data?.from || !payload.data?.subject) {
    return NextResponse.json(
      { error: 'Missing required fields: data.from, data.subject' },
      { status: 400 }
    )
  }

  // --- Process ---------------------------------------------------------------
  try {
    const result = await processInboundEmail(payload)

    return NextResponse.json({
      ok: true,
      ticketId: result.ticketId,
      messageId: result.messageId,
      isNewTicket: result.isNewTicket,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[support/inbound] Processing error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// Resend retries on non-2xx — make sure we don't process GET/HEAD
export async function GET() {
  return NextResponse.json({ ok: true })
}
