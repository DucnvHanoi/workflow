'use client'

import { useMemo } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  type NodeProps,
  type Node,
  type Edge,
} from '@xyflow/react'
import { Badge } from '@/components/ui/badge'

export type OrgUser = {
  id: string
  name: string | null
  email: string
  role: string
  manager_id: string | null
  department: string | null
}

type OrgNodeData = Record<string, unknown> & {
  name: string | null
  email: string
  role: string
  department: string | null
  initials: string
}

// ─── layout ──────────────────────────────────────────────────────────────────

const NODE_W = 200
const NODE_H = 90
const H_GAP = 40
const V_GAP = 90

function computeLayout(
  roots: string[],
  childrenMap: Map<string, string[]>
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>()
  let nextLeafSlot = 0

  function place(id: string, depth: number): number {
    const children = childrenMap.get(id) ?? []
    if (children.length === 0) {
      const x = nextLeafSlot * (NODE_W + H_GAP)
      nextLeafSlot++
      positions.set(id, { x, y: depth * (NODE_H + V_GAP) })
      return x
    }
    const childXs = children.map((c) => place(c, depth + 1))
    const x = (childXs[0] + childXs[childXs.length - 1]) / 2
    positions.set(id, { x, y: depth * (NODE_H + V_GAP) })
    return x
  }

  roots.forEach((root, i) => {
    if (i > 0) nextLeafSlot++ // extra gap between separate trees
    place(root, 0)
  })

  return positions
}

// ─── custom node (must be defined outside the parent component) ───────────────

function getInitials(name: string | null, email: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/)
    return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase()
  }
  return email[0].toUpperCase()
}

function OrgNode({ data }: NodeProps) {
  const d = data as OrgNodeData
  return (
    <div className="w-48 rounded-xl border bg-card shadow-sm px-3 py-2.5 text-left select-none">
      <div className="flex items-center gap-2.5">
        <div className="flex items-center justify-center w-9 h-9 rounded-full bg-primary/10 text-primary font-semibold text-sm shrink-0">
          {String(d.initials)}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium leading-tight truncate">
            {d.name ? String(d.name) : String(d.email)}
          </p>
          <p className="text-xs text-muted-foreground truncate">{String(d.email)}</p>
        </div>
      </div>
      <div className="mt-1.5 flex items-center gap-1">
        {d.department && (
          <span className="text-xs text-muted-foreground truncate flex-1">
            {String(d.department)}
          </span>
        )}
        <Badge
          variant={d.role === 'admin' ? 'default' : 'secondary'}
          className="text-[10px] px-1.5 py-0 ml-auto shrink-0"
        >
          {String(d.role)}
        </Badge>
      </div>
    </div>
  )
}

const nodeTypes = { org: OrgNode }

// ─── chart component ──────────────────────────────────────────────────────────

interface Props {
  users: OrgUser[]
}

export function OrgChartClient({ users }: Props) {
  const { nodes, edges } = useMemo(() => {
    const idSet = new Set(users.map((u) => u.id))

    const childrenMap = new Map<string, string[]>()
    for (const u of users) {
      if (u.manager_id && idSet.has(u.manager_id)) {
        const arr = childrenMap.get(u.manager_id) ?? []
        arr.push(u.id)
        childrenMap.set(u.manager_id, arr)
      }
    }

    const roots = users.filter((u) => !u.manager_id || !idSet.has(u.manager_id)).map((u) => u.id)

    const positions = computeLayout(roots, childrenMap)

    const nodes: Node[] = users.map((u) => ({
      id: u.id,
      type: 'org',
      position: positions.get(u.id) ?? { x: 0, y: 0 },
      data: {
        name: u.name,
        email: u.email,
        role: u.role,
        department: u.department,
        initials: getInitials(u.name, u.email),
      } satisfies OrgNodeData,
    }))

    const edges: Edge[] = users
      .filter((u) => u.manager_id && idSet.has(u.manager_id))
      .map((u) => ({
        id: `e-${u.manager_id}-${u.id}`,
        source: u.manager_id!,
        target: u.id,
        type: 'smoothstep',
        style: { stroke: 'hsl(var(--border))' },
      }))

    return { nodes, edges }
  }, [users])

  if (users.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        No users to display.
      </div>
    )
  }

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.15 }}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      panOnScroll
    >
      <Background />
      <Controls showInteractive={false} />
    </ReactFlow>
  )
}
