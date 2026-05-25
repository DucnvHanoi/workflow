'use server'

import { getSessionClaims } from '@/lib/supabase/auth-helpers'
import { callAI } from './client'
import type { BranchCondition } from '@/store/canvas-store'

export interface AvailableField {
  nodeId: string
  nodeLabel: string
  fieldId: string
  fieldLabel: string
  fieldType: string
}

const SYSTEM_PROMPT = `You are a workflow branch condition parser. Given a plain-English condition and a list of available form fields, parse the condition into a structured object.

Return ONLY a raw JSON object (no markdown, no explanation) in one of these two shapes:

Success:
{ "nodeId": string, "fieldId": string, "operator": "eq"|"neq"|"gt"|"lt"|"gte"|"lte"|"contains", "value": string, "handleId": "yes"|"no" }

Failure:
{ "error": string }

Operator guide:
- eq: is, equals, is exactly, =
- neq: is not, does not equal, ≠
- gt: more than, greater than, exceeds, above, over, >
- lt: less than, fewer than, below, under, <
- gte: at least, greater than or equal to, ≥
- lte: at most, less than or equal to, up to, ≤
- contains: contains, includes, has the word

Rules:
- nodeId and fieldId must exactly match values from the available fields list
- value must always be a string (e.g. "1000" not 1000)
- handleId is provided in the context — always use it as-is
- If no field in the list matches what the user is describing, return an error object
- For radio/dropdown/checkbox fields, value should match one of the expected option labels
- For numeric comparisons, use gt/lt/gte/lte; for text/radio/dropdown equality, use eq

IMPORTANT: Respond with ONLY the raw JSON object. No markdown, no explanation.`

export async function parseConditionFromText(
  text: string,
  availableFields: AvailableField[],
  handleId: 'yes' | 'no'
): Promise<{ condition: Omit<BranchCondition, 'id'> | null; error: string | null }> {
  const { user, claims } = await getSessionClaims()
  if (!user || !claims?.tenant_id) return { condition: null, error: 'Unauthorized' }
  if (claims.role !== 'admin') return { condition: null, error: 'Admin access required' }
  if (!text.trim()) return { condition: null, error: 'Condition text is required' }
  if (availableFields.length === 0)
    return {
      condition: null,
      error: 'No fields available to reference. Add fields to this or an upstream step first.',
    }

  const fieldList = availableFields
    .map(
      (f) =>
        `- nodeId: "${f.nodeId}", fieldId: "${f.fieldId}", label: "${f.fieldLabel}", type: "${f.fieldType}", step: "${f.nodeLabel}"`
    )
    .join('\n')

  const userContent = [
    `Handle: ${handleId}`,
    `Condition: "${text}"`,
    `Available fields:\n${fieldList}`,
  ].join('\n')

  try {
    const { text: raw } = await callAI({
      tenantId: claims.tenant_id,
      userId: user.id,
      feature: 'condition_parser',
      systemPrompt: SYSTEM_PROMPT,
      userContent,
      maxTokens: 512,
    })

    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim()

    if (!cleaned.startsWith('{')) {
      return { condition: null, error: 'AI returned an unexpected format. Please try again.' }
    }

    const parsed = JSON.parse(cleaned) as Record<string, string>

    if (parsed.error) {
      return { condition: null, error: parsed.error }
    }

    const { nodeId, fieldId, operator, value } = parsed
    if (!fieldId || !operator || value === undefined) {
      return { condition: null, error: 'AI returned incomplete data. Please try again.' }
    }

    const matchedField = availableFields.find((f) => f.fieldId === fieldId && f.nodeId === nodeId)
    if (!matchedField) {
      return {
        condition: null,
        error: 'AI referenced a field that does not exist. Please rephrase and try again.',
      }
    }

    return {
      condition: {
        fieldId,
        nodeId: nodeId || undefined,
        operator: operator as BranchCondition['operator'],
        value,
        handleId,
      },
      error: null,
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to parse condition. Please try again.'
    console.error('AI condition parse error:', err)
    return { condition: null, error: msg }
  }
}
