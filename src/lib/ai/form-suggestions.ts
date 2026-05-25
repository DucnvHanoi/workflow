'use server'

import Anthropic from '@anthropic-ai/sdk'
import { getSessionClaims } from '@/lib/supabase/auth-helpers'
import type { FormFieldType } from '@/store/canvas-store'

export interface FieldSuggestion {
  type: FormFieldType
  label: string
}

const client = new Anthropic()

const SYSTEM_PROMPT = `You are a workflow form designer. Given a workflow step's context, suggest the most useful form fields an assignee would need to fill in.

Return a JSON array of 3–6 field suggestions. Each item must match exactly:
{ "type": FormFieldType, "label": string }

FormFieldType options: "text" | "textarea" | "number" | "dropdown" | "radio" | "checkbox" | "file" | "date"

Guidelines:
- Approval steps: include a radio (Approve/Reject) and a textarea (Comments or Reason)
- Submission steps: match the workflow domain — amounts → number, receipts/documents → file, deadlines → date
- Branch steps: first field should be the key decision field used for branching
- Labels should be concise (2–5 words), title-cased, specific to the step
- Do NOT include options arrays for dropdown/radio/checkbox — admin sets those manually
- Prefer specific types over generic text: number for amounts/counts, date for deadlines, file for attachments

IMPORTANT: Respond with ONLY a raw JSON array. No markdown, no explanation, not a single word outside the JSON.`

export async function suggestFormFields(
  stepLabel: string,
  stepDescription: string,
  flowName: string,
  nodeType: 'action' | 'branch'
): Promise<{ suggestions: FieldSuggestion[] | null; error: string | null }> {
  const { user, claims } = await getSessionClaims()
  if (!user || !claims?.tenant_id) return { suggestions: null, error: 'Unauthorized' }
  if (claims.role !== 'admin') return { suggestions: null, error: 'Admin access required' }
  if (!stepLabel.trim()) return { suggestions: null, error: 'Step label is required' }

  const userContent = [
    `Flow name: ${flowName.trim() || '(not set)'}`,
    `Step name: ${stepLabel.trim()}`,
    `Step description: ${stepDescription.trim() || '(not set)'}`,
    `Node type: ${nodeType}`,
  ].join('\n')

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userContent }],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim()

    if (!cleaned.startsWith('[')) {
      return { suggestions: null, error: 'AI returned an unexpected format. Please try again.' }
    }

    const suggestions = JSON.parse(cleaned) as FieldSuggestion[]
    if (!Array.isArray(suggestions)) {
      return { suggestions: null, error: 'AI returned an unexpected format. Please try again.' }
    }

    return { suggestions, error: null }
  } catch (err: unknown) {
    const body = (err as { error?: { message?: string } })?.error?.message
    console.error('AI field suggestion error:', body ?? err)
    return { suggestions: null, error: body ?? 'Failed to generate suggestions. Please try again.' }
  }
}
