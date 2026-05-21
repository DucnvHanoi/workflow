import { describe, it, expect } from 'vitest'
import { diffGraphs } from '@/lib/flows/diff'
import type { SerializedGraph, SerializedNode, SerializedEdge } from '@/lib/flows/graph'
import type { NodeData, FormField, AssigneeRule, BranchCondition } from '@/store/canvas-store'

// ─── Fixture helpers ──────────────────────────────────────────────────────────

function node(id: string, type: string, data: Partial<NodeData> = {}): SerializedNode {
  return {
    id,
    type,
    position: { x: 0, y: 0 },
    data: {
      label: id,
      description: '',
      formSchema: [],
      assigneeRule: null,
      branchConditions: [],
      ...data,
    },
  }
}

function graph(nodes: SerializedNode[], edges: SerializedEdge[] = []): SerializedGraph {
  return { nodes, edges, metadata: { schemaVersion: 1 } }
}

const field = (id: string, patch: Partial<FormField> = {}): FormField => ({
  id,
  type: 'text',
  label: id,
  required: false,
  ...patch,
})

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('diffGraphs', () => {
  it('reports no changes for identical graphs', () => {
    const g = graph(
      [node('t', 'trigger'), node('a', 'action')],
      [{ id: 'e1', source: 't', target: 'a' }]
    )
    const d = diffGraphs(g, structuredClone(g))
    expect(d.hasChanges).toBe(false)
    expect(d.nodes).toHaveLength(0)
    expect(d.edges).toHaveLength(0)
    expect(d.counts).toEqual({ added: 0, removed: 0, modified: 0 })
  })

  it('detects an added node', () => {
    const base = graph([node('t', 'trigger')])
    const compare = graph([node('t', 'trigger'), node('a', 'action', { label: 'Approve' })])
    const d = diffGraphs(base, compare)
    expect(d.counts.added).toBe(1)
    expect(d.nodes.find((n) => n.kind === 'added' && n.id === 'a')).toMatchObject({
      label: 'Approve',
      type: 'action',
    })
  })

  it('detects a removed node', () => {
    const base = graph([node('t', 'trigger'), node('a', 'action')])
    const compare = graph([node('t', 'trigger')])
    const d = diffGraphs(base, compare)
    expect(d.counts.removed).toBe(1)
    expect(d.nodes[0]).toMatchObject({ kind: 'removed', id: 'a' })
  })

  it('detects rename, description, assignee, and branch-logic changes', () => {
    const assigneeA: AssigneeRule = { type: 'fixed', email: 'a@x.com' }
    const assigneeB: AssigneeRule = { type: 'manager_of_requestor' }
    const condB: BranchCondition = {
      id: 'c1',
      fieldId: 'f1',
      operator: 'eq',
      value: 'yes',
      handleId: 'yes',
    }
    const base = graph([
      node('a', 'action', { label: 'Old', description: 'd1', assigneeRule: assigneeA }),
    ])
    const compare = graph([
      node('a', 'action', {
        label: 'New',
        description: 'd2',
        assigneeRule: assigneeB,
        branchConditions: [condB],
      }),
    ])
    const d = diffGraphs(base, compare)
    expect(d.counts.modified).toBe(1)
    const mod = d.nodes[0]
    expect(mod.kind).toBe('modified')
    if (mod.kind === 'modified') {
      const joined = mod.changes.join(' | ')
      expect(joined).toContain('renamed')
      expect(joined).toContain('description changed')
      expect(joined).toContain('assignee')
      expect(joined).toContain('branch logic changed')
    }
  })

  it('detects field add / remove / modify within a node', () => {
    const base = graph([
      node('a', 'action', { formSchema: [field('f1', { label: 'Name' }), field('f2')] }),
    ])
    const compare = graph([
      node('a', 'action', {
        formSchema: [
          field('f1', { label: 'Full Name', required: true }), // modified
          field('f3'), // added
          // f2 removed
        ],
      }),
    ])
    const d = diffGraphs(base, compare)
    const mod = d.nodes[0]
    expect(mod.kind).toBe('modified')
    if (mod.kind === 'modified') {
      const kinds = mod.fieldChanges.map((f) => f.kind)
      expect(kinds).toContain('added')
      expect(kinds).toContain('removed')
      expect(kinds).toContain('modified')
      const modified = mod.fieldChanges.find((f) => f.kind === 'modified')
      if (modified && modified.kind === 'modified') {
        expect(modified.changes.join(' ')).toMatch(/label|now required/)
      }
    }
  })

  it('detects added and removed connections', () => {
    const nodes = [node('t', 'trigger'), node('a', 'action'), node('c', 'complete')]
    const base = graph(nodes, [{ id: 'e1', source: 't', target: 'a' }])
    const compare = graph(nodes, [{ id: 'e2', source: 'a', target: 'c' }])
    const d = diffGraphs(base, compare)
    expect(d.edges.some((e) => e.kind === 'added')).toBe(true)
    expect(d.edges.some((e) => e.kind === 'removed')).toBe(true)
  })

  it('treats branch handle changes as distinct edges', () => {
    const nodes = [node('b', 'branch'), node('x', 'action'), node('y', 'action')]
    const base = graph(nodes, [{ id: 'e1', source: 'b', target: 'x', sourceHandle: 'yes' }])
    const compare = graph(nodes, [{ id: 'e1', source: 'b', target: 'x', sourceHandle: 'no' }])
    const d = diffGraphs(base, compare)
    expect(d.edges.filter((e) => e.kind === 'added')).toHaveLength(1)
    expect(d.edges.filter((e) => e.kind === 'removed')).toHaveLength(1)
  })
})
