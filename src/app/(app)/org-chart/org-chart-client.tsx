'use client'

import { useCallback, useMemo, useEffect } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Panel,
  Position,
  MarkerType,
  useNodesState,
  useEdgesState,
  type NodeProps,
  type Node,
  type Edge,
  type Connection,
} from '@xyflow/react'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { updateUserManager } from './actions'

export type OrgUser = {
  id: string
  name: string | null
  email: string
  role: string
  manager_id: string | null
  department_id: string | null
  department: string | null
  avatar_url: string | null
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
  avatarUrl: string | null
  isDeptHead: boolean
  isAdmin: boolean
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
    if (i > 0) nextLeafSlot++
    place(root, 0)
  })

  return positions
}

function computeGraph(users: OrgUser[], departments: OrgDepartment[], isAdmin: boolean) {
  const idSet = new Set(users.map((u) => u.id))

  const deptById = new Map(departments.map((d) => [d.id, d]))

  const headOfDept = new Map<string, string>()
  for (const d of departments) {
    if (d.head_user_id && idSet.has(d.head_user_id)) {
      headOfDept.set(d.head_user_id, d.id)
    }
  }
  const isDeptHeadSet = new Set(headOfDept.keys())

  const parentMap = new Map<string, string | null>()

  for (const u of users) {
    if (isDeptHeadSet.has(u.id)) {
      const deptId = headOfDept.get(u.id)!
      const dept = deptById.get(deptId)
      if (dept?.parent_id) {
        const parentDept = deptById.get(dept.parent_id)
        if (parentDept?.head_user_id && idSet.has(parentDept.head_user_id)) {
          parentMap.set(u.id, parentDept.head_user_id)
        } else {
          parentMap.set(u.id, null)
        }
      } else {
        parentMap.set(u.id, null)
      }
    } else {
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
      avatarUrl: u.avatar_url,
      isDeptHead: isDeptHeadSet.has(u.id),
      isAdmin,
    } satisfies OrgNodeData,
  }))

  const edges: Edge[] = []
  parentMap.forEach((parentId, userId) => {
    if (parentId !== null) {
      edges.push(makeEdge(parentId, userId))
    }
  })

  return { nodes, edges }
}

// ─── helpers ─────────────────────────────────────────────────────────────────

const EDGE_COLOR = '#64748b'

function getInitials(name: string | null, email: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/)
    return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase()
  }
  return email[0].toUpperCase()
}

function makeEdge(source: string, target: string): Edge {
  return {
    id: `e-${source}-${target}`,
    source,
    target,
    type: 'smoothstep',
    markerEnd: { type: MarkerType.ArrowClosed, width: 12, height: 12, color: EDGE_COLOR },
    style: { stroke: EDGE_COLOR, strokeWidth: 1.5 },
  }
}

/** Returns true if drawing source→target would create a cycle. */
function wouldCreateCycle(source: string, target: string, edges: Edge[]): boolean {
  const visited = new Set<string>()
  let cur = source
  while (true) {
    if (cur === target) return true
    if (visited.has(cur)) break
    visited.add(cur)
    const up = edges.find((e) => e.target === cur)
    if (!up) break
    cur = up.source
  }
  return false
}

// ─── custom node (must be defined outside parent component) ──────────────────

function OrgNode({ data }: NodeProps) {
  const d = data as OrgNodeData
  const handleStyle = d.isAdmin ? undefined : { visibility: 'hidden' as const }

  return (
    <div className="w-48 rounded-xl border bg-card shadow-sm px-3 py-2.5 text-left select-none">
      <Handle type="target" position={Position.Top} style={handleStyle} />
      <div className="flex items-center gap-2.5">
        <div
          className={`flex items-center justify-center w-9 h-9 rounded-full font-semibold text-sm shrink-0 overflow-hidden ${
            d.avatarUrl
              ? ''
              : d.isDeptHead
                ? 'bg-amber-100 text-amber-700'
                : 'bg-primary/10 text-primary'
          }`}
        >
          {d.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={String(d.avatarUrl)}
              alt={String(d.name ?? d.email)}
              className="w-full h-full object-cover"
            />
          ) : (
            String(d.initials)
          )}
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
      <Handle type="source" position={Position.Bottom} style={handleStyle} />
    </div>
  )
}

const nodeTypes = { org: OrgNode }

// ─── chart component ──────────────────────────────────────────────────────────

interface Props {
  users: OrgUser[]
  departments: OrgDepartment[]
  isAdmin: boolean
}

export function OrgChartClient({ users, departments, isAdmin }: Props) {
  // Recompute layout whenever manager relationships or dept heads change
  const graphKey = useMemo(() => {
    const u = users.map((u) => `${u.id}:${u.manager_id ?? ''}`).join('|')
    const d = departments.map((d) => `${d.id}:${d.head_user_id ?? ''}`).join('|')
    return u + '||' + d
  }, [users, departments])

  const computedGraph = useMemo(
    () => computeGraph(users, departments, isAdmin),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [graphKey, isAdmin]
  )

  const [nodes, setNodes, onNodesChange] = useNodesState(computedGraph.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(computedGraph.edges)

  // Sync when server data changes (e.g. after another browser tab makes a change)
  useEffect(() => {
    setNodes(computedGraph.nodes)
    setEdges(computedGraph.edges)
  }, [computedGraph, setNodes, setEdges])

  const onConnect = useCallback(
    async (connection: Connection) => {
      const { source, target } = connection
      if (!source || !target || source === target) return

      if (wouldCreateCycle(source, target, edges)) {
        toast.error('Cannot connect: this would create a circular reporting chain.')
        return
      }

      // A person can only have one manager — remove any existing manager edge for target
      const prevEdge = edges.find((e) => e.target === target)
      const filtered = edges.filter((e) => e.target !== target)
      const newEdge = makeEdge(source, target)

      setEdges([...filtered, newEdge])

      const result = await updateUserManager(target, source)
      if (result.error) {
        toast.error(result.error)
        setEdges(prevEdge ? [...filtered, prevEdge] : filtered)
      } else {
        toast.success('Manager updated.')
      }
    },
    [edges, setEdges]
  )

  const onEdgesDelete = useCallback(
    async (deletedEdges: Edge[]) => {
      for (const edge of deletedEdges) {
        const result = await updateUserManager(edge.target, null)
        if (result.error) {
          toast.error(result.error)
          setEdges((prev) => [...prev, edge])
        } else {
          toast.success('Manager removed.')
        }
      }
    },
    [setEdges]
  )

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
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={isAdmin ? onConnect : undefined}
      onEdgesDelete={isAdmin ? onEdgesDelete : undefined}
      fitView
      fitViewOptions={{ padding: 0.15 }}
      nodesDraggable={isAdmin}
      nodesConnectable={isAdmin}
      elementsSelectable={isAdmin}
      deleteKeyCode={isAdmin ? ['Delete', 'Backspace'] : null}
      panOnScroll
    >
      <Background />
      <Controls showInteractive={false} />
      {isAdmin && (
        <Panel position="top-right">
          <p className="rounded-md border bg-card px-2.5 py-1.5 text-xs text-muted-foreground shadow-sm">
            Drag handle → node to set manager · Select edge + Delete to remove
          </p>
        </Panel>
      )}
    </ReactFlow>
  )
}
