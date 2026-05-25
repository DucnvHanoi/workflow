'use server'

import Anthropic from '@anthropic-ai/sdk'
import { getSessionClaims } from '@/lib/supabase/auth-helpers'
import type { SerializedGraph } from '@/lib/flows/graph'

const client = new Anthropic()

const SYSTEM_PROMPT = `You are a workflow builder assistant. Given a plain-English description of a business workflow, generate a valid workflow graph as JSON.

The graph must match this exact schema:

{
  "nodes": [ SerializedNode ],
  "edges": [ SerializedEdge ],
  "metadata": { "schemaVersion": 1 }
}

SerializedNode:
{
  "id": string,          // short id e.g. "n1", "n2"
  "type": "trigger" | "action" | "branch" | "complete",
  "position": { "x": number, "y": number },
  "data": NodeData
}

NodeData:
{
  "label": string,         // short step name, max 40 chars
  "description": string,   // one sentence describing the step
  "formSchema": FormField[],
  "assigneeRule": AssigneeRule | null,
  "branchConditions": BranchCondition[]
}

FormField:
{
  "id": string,            // short id e.g. "f1", "f2"
  "type": "text" | "textarea" | "dropdown" | "radio" | "checkbox" | "file" | "date",
  "label": string,
  "required": boolean,
  "options": string[]      // REQUIRED for dropdown, radio, checkbox — omit for other types
}

AssigneeRule — pick the best match based on the description:
{ "type": "requester" }                           // the person who triggered the flow
{ "type": "manager_of_requestor" }               // direct manager of the requester
{ "type": "skip_level" }                         // manager's manager of the requester
{ "type": "requester_dept_head" }                // head of the requester's department
{ "type": "fixed", "email": "someone@co.com" }  // a specific person — use ONLY when an email address is explicitly mentioned

BranchCondition:
{
  "id": string,
  "fieldId": string,       // must match a FormField id in THIS branch node's own formSchema
  "operator": "eq",
  "value": string,
  "handleId": "yes" | "no"
}

SerializedEdge:
{
  "id": string,            // e.g. "e-n1-n2"
  "source": string,        // node id
  "target": string,        // node id
  "sourceHandle": "yes" | "no" | null,  // "yes" or "no" only for branch node sources
  "targetHandle": null
}

STRICT RULES:
1. Exactly one "trigger" node: formSchema=[], assigneeRule=null, branchConditions=[]
2. Exactly one "complete" node: formSchema=[], assigneeRule=null, branchConditions=[]
3. Every "action" and "branch" node MUST have at least one FormField and a non-null assigneeRule. Choose the assigneeRule type that best matches the description (requester, manager_of_requestor, skip_level, requester_dept_head, or fixed with email).
4. Branch nodes MUST have at least one BranchCondition. The fieldId must reference a field id from that branch node's own formSchema.
5. No cycles. Every node must be reachable from the trigger node.
6. Trigger and action nodes: max 1 outbound edge. Branch nodes: exactly 2 outbound edges — one with sourceHandle "yes" and one with sourceHandle "no".
7. Layout — position nodes vertically. Trigger at x:300,y:50. Each next node: y += 160. For branch yes-path: x:150, no-path: x:500. Reconnect after branch at x:300.
8. Edge sourceHandle must be "yes" or "no" (string) only when the source node is a "branch" type. For all other source nodes, sourceHandle must be null.

IMPORTANT: Respond with ONLY the raw JSON object. Never write plain text, explanations, apologies, or questions — not even a single word outside the JSON. If the description is ambiguous, make reasonable assumptions and still output valid JSON.`

