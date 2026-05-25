'use server'

import { getSessionClaims } from '@/lib/supabase/auth-helpers'
import { callAI } from './client'

export interface TextAssistParams {
  fieldLabel: string
  stepLabel: string
  flowName?: string
  instruction: string
  currentText?: string
}

export interface TextAssistResult {
  text: string | null
  error: string | null
}

const GENERATE_SYSTEM_PROMPT = `You are a helpful writing assistant embedded in a business workflow application.
The user is filling in a form field as part of a workflow step. Your job is to write clear, professional content for that field based on their guidance.
Output ONLY the text that should go into the field — no preamble, no explanations, no quotes around the text.`

const REWRITE_SYSTEM_PROMPT = `You are a helpful writing assistant embedded in a business workflow application.
The user wants to improve existing text in a form field. Rewrite it according to their instruction while preserving the original intent.
Output ONLY the rewritten text — no preamble, no explanations, no quotes around the text.`

export async function assistTextarea(params: TextAssistParams): Promise<TextAssistResult> {
  const { fieldLabel, stepLabel, flowName, instruction, currentText } = params

  const { user, claims } = await getSessionClaims()
  if (!user || !claims?.tenant_id) return { text: null, error: 'Unauthorized' }

  const isRewrite = !!(currentText && currentText.trim())
  const systemPrompt = isRewrite ? REWRITE_SYSTEM_PROMPT : GENERATE_SYSTEM_PROMPT

  const contextLines = [
    `Workflow: ${flowName ?? 'Unknown'}`,
    `Step: ${stepLabel}`,
    `Field: ${fieldLabel}`,
    isRewrite ? `Current text:\n${currentText}` : null,
    `User instruction: ${instruction}`,
  ]
    .filter(Boolean)
    .join('\n')

  try {
    const result = await callAI({
      tenantId: claims.tenant_id,
      userId: user.id,
      feature: 'text_assist',
      systemPrompt,
      userContent: contextLines,
      maxTokens: 1024,
    })
    return { text: result.text, error: null }
  } catch (err) {
    return { text: null, error: err instanceof Error ? err.message : 'AI request failed.' }
  }
}
