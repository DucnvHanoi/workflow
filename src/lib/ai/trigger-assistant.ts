'use server'

import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionClaims } from '@/lib/supabase/auth-helpers'
import type { SerializedGraph } from '@/lib/flows/graph'
import type { FormField } from '@/store/canvas-store'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FlowSummary {
  id: string
  name: string
  description: string
  firstStepFields: Array<{ key: string; label: string; type: string }>
}

export interface FlowSuggestion {
  flowId: string | null
  confidence: 'high' | 'medium' | 'low'
  reasoning: string
  prefillData: Record<string, string>
}

// ─── Claude client ────────────────────────────────────────────────────────────

const anthropic = new Anthropic()

const SYSTEM_PROMPT = `You are a workflow assistant. Given a user's request description and a list of available workflows, identify the best matching workflow and extract any field values you can confidently infer from the description.

Return ONLY a raw JSON object (no markdown, no explanation):
{
  "flowId": string | null,
  "confidence": "high" | "medium" | "low",
  "reasoning": string,
  "prefillData": { "fieldKey": "value" }
}

Rules:
- flowId must exactly match an id from the available flows list, or null if nothing fits
- confidence: high = unambiguous match, medium = likely match, low = weak or uncertain
- reasoning: 1-2 sentences explaining why this flow was selected (or why no match)
- prefillData: only include fields whose value you can confidently infer; use {} when unsure
- For number fields, value is a numeric string e.g. "500"
- For text/textarea, extract the most relevant phrase from the description
- Never guess field values — only include what is explicitly stated in the request

IMPORTANT: Respond with ONLY the raw JSON object.`

// ─── getAvailableFlowSummaries ────────────────────────────────────────────────
// Called server-side from my-flows/page.tsx. Returns published flows the
// current user's department is allowed to trigger, with first-step fields.

export async function getAvailableFlowSummaries(): Promise<{
  summaries: FlowSummary[]
  error: string | null
}> {
  const { user, claims } = await getSessionClaims()
  if (!user || !claims?.tenant_id) return { summaries: [], error: 'Unauthorized' }

  const db = createAdminClient()
  const tenantId = claims.tenant_id

  const { data: userRow } = await db
    .from('users')
    .select('department_id')
    .eq('id', user.id)
    .eq('tenant_id', tenantId)
    .maybeSingle()
  const userDeptId = (userRow as { department_id: string | null } | null)?.department_id ?? null

  const { data: flows, error } = await db
    .from('flows')
    .select(
      `
      id,
      name,
      description,
      allowed_department_ids,
      flow_versions!latest_version_id ( graph )
    `
    )
    .eq('tenant_id', tenantId)
    .eq('status', 'published')

  if (error) return { summaries: [], error: error.message }

  const summaries: FlowSummary[] = []

  for (const flow of flows ?? []) {
    const allowed = (flow.allowed_department_ids as string[] | null) ?? []
    if (allowed.length > 0 && (!userDeptId || !allowed.includes(userDeptId))) continue

    const version = Array.isArray(flow.flow_versions) ? flow.flow_versions[0] : flow.flow_versions
    const graph = version?.graph as SerializedGraph | undefined

    summaries.push({
      id: flow.id,
      name: flow.name,
      description: flow.description ?? '',
      firstStepFields: extractFirstStepFields(graph),
    })
  }

  return { summaries, error: null }
}

function extractFirstStepFields(
  graph: SerializedGraph | undefined
): Array<{ key: string; label: string; type: string }> {
  if (!graph) return []
  const trigger = graph.nodes.find((n) => n.type === 'trigger')
  if (!trigger) return []
  const firstEdge = graph.edges.find((e) => e.source === trigger.id)
  if (!firstEdge) return []
  const firstStep = graph.nodes.find((n) => n.id === firstEdge.target)
  const schema = firstStep?.data?.formSchema as FormField[] | undefined
  if (!schema) return []
  return schema.map((f) => ({ key: f.id, label: f.label || f.id, type: f.type }))
}

// ─── suggestFlowForRequest ────────────────────────────────────────────────────
// Called from the FlowTriggerAssistant client component via server action RPC.

export async function suggestFlowForRequest(
  userText: string,
  flows: FlowSummary[]
): Promise<{ suggestion: FlowSuggestion | null; error: string | null }> {
  const { user, claims } = await getSessionClaims()
  if (!user || !claims?.tenant_id) return { suggestion: null, error: 'Unauthorized' }
  if (!userText.trim()) return { suggestion: null, error: 'Please describe what you need.' }
  if (flows.length === 0)
    return { suggestion: null, error: 'No published flows are available to you.' }

  const flowList = flows
    .map((f, i) => {
      const fields = f.firstStepFields
        .map((field) => `    - key="${field.key}", label="${field.label}", type="${field.type}"`)
        .join('\n')
      return [
        `${i + 1}. id="${f.id}", name="${f.name}"`,
        `   description: "${f.description || '(none)'}"`,
        fields ? `   first step fields:\n${fields}` : '   first step fields: (none)',
      ].join('\n')
    })
    .join('\n\n')

  const userContent = `User request: "${userText}"\n\nAvailable flows:\n${flowList}`

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userContent }],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim()

    if (!cleaned.startsWith('{')) {
      return { suggestion: null, error: 'AI returned an unexpected format. Please try again.' }
    }

    const parsed = JSON.parse(cleaned) as FlowSuggestion

    if (!parsed.confidence || !parsed.reasoning) {
      return { suggestion: null, error: 'AI returned incomplete data. Please try again.' }
    }

    // Validate flowId is actually in the list
    if (parsed.flowId && !flows.find((f) => f.id === parsed.flowId)) {
      parsed.flowId = null
    }

    return { suggestion: { ...parsed, prefillData: parsed.prefillData ?? {} }, error: null }
  } catch (err: unknown) {
    const body = (err as { error?: { message?: string } })?.error?.message
    console.error('AI trigger assistant error:', body ?? err)
    return {
      suggestion: null,
      error: body ?? 'Failed to process your request. Please try again.',
    }
  }
}