const MODIFY_SYSTEM_PROMPT = `You are a workflow editor assistant. You will receive an existing workflow graph as JSON and a plain-English modification instruction. Apply the modification and return the complete updated graph JSON.

The graph schema is identical to what you already know:
- nodes: SerializedNode[] with types "trigger" | "action" | "branch" | "complete"
- edges: SerializedEdge[]
- metadata: { schemaVersion: 1 }

NodeData fields: label, description, formSchema (FormField[]), assigneeRule, branchConditions
FormField types: "text" | "textarea" | "dropdown" | "radio" | "checkbox" | "file" | "date"
AssigneeRule options: { type: "requester" } | { type: "manager_of_requestor" } | { type: "skip_level" } | { type: "requester_dept_head" } | { type: "fixed", email: string }
BranchCondition: { id, fieldId, operator: "eq", value, handleId: "yes"|"no" }

MODIFICATION RULES:
1. Preserve all existing node ids, edge ids, and data that are not affected by the modification.
2. When adding new nodes, generate new short unique ids (e.g. "n5", "n6") that don't clash with existing ones.
3. When adding new fields, generate new short unique field ids (e.g. "f5", "f6") that don't clash with existing ones.
4. Always keep exactly one "trigger" node and at least one "complete" node.
5. Maintain valid connectivity — no dangling nodes, no cycles.
6. Adjust positions of downstream nodes if needed to keep the layout clean (y += 160 per step).
7. Branch nodes must have exactly 2 outbound edges (yes/no) and at least one BranchCondition.

IMPORTANT: Respond with ONLY the complete updated graph as raw JSON. No markdown, no explanation, not a single word outside the JSON.`

async function callClaude(
  systemPrompt: string,
  userContent: string,
  maxTokens = 4096
): Promise<{ graph: SerializedGraph | null; error: string | null }> {
  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: 'user', content: userContent }],
  })

  const raw = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim()

  if (!cleaned.startsWith('{')) {
    return { graph: null, error: 'AI returned an unexpected format. Please try again.' }
  }

  const graph = JSON.parse(cleaned) as SerializedGraph

  if (!Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
    return { graph: null, error: 'AI returned an unexpected format. Please try again.' }
  }

  return { graph, error: null }
}

async function requireAdmin(): Promise<{ ok: boolean; error: string | null }> {
  const { user, claims } = await getSessionClaims()
  if (!user || !claims?.tenant_id) return { ok: false, error: 'Unauthorized' }
  if (claims.role !== 'admin') return { ok: false, error: 'Admin access required' }
  return { ok: true, error: null }
}

export async function generateFlowFromDescription(
  description: string
): Promise<{ graph: SerializedGraph | null; error: string | null }> {
  const { ok, error: authError } = await requireAdmin()
  if (!ok) return { graph: null, error: authError }
  if (!description.trim()) return { graph: null, error: 'Description is required' }

  try {
    return await callClaude(SYSTEM_PROMPT, description.trim())
  } catch (err: unknown) {
    const body = (err as { error?: { message?: string } })?.error?.message
    console.error('AI flow generation error:', body ?? err)
    return { graph: null, error: body ?? 'Failed to generate flow. Please try again.' }
  }
}

export async function modifyFlowFromDescription(
  instruction: string,
  currentGraph: SerializedGraph
): Promise<{ graph: SerializedGraph | null; error: string | null }> {
  const { ok, error: authError } = await requireAdmin()
  if (!ok) return { graph: null, error: authError }
  if (!instruction.trim()) return { graph: null, error: 'Instruction is required' }

  try {
    // Compact JSON (no pretty-print) keeps the input token count minimal
    const userContent = `EXISTING GRAPH:\n${JSON.stringify(currentGraph)}\n\nMODIFICATION INSTRUCTION:\n${instruction.trim()}`
    // Use 8192 output tokens — modified graphs can be larger than generated ones
    return await callClaude(MODIFY_SYSTEM_PROMPT, userContent, 8192)
  } catch (err: unknown) {
    const body = (err as { error?: { message?: string } })?.error?.message
    console.error('AI flow modification error:', body ?? err)
    return { graph: null, error: body ?? 'Failed to modify flow. Please try again.' }
  }
}
