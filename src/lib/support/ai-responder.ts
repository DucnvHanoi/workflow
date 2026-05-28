'use server'

import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendSupportReplyEmail, sendAgentAlertEmail } from '@/lib/email/resend'

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a helpful customer support agent for BizFlow, a workflow automation SaaS platform.

You will be given a customer email (subject + body) and relevant knowledge base articles.

Your task:
1. Infer the best category: billing | how-to | account | technical | general
2. Rate your confidence: "high" if the KB articles fully answer the question, "low" if unsure
3. Write a concise, friendly reply in plain text (no markdown, no bullet symbols)

Rules:
- NEVER invent pricing figures, account-specific data, or features not in the KB articles
- Always set confidence "low" for billing questions (invoices, refunds, plan changes, pricing)
- Keep the reply under 250 words
- Address the customer by first name if their name is known
- Sign off as: BizFlow Support Team

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

  // Sanitise query for plainto_tsquery — strip punctuation that could break parsing
  const cleanQuery = query
    .replace(/[^\w\s]/g, ' ')
    .trim()
    .slice(0, 300)

  try {
    const { data } = await db
      .from('knowledge_base')
      .select('title, content_markdown')
      .eq('is_active', true)
      .textSearch('search_vector', cleanQuery, { type: 'plain', config: 'english' })
      .limit(3)

    if (data && data.length > 0) {
      return data.map((a) => `## ${a.title}\n\n${a.content_markdown}`).join('\n\n---\n\n')
    }
  } catch {
    // Full-text search failed (empty query, etc.) — fall through to no articles
  }

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

    // 2. Knowledge base search -----------------------------------------------
    const kbQuery = `${ticket.subject} ${bodyText}`.slice(0, 500)
    const kbArticles = await searchKnowledgeBase(kbQuery)

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

    const userContent = `CUSTOMER EMAIL
Subject: ${ticket.subject}
From: ${senderLabel}

${bodyText.slice(0, 2000)}

---

KNOWLEDGE BASE ARTICLES
${kbArticles}`

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

    const isHighConfidence = aiReply.confidence === 'high' && aiReply.category !== 'billing'

    // 5a. High confidence → auto-reply ----------------------------------------
    if (isHighConfidence) {
      const outboundMsgId = `<${ticketId}.${Date.now()}@bizflow.id.vn>`

      const replySubject = ticket.subject.startsWith('Re:')
        ? ticket.subject
        : `Re: ${ticket.subject}`

      const resendId = await sendSupportReplyEmail({
        to: ticket.sender_email as string,
        senderName: ticket.sender_name as string | null,
        subject: replySubject,
        replyText: aiReply.reply_text,
        inReplyTo: message.email_message_id as string | null,
        customMessageId: outboundMsgId,
      })

      // Log outbound message
      await db.from('support_messages').insert({
        ticket_id: ticketId,
        direction: 'outbound',
        from_email: process.env.RESEND_FROM_EMAIL ?? 'noreply@bizflow.id.vn',
        from_name: 'BizFlow Support',
        body_text: aiReply.reply_text,
        is_ai_generated: true,
        email_message_id: outboundMsgId,
        in_reply_to: message.email_message_id ?? null,
        resend_id: resendId,
      })

      // Update ticket
      await db
        .from('support_tickets')
        .update({
          status: 'ai_replied',
          category: aiReply.category,
          ai_confidence: 'high',
          last_message_at: new Date().toISOString(),
        })
        .eq('id', ticketId)

      // 5b. Low confidence or billing → escalate to human -----------------------
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
        reason:
          aiReply.category === 'billing'
            ? 'Billing question — requires human review'
            : 'AI confidence too low to auto-reply',
      })
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[support/ai] Unexpected error:', msg)
    // Fail safe — always surface to human rather than silently drop
    await db.from('support_tickets').update({ status: 'pending_human' }).eq('id', ticketId)
  }
}
