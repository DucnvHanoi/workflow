// FILE PATH: src/lib/flows/diff.ts
// Pure structural diff between two serialized flow graphs (version A → version B).
// No DB / no React — safe to unit test and to import from a client component.
// Produces a human-readable summary: steps added/removed/modified (with
// field/assignee/branch detail) and connections added/removed.

import type { SerializedGraph, SerializedNode } from '@/lib/flows/graph'
import type { FormField, AssigneeRule } from '@/store/canvas-store'

export type FieldChange =
  | { kind: 'added'; label: string }
  | { kind: 'removed'; label: string }
  | { kind: 'modified'; label: string; changes: string[] }

export type NodeDiff =
  | { kind: 'added'; id: string; label: string; type: string }
  | { kind: 'removed'; id: string; label: string; type: string }
  | {
      kind: 'modified'
      id: string
      label: string
      type: string
      changes: string[]
      fieldChanges: FieldChange[]
    }

export type EdgeDiff = { kind: 'added' | 'removed'; label: string }

export type GraphDiff = {
  nodes: NodeDiff[]
  edges: EdgeDiff[]
  counts: { added: number; removed: number; modified: number }
  hasChanges: boolean
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function nodeLabel(node: SerializedNode | undefined): string {
  const label = node?.data?.label
  if (label && label.trim() !== '') return label
  return node?.type ? `(${node.type})` : '(unknown)'
}

function describeAssignee(rule: AssigneeRule): string {
  if (!rule) return 'none'
  switch (rule.type) {
    case 'fixed':
      return `fixed (${rule.email})`
    case 'role_in_dept':
      return `role "${rule.role}" in department`
    case 'department_head':
      return 'department head'
    default:
      return rule.type
  }
}

function fieldLabel(field: FormField): string {
  return field.label && field.label.trim() !== '' ? field.label : field.id
}

function diffFields(baseFields: FormField[], compareFields: FormField[]): FieldChange[] {
  const baseById = new Map(baseFields.map((f) => [f.id, f]))
  const compareById = new Map(compareFields.map((f) => [f.id, f]))
  const changes: FieldChange[] = []

  for (const f of compareFields) {
    if (!baseById.has(f.id)) changes.push({ kind: 'added', label: fieldLabel(f) })
  }
  for (const f of baseFields) {
    if (!compareById.has(f.id)) changes.push({ kind: 'removed', label: fieldLabel(f) })
  }
  for (const compareField of compareFields) {
    const baseField = baseById.get(compareField.id)
    if (!baseField) continue
    const fieldChanges: string[] = []
    if (baseField.label !== compareField.label) {
      fieldChanges.push(`label "${baseField.label}" → "${compareField.label}"`)
    }
    if (baseField.type !== compareField.type) {
      fieldChanges.push(`type ${baseField.type} → ${compareField.type}`)
    }
    if (baseField.required !== compareField.required) {
      fieldChanges.push(compareField.required ? 'now required' : 'no longer required')
    }
    if (JSON.stringify(baseField.options ?? []) !== JSON.stringify(compareField.options ?? [])) {
      fieldChanges.push('options changed')
    }
    if (fieldChanges.length > 0) {
      changes.push({ kind: 'modified', label: fieldLabel(compareField), changes: fieldChanges })
    }
  }

  return changes
}

function edgeKey(e: { source: string; target: string; sourceHandle?: string | null }): string {
  return `${e.source}__${e.sourceHandle ?? ''}__${e.target}`
}

// ─── Main diff ──────────────────────────────────────────────────────────────

export function diffGraphs(base: SerializedGraph, compare: SerializedGraph): GraphDiff {
  const baseNodes = base?.nodes ?? []
  const compareNodes = compare?.nodes ?? []
  const baseById = new Map(baseNodes.map((n) => [n.id, n]))
  const compareById = new Map(compareNodes.map((n) => [n.id, n]))

  const nodes: NodeDiff[] = []

  // Added
  for (const n of compareNodes) {
    if (!baseById.has(n.id)) {
      nodes.push({ kind: 'added', id: n.id, label: nodeLabel(n), type: n.type })
    }
  }
  // Removed
  for (const n of baseNodes) {
    if (!compareById.has(n.id)) {
      nodes.push({ kind: 'removed', id: n.id, label: nodeLabel(n), type: n.type })
    }
  }
  // Modified
  for (const compareNode of compareNodes) {
    const baseNode = baseById.get(compareNode.id)
    if (!baseNode) continue

    const changes: string[] = []
    if (baseNode.data?.label !== compareNode.data?.label) {
      changes.push(`renamed "${nodeLabel(baseNode)}" → "${nodeLabel(compareNode)}"`)
    }
    if ((baseNode.data?.description ?? '') !== (compareNode.data?.description ?? '')) {
      changes.push('description changed')
    }
    if (
      JSON.stringify(baseNode.data?.assigneeRule ?? null) !==
      JSON.stringify(compareNode.data?.assigneeRule ?? null)
    ) {
      changes.push(
        `assignee ${describeAssignee(baseNode.data?.assigneeRule ?? null)} → ${describeAssignee(
          compareNode.data?.assigneeRule ?? null
        )}`
      )
    }
    if (
      JSON.stringify(baseNode.data?.branchConditions ?? []) !==
      JSON.stringify(compareNode.data?.branchConditions ?? [])
    ) {
      changes.push('branch logic changed')
    }

    const fieldChanges = diffFields(
      baseNode.data?.formSchema ?? [],
      compareNode.data?.formSchema ?? []
    )

    if (changes.length > 0 || fieldChanges.length > 0) {
      nodes.push({
        kind: 'modified',
        id: compareNode.id,
        label: nodeLabel(compareNode),
        type: compareNode.type,
        changes,
        fieldChanges,
      })
    }
  }

  // Edges
  const baseEdges = base?.edges ?? []
  const compareEdges = compare?.edges ?? []
  const baseEdgeKeys = new Set(baseEdges.map(edgeKey))
  const compareEdgeKeys = new Set(compareEdges.map(edgeKey))

  const labelForEdge = (e: { source: string; target: string; sourceHandle?: string | null }) => {
    const from = nodeLabel(compareById.get(e.source) ?? baseById.get(e.source))
    const to = nodeLabel(compareById.get(e.target) ?? baseById.get(e.target))
    const handle = e.sourceHandle ? ` [${e.sourceHandle}]` : ''
    return `${from}${handle} → ${to}`
  }

  const edges: EdgeDiff[] = []
  for (const e of compareEdges) {
    if (!baseEdgeKeys.has(edgeKey(e))) edges.push({ kind: 'added', label: labelForEdge(e) })
  }
  for (const e of baseEdges) {
    if (!compareEdgeKeys.has(edgeKey(e))) edges.push({ kind: 'removed', label: labelForEdge(e) })
  }

  const counts = {
    added: nodes.filter((n) => n.kind === 'added').length,
    removed: nodes.filter((n) => n.kind === 'removed').length,
    modified: nodes.filter((n) => n.kind === 'modified').length,
  }

  return {
    nodes,
    edges,
    counts,
    hasChanges: nodes.length > 0 || edges.length > 0,
  }
}
