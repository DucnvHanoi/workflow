'use server'

import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendSupportReplyEmail, sendAgentAlertEmail } from '@/lib/email/resend'
import { fetchUserContext } from './user-context'

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a helpful customer support agent for BizFlow, a workflow automation SaaS platform.

You will be given a customer email (subject + body), relevant knowledge base articles, and optionally live account context for the sender (their profile, active workflow steps, and recent flows they started).

Your task:
1. Infer the best category: billing | how-to | account | technical | general
2. Rate your confidence as "high" or "low" using these rules:
   - "high": you can give a complete, accurate, helpful answer — whether from KB articles, account context, or your general knowledge of BizFlow
   - "low": ONLY when the question requires sensitive account-specific data you cannot see (e.g. invoices, exact charges), or involves a billing dispute/refund/plan change
   - Do NOT rate "low" just because KB articles were sparse — if you know the answer, say "high"
3. Write a concise, friendly reply in plain text (no markdown, no bullet symbols)

Rules:
- If account context is provided, use it to give a specific, personalised answer (name the actual flow or step)
- NEVER invent billing figures, invoice data, or account-specific financial details
- Always set confidence "low" for billing questions (invoices, refunds, plan changes, exact pricing)
- Keep the reply under 300 words
- Address the customer by first name if their name is known
- Sign off naturally in the same language as the reply (e.g. "BizFlow Support Team")

Respond ONLY with valid JSON — no code fences, no extra text:
{"category":"billing|how-to|account|technical|general","confidence":"high|low","reply_text":"..."}`

interface AiResponseJson {
  category: string
  confidence: 'high' | 'low'
  reply_text: string
}

// ---------------------------------------------------------------------------
// Knowledge base search
// ---------------------------------------------------------------------------

async function searchKnowledgeBase(query: string): Promise<string> {
  const db = createAdminClient()

  const cleanQuery = query
    .replace(/[^\w\s]/g, ' ')
    .trim()
    .slice(0, 300)

  const select = 'title, content_markdown'
  const format = (rows: { title: string; content_markdown: string }[]) =>
    rows.map((a) => `## ${a.title}\n\n${a.content_markdown}`).join('\n\n---\n\n')

  if (cleanQuery) {
    try {
      // Pass 1: AND semantics — precise match
      const { data: exact } = await db
        .from('knowledge_base')
        .select(select)
        .eq('is_active', true)
        .textSearch('search_vector', cleanQuery, { type: 'plain', config: 'english' })
        .limit(5)

      if (exact && exact.length > 0) return format(exact)

      // Pass 2: OR semantics — any word matches
      const orQuery = cleanQuery
        .split(/\s+/)
        .filter((w) => w.length > 3)
        .join(' OR ')

      if (orQuery) {
        const { data: broad } = await db
          .from('knowledge_base')
          .select(select)
          .eq('is_active', true)
          .textSearch('search_vector', orQuery, { type: 'websearch', config: 'english' })
          .limit(5)

        if (broad && broad.length > 0) return format(broad)
      }
    } catch {
      // Search failed — fall through to broad fallback
    }
  }

  // Pass 3: no text match — return a broad cross-category sample so Claude
  // has product context even when the query doesn't match KB wording
  const { data: fallback } = await db
    .from('knowledge_base')
    .select(select)
    .eq('is_active', true)
    .not('slug', 'like', '%-vi')
    .order('category', { ascending: true })
    .limit(6)

  if (fallback && fallback.length > 0) return format(fallback)

  return 'No relevant knowledge base articles found.'
}

// ---------------------------------------------------------------------------
// Main entry point — called fire-and-forget from the webhook route
// ---------------------------------------------------------------------------

