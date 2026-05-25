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

AssigneeRule (always use this exact value for action and branch nodes):
{ "type": "requester" }

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
3. Every "action" and "branch" node MUST have at least one FormField and assigneeRule: {"type":"requester"}
4. Branch nodes MUST have at least one BranchCondition. The fieldId must reference a field id from that branch node's own formSchema.
5. No cycles. Every node must be reachable from the trigger node.
6. Trigger and action nodes: max 1 outbound edge. Branch nodes: exactly 2 outbound edges — one with sourceHandle "yes" and one with sourceHandle "no".
7. Layout — position nodes vertically. Trigger at x:300,y:50. Each next node: y += 160. For branch yes-path: x:150, no-path: x:500. Reconnect after branch at x:300.
8. Edge sourceHandle must be "yes" or "no" (string) only when the source node is a "branch" type. For all other source nodes, sourceHandle must be null.

Respond with ONLY the raw JSON. No markdown, no code fences, no explanation.`

export async function generateFlowFromDescription(
  description: string
): Promise<{ graph: SerializedGraph | null; error: string | null }> {
  const { user, claims } = await getSessionClaims()
  if (!user || !claims?.tenant_id) return { graph: null, error: 'Unauthorized' }
  if (claims.role !== 'admin') return { graph: null, error: 'Admin access required' }
  if (!description.trim()) return { graph: null, error: 'Description is required' }

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: description.trim() }],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
    const graph = JSON.parse(raw) as SerializedGraph

    if (!Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
      return { graph: null, error: 'AI returned an unexpected format. Please try again.' }
    }

    return { graph, error: null }
  } catch (err) {
    console.error('AI flow generation error:', err)
    return { graph: null, error: 'Failed to generate flow. Please try again.' }
  }
}
