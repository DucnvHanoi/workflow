'use server'

import { createAdminClient } from '@/lib/supabase/admin'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Postmark inbound webhook payload shape */
export interface PostmarkInboundPayload {
  From: string // "Name <email>" or plain address
  FromName: string
  FromFull: { Email: string; Name: string; MailboxHash: string }
  To: string
  ToFull: Array<{ Email: string; Name: string; MailboxHash: string }>
  Subject: string
  TextBody: string
  HtmlBody: string
  MessageID: string // RFC Message-ID header value
  Date: string
  ReplyTo?: string
  Cc?: string
  Bcc?: string
  Headers: Array<{ Name: string; Value: string }>
  Attachments?: unknown[]
  MailboxHash?: string
}

// Kept for reference only — no longer used for inbound processing
export interface ResendInboundPayload {
  type: string
  created_at: string
  data: {
    from: string
    to: string[]
    subject: string
    text?: string
    html?: string
    message_id: string
    email_id: string
    headers?: Record<string, string> | Array<{ name: string; value: string }>
    attachments?: unknown[]
    bcc?: string[]
    cc?: string[]
  }
}

interface ParsedEmail {
  email: string
  name: string | null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse "John Doe <john@example.com>" or plain "john@example.com" */
function parseEmailAddress(raw: string): ParsedEmail {
  const match = raw.match(/^(.*?)\s*<([^>]+)>$/)
  if (match) {
    return { name: match[1].trim() || null, email: match[2].trim().toLowerCase() }
  }
  return { name: null, email: raw.trim().toLowerCase() }
}

/** Normalise a subject for threading fallback: strip Re:/Fwd:/Fwrd: prefixes */
function normaliseSubject(subject: string): string {
  return subject
    .replace(/^(re|fwd?|fwrd):\s*/gi, '')
    .trim()
    .toLowerCase()
}

/** Extract a named header from Postmark's [{ Name, Value }] array */
function getHeader(
  headers: Array<{ Name: string; Value: string }> | undefined,
  name: string
): string | null {
  if (!headers) return null
  const lower = name.toLowerCase()
  return headers.find((h) => h.Name.toLowerCase() === lower)?.Value ?? null
}

// ---------------------------------------------------------------------------
// Core processor
// ---------------------------------------------------------------------------

/**
 * Processes a parsed inbound email payload:
 * 1. Detects whether it belongs to an existing ticket (by In-Reply-To or subject)
 * 2. Creates or updates the ticket
 * 3. Appends the message to support_messages
 * Returns the ticket id and message id.
 */
export async function processInboundEmail(payload: PostmarkInboundPayload): Promise<{
  ticketId: string
  messageId: string
  isNewTicket: boolean
}> {
  const db = createAdminClient()

  const sender = parseEmailAddress(payload.From)
  const subject = payload.Subject?.trim() || '(no subject)'

  // Postmark provides MessageID directly; extract threading headers from Headers array
  const messageId = payload.MessageID ?? null
  const inReplyTo = getHeader(payload.Headers, 'in-reply-to')
  const references = getHeader(payload.Headers, 'references')

  // ------------------------------------------------------------------
  // 1. Threading: find existing ticket
  // ------------------------------------------------------------------
  let existingTicketId: string | null = null

  // Priority 1: match In-Reply-To / References against stored message IDs
  const replyIds = [
    inReplyTo,
    ...(references ? references.split(/\s+/).filter(Boolean) : []),
  ].filter((id): id is string => !!id)

  if (replyIds.length > 0) {
    const { data: match } = await db
      .from('support_messages')
      .select('ticket_id')
      .in('email_message_id', replyIds)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (match) existingTicketId = match.ticket_id as string
  }

  // Priority 2: same sender + normalised subject in a non-closed ticket
  if (!existingTicketId) {
    const normSubject = normaliseSubject(subject)
    const { data: tickets } = await db
      .from('support_tickets')
      .select('id, subject')
      .eq('sender_email', sender.email)
      .neq('status', 'closed')
      .order('last_message_at', { ascending: false })
      .limit(20)

    const matched = (tickets ?? []).find(
      (t) => normaliseSubject(t.subject as string) === normSubject
    )
    if (matched) existingTicketId = matched.id as string
  }

  // ------------------------------------------------------------------
  // 2. Create or update ticket
  // ------------------------------------------------------------------
  let ticketId: string

  if (existingTicketId) {
    ticketId = existingTicketId
    // Reopen if it was closed or ai_replied so a human can see the new message
    const { data: ticket } = await db
      .from('support_tickets')
      .select('status')
      .eq('id', ticketId)
      .single()

    const shouldReopen = ticket?.status === 'closed' || ticket?.status === 'ai_replied'
    await db
      .from('support_tickets')
      .update({
        last_message_at: new Date().toISOString(),
        ...(shouldReopen ? { status: 'open' } : {}),
      })
      .eq('id', ticketId)
  } else {
    const { data: newTicket, error } = await db
      .from('support_tickets')
      .insert({
        subject,
        sender_email: sender.email,
        sender_name: sender.name,
        status: 'open',
        priority: 'normal',
        last_message_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (error || !newTicket) {
      throw new Error(`Failed to create support ticket: ${error?.message}`)
    }
    ticketId = newTicket.id as string
  }

  // ------------------------------------------------------------------
  // 3. Log the inbound message
  // ------------------------------------------------------------------
  // Postmark includes TextBody and HtmlBody directly in the webhook payload
  const body = {
    text: payload.TextBody || null,
    html: payload.HtmlBody || null,
  }

  const { data: msg, error: msgError } = await db
    .from('support_messages')
    .insert({
      ticket_id: ticketId,
      direction: 'inbound',
      from_email: sender.email,
      from_name: sender.name,
      body_text: body.text,
      body_html: body.html,
      is_ai_generated: false,
      email_message_id: messageId ?? null,
      in_reply_to: inReplyTo ?? null,
    })
    .select('id')
    .single()

  if (msgError || !msg) {
    throw new Error(`Failed to log support message: ${msgError?.message}`)
  }

  return {
    ticketId,
    messageId: msg.id as string,
    isNewTicket: !existingTicketId,
  }
}
