'use server'

import { createAdminClient } from '@/lib/supabase/admin'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ResendInboundPayload {
  from: string
  to: string | string[]
  subject: string
  text?: string
  html?: string
  // Resend sends headers as either an object map or an array of {name,value}
  headers?: Record<string, string> | Array<{ name: string; value: string }>
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

/** Extract a named header from either header format Resend may send */
function getHeader(
  headers: Record<string, string> | Array<{ name: string; value: string }> | undefined,
  name: string
): string | null {
  if (!headers) return null
  const lower = name.toLowerCase()
  if (Array.isArray(headers)) {
    return headers.find((h) => h.name.toLowerCase() === lower)?.value ?? null
  }
  // object map — keys may be mixed-case
  const key = Object.keys(headers).find((k) => k.toLowerCase() === lower)
  return key ? headers[key] : null
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
export async function processInboundEmail(payload: ResendInboundPayload): Promise<{
  ticketId: string
  messageId: string
  isNewTicket: boolean
}> {
  const db = createAdminClient()

  const sender = parseEmailAddress(payload.from)
  const subject = payload.subject?.trim() ?? '(no subject)'

  const inReplyTo = getHeader(payload.headers, 'in-reply-to')
  const references = getHeader(payload.headers, 'references')
  const messageId = getHeader(payload.headers, 'message-id')

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
  const { data: msg, error: msgError } = await db
    .from('support_messages')
    .insert({
      ticket_id: ticketId,
      direction: 'inbound',
      from_email: sender.email,
      from_name: sender.name,
      body_text: payload.text ?? null,
      body_html: payload.html ?? null,
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