export async function generateAiResponse(ticketId: string, messageId: string): Promise<void> {
  const db = createAdminClient()

  try {
    // 1. Load ticket + message -----------------------------------------------
    const { data: ticket } = await db
      .from('support_tickets')
      .select('id, subject, sender_email, sender_name, status')
      .eq('id', ticketId)
      .single()

    const { data: message } = await db
      .from('support_messages')
      .select('body_text, body_html, email_message_id')
      .eq('id', messageId)
      .single()

    if (!ticket || !message) {
      console.error('[support/ai] Ticket or message not found', { ticketId, messageId })
      return
    }

    // Only auto-respond to freshly opened tickets
    if (ticket.status !== 'open') return

    const bodyText =
      message.body_text ||
      (message.body_html ? message.body_html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ') : '')

    // 2. Knowledge base search + user context (parallel) ---------------------
    const kbQuery = ticket.subject.slice(0, 300)
    const [kbArticles, userContext] = await Promise.all([
      searchKnowledgeBase(kbQuery),
      fetchUserContext(ticket.sender_email as string),
    ])

    // 3. Call Claude ----------------------------------------------------------
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      console.error('[support/ai] ANTHROPIC_API_KEY not configured')
      await db.from('support_tickets').update({ status: 'pending_human' }).eq('id', ticketId)
      return
    }

    const senderLabel = ticket.sender_name
      ? `${ticket.sender_name} <${ticket.sender_email}>`
      : ticket.sender_email

    const userContent = [
      'CUSTOMER EMAIL',
      `Subject: ${ticket.subject}`,
      `From: ${senderLabel}`,
      '',
      bodyText.slice(0, 2000),
      '',
      '---',
      '',
      'KNOWLEDGE BASE ARTICLES',
      kbArticles,
      ...(userContext ? ['', '---', '', userContext] : []),
    ].join('\n')

    const client = new Anthropic({ apiKey })
    const aiMessage = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userContent }],
    })

    const rawText = aiMessage.content[0].type === 'text' ? aiMessage.content[0].text.trim() : ''
    const cleaned = rawText
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim()

    // 4. Parse AI response ----------------------------------------------------
    let aiReply: AiResponseJson
    try {
      aiReply = JSON.parse(cleaned) as AiResponseJson
    } catch {
      console.error('[support/ai] Failed to parse Claude response:', cleaned)
      await db.from('support_tickets').update({ status: 'pending_human' }).eq('id', ticketId)
      await sendAgentAlertEmail({
        ticketId,
        subject: ticket.subject as string,
        senderEmail: ticket.sender_email as string,
        senderName: ticket.sender_name as string | null,
        category: 'general',
        reason: 'AI response could not be parsed',
      })
      return
    }

    const isBilling = aiReply.category === 'billing'
    const isHighConfidence = aiReply.confidence === 'high' && !isBilling
    const canAutoReply = isHighConfidence || (aiReply.confidence === 'low' && !isBilling)

    // 5a. Can auto-reply (high confidence, or low-confidence non-billing) -----
    if (canAutoReply) {
      const replyText = aiReply.reply_text

      const outboundMsgId = `<${ticketId}.${Date.now()}@bizflow.id.vn>`

      const replySubject = ticket.subject.startsWith('Re:')
        ? ticket.subject
        : `Re: ${ticket.subject}`

      const resendId = await sendSupportReplyEmail({
        to: ticket.sender_email as string,
        senderName: ticket.sender_name as string | null,
        subject: replySubject,
        replyText,
        inReplyTo: message.email_message_id as string | null,
        customMessageId: outboundMsgId,
      })

      // Log outbound message
      await db.from('support_messages').insert({
        ticket_id: ticketId,
        direction: 'outbound',
        from_email: process.env.SUPPORT_FROM_EMAIL ?? 'support@bizflow.id.vn',
        from_name: 'BizFlow Support',
        body_text: replyText,
        is_ai_generated: true,
        email_message_id: outboundMsgId,
        in_reply_to: message.email_message_id ?? null,
        resend_id: resendId,
      })

      // Update ticket — low-confidence replies stay open for potential follow-up
      await db
        .from('support_tickets')
        .update({
          status: isHighConfidence ? 'ai_replied' : 'pending_human',
          category: aiReply.category,
          ai_confidence: aiReply.confidence,
          last_message_at: new Date().toISOString(),
        })
        .eq('id', ticketId)

      // Alert agent for low-confidence so they can monitor
      if (!isHighConfidence) {
        await sendAgentAlertEmail({
          ticketId,
          subject: ticket.subject as string,
          senderEmail: ticket.sender_email as string,
          senderName: ticket.sender_name as string | null,
          category: aiReply.category,
          reason: 'AI replied with low confidence — please verify the response',
        })
      }

      // 5b. Billing or sensitive — escalate to human only ----------------------
    } else {
      await db
        .from('support_tickets')
        .update({
          status: 'pending_human',
          category: aiReply.category,
          ai_confidence: 'low',
        })
        .eq('id', ticketId)

      await sendAgentAlertEmail({
        ticketId,
        subject: ticket.subject as string,
        senderEmail: ticket.sender_email as string,
        senderName: ticket.sender_name as string | null,
        category: aiReply.category,
        reason: 'Billing question — requires human review',
      })
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[support/ai] Unexpected error:', msg)
    // Fail safe — always surface to human rather than silently drop
    await db.from('support_tickets').update({ status: 'pending_human' }).eq('id', ticketId)
  }
}
