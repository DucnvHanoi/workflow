'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionClaims } from '@/lib/supabase/auth-helpers'
import { sendSupportReplyEmail } from '@/lib/email/resend'

// ---------------------------------------------------------------------------
// Auth guard
// ---------------------------------------------------------------------------

async function assertPlatformAdmin(): Promise<{ email: string }> {
  const { user } = await getSessionClaims()
  const platformEmail = process.env.PLATFORM_ADMIN_EMAIL
  if (!user || !platformEmail || user.email !== platformEmail) {
    throw new Error('Unauthorized')
  }
  return { email: user.email }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SupportTicketRow {
  id: string
  subject: string
  sender_email: string
  sender_name: string | null
  status: string
  priority: string
  category: string | null
  ai_confidence: string | null
  last_message_at: string
  created_at: string
}

export interface SupportMessageRow {
  id: string
  direction: 'inbound' | 'outbound'
  from_email: string
  from_name: string | null
  body_text: string | null
  body_html: string | null
  is_ai_generated: boolean
  email_message_id: string | null
  created_at: string
}

// ---------------------------------------------------------------------------
// getTickets
// ---------------------------------------------------------------------------

export async function getTickets(statusFilter?: string): Promise<SupportTicketRow[]> {
  await assertPlatformAdmin()
  const db = createAdminClient()

  let q = db
    .from('support_tickets')
    .select(
      'id, subject, sender_email, sender_name, status, priority, category, ai_confidence, last_message_at, created_at'
    )
    .order('last_message_at', { ascending: false })

  if (statusFilter && statusFilter !== 'all') {
    q = q.eq('status', statusFilter)
  }

  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []) as SupportTicketRow[]
}

// ---------------------------------------------------------------------------
// getTicketWithMessages
// ---------------------------------------------------------------------------

export async function getTicketWithMessages(
  ticketId: string
): Promise<{ ticket: SupportTicketRow; messages: SupportMessageRow[] } | null> {
  await assertPlatformAdmin()
  const db = createAdminClient()

  const { data: ticket, error: te } = await db
    .from('support_tickets')
    .select(
      'id, subject, sender_email, sender_name, status, priority, category, ai_confidence, last_message_at, created_at'
    )
    .eq('id', ticketId)
    .single()

  if (te || !ticket) return null

  const { data: messages, error: me } = await db
    .from('support_messages')
    .select(
      'id, direction, from_email, from_name, body_text, body_html, is_ai_generated, email_message_id, created_at'
    )
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true })

  if (me) throw new Error(me.message)

  return {
    ticket: ticket as SupportTicketRow,
    messages: (messages ?? []) as SupportMessageRow[],
  }
}

// ---------------------------------------------------------------------------
// updateTicketStatus
// ---------------------------------------------------------------------------

export async function updateTicketStatus(ticketId: string, status: string): Promise<void> {
  await assertPlatformAdmin()
  const db = createAdminClient()
  const { error } = await db.from('support_tickets').update({ status }).eq('id', ticketId)
  if (error) throw new Error(error.message)
  revalidatePath('/platform/support')
  revalidatePath(`/platform/support/${ticketId}`)
}

// ---------------------------------------------------------------------------
// sendAgentReply
// ---------------------------------------------------------------------------

export async function sendAgentReply(ticketId: string, replyText: string): Promise<void> {
  await assertPlatformAdmin()

  if (!replyText.trim()) throw new Error('Reply cannot be empty')

  const db = createAdminClient()

  // Load ticket for subject + sender info + last inbound message-id for threading
  const { data: ticket } = await db
    .from('support_tickets')
    .select('subject, sender_email, sender_name, status')
    .eq('id', ticketId)
    .single()

  if (!ticket) throw new Error('Ticket not found')

  // Find the latest inbound message for threading
  const { data: lastInbound } = await db
    .from('support_messages')
    .select('email_message_id')
    .eq('ticket_id', ticketId)
    .eq('direction', 'inbound')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  const outboundMsgId = `<${ticketId}.${Date.now()}@aitomicflow.com>`
  const replySubject = (ticket.subject as string).startsWith('Re:')
    ? (ticket.subject as string)
    : `Re: ${ticket.subject}`

  const resendId = await sendSupportReplyEmail({
    to: ticket.sender_email as string,
    senderName: ticket.sender_name as string | null,
    subject: replySubject,
    replyText,
    inReplyTo: (lastInbound?.email_message_id as string | null) ?? null,
    customMessageId: outboundMsgId,
  })

  await db.from('support_messages').insert({
    ticket_id: ticketId,
    direction: 'outbound',
    from_email: process.env.SUPPORT_FROM_EMAIL ?? 'support@aitomicflow.com',
    from_name: 'Aitomic Flow Support',
    body_text: replyText,
    is_ai_generated: false,
    email_message_id: outboundMsgId,
    in_reply_to: lastInbound?.email_message_id ?? null,
    resend_id: resendId,
  })

  await db
    .from('support_tickets')
    .update({
      status: 'closed',
      last_message_at: new Date().toISOString(),
    })
    .eq('id', ticketId)

  revalidatePath('/platform/support')
  revalidatePath(`/platform/support/${ticketId}`)
}
