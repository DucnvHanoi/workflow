import type { Node, Edge } from '@xyflow/react'
import type { NodeData } from '@/store/canvas-store'

// ─── Serialized shapes (what goes into DB) ───────────────────────────────────

export interface SerializedNode {
  id: string
  type: string
  position: { x: number; y: number }
  data: NodeData
}

export interface SerializedEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string | null
  targetHandle?: string | null
  label?: string
}

export interface SerializedGraph {
  nodes: SerializedNode[]
  edges: SerializedEdge[]
  metadata: { schemaVersion: 1 }
}

// ─── Serialize: React Flow state → clean JSON for DB ─────────────────────────

export function serializeGraph(nodes: Node<NodeData>[], edges: Edge[]): SerializedGraph {
  return {
    nodes: nodes.map((n) => ({
      id: n.id,
      type: n.type ?? 'default',
      position: { x: Math.round(n.position.x), y: Math.round(n.position.y) },
      data: n.data,
    })),
    edges: edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle ?? null,
      targetHandle: e.targetHandle ?? null,
    })),
    metadata: { schemaVersion: 1 },
  }
}

// ─── Deserialize: DB JSON → React Flow state ──────────────────────────────────

export function deserializeGraph(graph: SerializedGraph): {
  nodes: Node<NodeData>[]
  edges: Edge[]
} {
  return {
    nodes: (graph.nodes ?? []).map((n) => ({
      id: n.id,
      type: n.type,
      position: n.position,
      data: n.data,
    })),
    edges: (graph.edges ?? []).map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle ?? undefined,
      targetHandle: e.targetHandle ?? undefined,
    })),
  }
}

// ─── Validate: check graph is publishable ─────────────────────────────────────
// Pure function — no DB calls, no side effects.
// Returns [] when valid. Every entry in the array is one user-visible error.

export interface ValidationError {
  nodeId: string // empty string = flow-level error, not tied to a specific node
  nodeName: string
  message: string
}

export function validateGraph(nodes: SerializedNode[], edges: SerializedEdge[]): ValidationError[] {
  const errors: ValidationError[] = []

  // ── Flow-level checks ──────────────────────────────────────────────────────

  const triggers = nodes.filter((n) => n.type === 'trigger')
  const completes = nodes.filter((n) => n.type === 'complete')

  if (nodes.length < 2) {
    errors.push({ nodeId: '', nodeName: 'Flow', message: 'Flow must have at least two nodes.' })
  }
  if (triggers.length === 0) {
    errors.push({ nodeId: '', nodeName: 'Flow', message: 'Flow must have a Trigger node.' })
  }
  if (completes.length === 0) {
    errors.push({ nodeId: '', nodeName: 'Flow', message: 'Flow must have a Complete node.' })
  }

  // ── Per-node checks ────────────────────────────────────────────────────────

  for (const node of nodes) {
    const label =
      node.data?.label && node.data.label.trim() !== '' ? node.data.label : `(${node.type})`

    // Every node must have a non-empty name
    if (!node.data?.label || node.data.label.trim() === '') {
      errors.push({ nodeId: node.id, nodeName: label, message: 'Node must have a name.' })
    }

    // Trigger + Complete: no further requirements
    if (node.type === 'trigger' || node.type === 'complete') continue

    // Action + Branch: must have at least one form field
    // Fields live in formSchema inside NodeData
    const fields = node.data?.formSchema ?? []
    if (fields.length === 0) {
      errors.push({
        nodeId: node.id,
        nodeName: label,
        message: 'Must have at least one form field.',
      })
    }

    // Action + Branch: must have an assignee rule with a type
    const rule = node.data?.assigneeRule as { type?: string } | null
    if (!rule || !rule.type) {
      errors.push({
        nodeId: node.id,
        nodeName: label,
        message: 'Assignee rule is required.',
      })
    }

    // Branch: yes and no handles must each have at least one condition
    if (node.type === 'branch') {
      const conditions = (node.data?.branchConditions ?? []) as Array<{ handleId: string }>
      const yesCount = conditions.filter((c) => c.handleId === 'yes').length
      const noCount = conditions.filter((c) => c.handleId === 'no').length
      if (yesCount === 0) {
        errors.push({
          nodeId: node.id,
          nodeName: label,
          message: 'Branch "Yes" path needs at least one condition.',
        })
      }
      if (noCount === 0) {
        errors.push({
          nodeId: node.id,
          nodeName: label,
          message: 'Branch "No" path needs at least one condition.',
        })
      }
    }
  }

  // ── Connectivity checks ────────────────────────────────────────────────────

  const nodesWithOutbound = new Set(edges.map((e) => e.source))
  const nodesWithInbound = new Set(edges.map((e) => e.target))

  for (const node of nodes) {
    const label =
      node.data?.label && node.data.label.trim() !== '' ? node.data.label : `(${node.type})`

    if (node.type !== 'complete' && !nodesWithOutbound.has(node.id)) {
      errors.push({ nodeId: node.id, nodeName: label, message: 'Node has no outgoing connection.' })
    }
    if (node.type !== 'trigger' && !nodesWithInbound.has(node.id)) {
      errors.push({ nodeId: node.id, nodeName: label, message: 'Node has no incoming connection.' })
    }
  }

  return errors
}
