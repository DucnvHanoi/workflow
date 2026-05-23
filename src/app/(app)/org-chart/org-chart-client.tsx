'use client'

import { useMemo } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MarkerType,
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
  department_id: string | null
  department: string | null
}

export type OrgDepartment = {
  id: string
  parent_id: string | null
  head_user_id: string | null
}

type OrgNodeData = Record<string, unknown> & {
  name: string | null
  email: string
  role: string
  department: string | null
  initials: string
  isDeptHead: boolean
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
        <div
          className={`flex items-center justify-center w-9 h-9 rounded-full font-semibold text-sm shrink-0 ${
            d.isDeptHead ? 'bg-amber-100 text-amber-700' : 'bg-primary/10 text-primary'
          }`}
        >
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
        <div className="ml-auto flex items-center gap-1 shrink-0">
          {d.isDeptHead && (
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 border-amber-300 text-amber-700"
            >
              Head
            </Badge>
          )}
          <Badge
            variant={d.role === 'admin' ? 'default' : 'secondary'}
            className="text-[10px] px-1.5 py-0"
          >
            {String(d.role)}
          </Badge>
        </div>
      </div>
    </div>
  )
}

const nodeTypes = { org: OrgNode }

// ─── chart component ──────────────────────────────────────────────────────────

interface Props {
  users: OrgUser[]
  departments: OrgDepartment[]
}

export function OrgChartClient({ users, departments }: Props) {
  const { nodes, edges } = useMemo(() => {
    const idSet = new Set(users.map((u) => u.id))

    // Department lookups
    const deptById = new Map(departments.map((d) => [d.id, d]))

    // Map: userId → deptId they are head of
    const headOfDept = new Map<string, string>()
    for (const d of departments) {
      if (d.head_user_id && idSet.has(d.head_user_id)) {
        headOfDept.set(d.head_user_id, d.id)
      }
    }
    const isDeptHeadSet = new Set(headOfDept.keys())

    // Determine parent for each user
    const parentMap = new Map<string, string | null>()

    for (const u of users) {
      if (isDeptHeadSet.has(u.id)) {
        // Dept head: place by department hierarchy
        const deptId = headOfDept.get(u.id)!
        const dept = deptById.get(deptId)
        if (dept?.parent_id) {
          const parentDept = deptById.get(dept.parent_id)
          if (parentDept?.head_user_id && idSet.has(parentDept.head_user_id)) {
            parentMap.set(u.id, parentDept.head_user_id)
          } else {
            parentMap.set(u.id, null) // parent dept has no head → become root
          }
        } else {
          parentMap.set(u.id, null) // top-level dept → root
        }
      } else {
        // Regular member: manager_id → dept head fallback → root
        if (u.manager_id && idSet.has(u.manager_id)) {
          parentMap.set(u.id, u.manager_id)
        } else if (u.department_id) {
          const dept = deptById.get(u.department_id)
          if (dept?.head_user_id && dept.head_user_id !== u.id && idSet.has(dept.head_user_id)) {
            parentMap.set(u.id, dept.head_user_id)
          } else {
            parentMap.set(u.id, null)
          }
        } else {
          parentMap.set(u.id, null)
        }
      }
    }

    // Build children map from parent assignments
    const childrenMap = new Map<string, string[]>()
    parentMap.forEach((parentId, userId) => {
      if (parentId !== null) {
        const arr = childrenMap.get(parentId) ?? []
        arr.push(userId)
        childrenMap.set(parentId, arr)
      }
    })

    const roots = users.filter((u) => parentMap.get(u.id) === null).map((u) => u.id)
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
        isDeptHead: isDeptHeadSet.has(u.id),
      } satisfies OrgNodeData,
    }))

    const edges: Edge[] = []
    parentMap.forEach((parentId, userId) => {
      if (parentId !== null) {
        edges.push({
          id: `e-${parentId}-${userId}`,
          source: parentId,
          target: userId,
          type: 'smoothstep',
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 12,
            height: 12,
            color: 'hsl(var(--muted-foreground))',
          },
          style: { stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1.5 },
        })
      }
    })

    return { nodes, edges }
  }, [users, departments])

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
