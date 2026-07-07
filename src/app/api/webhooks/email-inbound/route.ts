import { type NextRequest, NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { processInboundEmail, type PostmarkInboundPayload } from '@/lib/support/inbound'
import { generateAiResponse } from '@/lib/support/ai-responder'
import { safeEqual } from '@/lib/security/secret'

/**
 * POST /api/webhooks/email-inbound
 *
 * Receives inbound emails forwarded by Postmark.
 * Postmark does not sign inbound payloads, so we guard with a shared secret.
 * Preferred: send it in the `X-Inbound-Secret` header (kept out of access logs,
 * proxies, and Referer). The `?secret=` query param is still accepted for
 * backwards compatibility with existing Postmark configuration.
 *
 * After parsing and persisting the ticket/message this handler returns 200
 * immediately. The AI response (M3) is triggered asynchronously.
 */
export async function POST(request: NextRequest) {
  // --- Auth ------------------------------------------------------------------
  const secret =
    request.headers.get('x-inbound-secret') ?? request.nextUrl.searchParams.get('secret')
  const expected = process.env.SUPPORT_INBOUND_SECRET

  if (!expected || !safeEqual(secret, expected)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // --- Parse body ------------------------------------------------------------
  let payload: PostmarkInboundPayload
  try {
    payload = (await request.json()) as PostmarkInboundPayload
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Postmark sends top-level From and Subject fields
  if (!payload.From || !payload.Subject) {
    return NextResponse.json({ error: 'Missing required fields: From, Subject' }, { status: 400 })
  }

  // --- Process ---------------------------------------------------------------
  try {
    const result = await processInboundEmail(payload)

    // waitUntil keeps the serverless function alive after the response is sent
    // so the AI work completes. plain void would be killed immediately on Vercel.
    waitUntil(generateAiResponse(result.ticketId, result.messageId))

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

// Postmark health check — return 200 for GET requests
export async function GET() {
  return NextResponse.json({ ok: true })
}
