// FILE PATH: src/lib/flows/graph-utils.ts
// Utility functions for walking/traversing the flow graph at runtime.
// Kept separate from graph.ts (which handles serialization) to avoid
// pulling canvas-only types into server-side runtime code.

import type { SerializedGraph } from '@/lib/flows/graph'

// ─── walkGraphOrder ───────────────────────────────────────────────────────────
// BFS from the trigger node to produce the canonical traversal order of node ids.
// Returns node ids in the order they are encountered (trigger first, complete last).
// Used by the instance detail page to render the step timeline in flow order
// rather than DB insert order.

export function walkGraphOrder(graph: SerializedGraph): string[] {
  const triggerNode = graph.nodes.find((n) => n.type === 'trigger')
  if (!triggerNode) return graph.nodes.map((n) => n.id)

  const edgeMap = new Map<string, string[]>()
  for (const e of graph.edges) {
    if (!edgeMap.has(e.source)) edgeMap.set(e.source, [])
    edgeMap.get(e.source)!.push(e.target)
  }

  const visited = new Set<string>()
  const order: string[] = []
  const queue: string[] = [triggerNode.id]

  while (queue.length > 0) {
    const id = queue.shift()!
    if (visited.has(id)) continue
    visited.add(id)
    order.push(id)
    const children = edgeMap.get(id) ?? []
    queue.push(...children)
  }

  return order
}
