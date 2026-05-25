'use client'

// FILE PATH: src/components/canvas/FlowCanvas.tsx
// nodeTypes MUST be defined outside this component — defining inside causes
// React Flow to re-register on every render, causing node flicker.

import { useEffect, useCallback, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Connection,
  type NodeChange,
  type EdgeChange,
  type IsValidConnection,
  BackgroundVariant,
} from '@xyflow/react'
// import '@xyflow/react/dist/style.css'

import { useCanvasStore } from '@/store/canvas-store'
import type { TenantUser, TenantDepartment } from '@/store/canvas-store'
import type { Node, Edge } from '@xyflow/react'
import { deserializeGraph, type SerializedGraph } from '@/lib/flows/graph'
import { getLatestDraftGraph } from '@/lib/flows/actions'
import { AiFlowGeneratorDialog } from './AiFlowGeneratorDialog'

import { TriggerNode } from './nodes/TriggerNode'
import { ActionNode } from './nodes/ActionNode'
import { BranchNode } from './nodes/BranchNode'
import { CompleteNode } from './nodes/CompleteNode'
import { NodeToolbar } from './NodeToolbar'
import ConfigSidebar from './panels/ConfigSidebar'

// ─── nodeTypes outside component (required by React Flow) ────────────────────

const nodeTypes = {
  trigger: TriggerNode,
  action: ActionNode,
  branch: BranchNode,
  complete: CompleteNode,
}

// ─── Change types that should trigger auto-save ───────────────────────────────
// 'select' and 'dimensions' fire on every click/layout — must NOT save on those.
// Structural changes snapshot a NEW version; position-only moves update the
// latest draft in place (see triggerPositionSave) so dragging doesn't bump the
// version number on every move.

const STRUCTURAL_NODE_CHANGES = new Set(['add', 'remove', 'reset'])

// ─── Props ────────────────────────────────────────────────────────────────────

interface FlowCanvasProps {
  flowId: string
  flowStatus: 'draft' | 'published'
  users: TenantUser[]
  departments: TenantDepartment[]
  initialNodes: Node[]
  initialEdges: Edge[]
  initialAllowedDeptIds: string[]
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function FlowCanvas({
  flowId,
  flowStatus: initialFlowStatus,
  users,
  departments,
  initialNodes,
  initialEdges,
  initialAllowedDeptIds,
}: FlowCanvasProps) {
  const {
    nodes,
    edges,
    selectedNodeId,
    isReadOnly,
    onNodesChange: storeOnNodesChange,
    onEdgesChange: storeOnEdgesChange,
    onConnect: storeOnConnect,
    setSelectedNodeId,
    triggerSave,
    triggerPositionSave,
    setFlowId,
    reset,
  } = useCanvasStore()

  const [currentFlowStatus, setCurrentFlowStatus] = useState<'draft' | 'published'>(
    initialFlowStatus
  )
  const [aiDialogOpen, setAiDialogOpen] = useState(false)

  // ── Hydrate store from DB on mount ────────────────────────────────────────
  // Always hydrate from DB — never trust React Flow's default empty state.

  useEffect(() => {
    reset()
    setFlowId(flowId)
    if (initialNodes.length > 0 || initialEdges.length > 0) {
      useCanvasStore.setState({ nodes: initialNodes, edges: initialEdges })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flowId])

  // ── Selected node ─────────────────────────────────────────────────────────

  const selectedNode = nodes.find((n) => n.id === selectedNodeId)

  // ── onNodesChange — filter to save-worthy changes only ───────────────────

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      storeOnNodesChange(changes)
      if (isReadOnly) return
      const hasStructural = changes.some((c) => STRUCTURAL_NODE_CHANGES.has(c.type))
      const hasPosition = changes.some((c) => c.type === 'position')
      // Structural wins: an add/remove in the same batch should snapshot a new
      // version rather than fold into the draft via an in-place position save.
      if (hasStructural) triggerSave()
      else if (hasPosition) triggerPositionSave()
    },
    [storeOnNodesChange, triggerSave, triggerPositionSave, isReadOnly]
  )

  // ── onEdgesChange ─────────────────────────────────────────────────────────

  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      storeOnEdgesChange(changes)
      if (!isReadOnly) triggerSave()
    },
    [storeOnEdgesChange, triggerSave, isReadOnly]
  )

  // ── onConnect ─────────────────────────────────────────────────────────────

  const handleConnect = useCallback(
    (connection: Connection) => {
      storeOnConnect(connection)
      if (!isReadOnly) triggerSave()
    },
    [storeOnConnect, triggerSave, isReadOnly]
  )

  // ── isValidConnection — 8 connection rules ────────────────────────────────

  const isValidConnection: IsValidConnection = useCallback(
    (connection) => {
      const { source, target, sourceHandle } = connection
      if (!source || !target) return false

      // Rule 1: no self-loops
      if (source === target) return false

      // Rule 2: no cycles — BFS from target; if we can reach source, block
      const adjacency = new Map<string, string[]>()
      for (const edge of edges) {
        if (!adjacency.has(edge.source)) adjacency.set(edge.source, [])
        adjacency.get(edge.source)!.push(edge.target)
      }
      const visited = new Set<string>()
      const queue = [target]
      while (queue.length > 0) {
        const current = queue.shift()!
        if (current === source) return false
        if (visited.has(current)) continue
        visited.add(current)
        for (const next of adjacency.get(current) ?? []) queue.push(next)
      }

      const sourceNode = nodes.find((n) => n.id === source)
      const targetNode = nodes.find((n) => n.id === target)
      if (!sourceNode || !targetNode) return false

      // Rule 3: trigger node cannot have inbound edges
      if (targetNode.type === 'trigger') return false

      // Rule 4: complete node cannot have outbound edges
      if (sourceNode.type === 'complete') return false

      const outboundFromSource = edges.filter((e) => e.source === source)

      // Rule 5: trigger and action nodes max 1 outbound edge
      if (
        (sourceNode.type === 'trigger' || sourceNode.type === 'action') &&
        outboundFromSource.length >= 1
      ) {
        return false
      }

      // Rule 6: branch node max 2 outbound, one per handle (yes/no)
      if (sourceNode.type === 'branch') {
        if (outboundFromSource.length >= 2) return false
        const handleAlreadyUsed = outboundFromSource.some((e) => e.sourceHandle === sourceHandle)
        if (handleAlreadyUsed) return false
      }

      // Rule 7: no duplicate edges (same source + target pair)
      const duplicate = edges.some((e) => e.source === source && e.target === target)
      if (duplicate) return false

      // Rule 8: branch yes/no handles must connect to different target nodes
      if (sourceNode.type === 'branch') {
        const otherHandle = outboundFromSource.find((e) => e.sourceHandle !== sourceHandle)
        if (otherHandle && otherHandle.target === target) return false
      }

      return true
    },
    [nodes, edges]
  )

  // ── Apply AI-generated graph to canvas ────────────────────────────────────

  const handleGraphGenerated = useCallback(
    (graph: SerializedGraph) => {
      const { nodes: n, edges: e } = deserializeGraph(graph)
      useCanvasStore.setState({ nodes: n, edges: e })
      triggerSave()
    },
    [triggerSave]
  )

  // ── Re-hydrate after version restore / preview exit ───────────────────────

  const handleVersionRestored = useCallback(async () => {
    const { graph } = await getLatestDraftGraph(flowId)
    if (!graph) return
    const { nodes: n, edges: e } = deserializeGraph(graph)
    useCanvasStore.setState({ nodes: n, edges: e, isReadOnly: false })
  }, [flowId])

  // ── Render ────────────────────────────────────────────────────────────────
  // FIX: use flex row so ReactFlow and sidebar sit side by side.
  // Sidebar is always visible — no more translate-x-full hiding.
  // ReactFlow fills the remaining width naturally via flex-1.

  return (
    <div className="h-full w-full flex">
      {/* ── Canvas area ───────────────────────────────────────────────── */}
      <div className="flex-1 relative min-w-0">
        {/* Read-only banner */}
        {isReadOnly && (
          <div className="absolute top-0 left-0 right-0 z-10 bg-amber-50 border-b border-amber-200 text-center py-1.5 text-xs text-amber-700 font-medium pointer-events-none">
            Read-only preview — use the Versions panel to restore
          </div>
        )}

        {/* Add-node toolbar */}
        {!isReadOnly && <NodeToolbar onAiClick={() => setAiDialogOpen(true)} />}

        {/* AI flow generator dialog */}
        <AiFlowGeneratorDialog
          open={aiDialogOpen}
          onOpenChange={setAiDialogOpen}
          hasExistingNodes={nodes.length > 0}
          onGraphGenerated={handleGraphGenerated}
        />

        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onConnect={handleConnect}
          isValidConnection={isValidConnection}
          onNodeClick={(_, node) => setSelectedNodeId(node.id)}
          onPaneClick={() => setSelectedNodeId(null)}
          nodesDraggable={!isReadOnly}
          nodesConnectable={!isReadOnly}
          elementsSelectable={!isReadOnly}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          style={{ width: '100%', height: '100%' }}
        >
          <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
          <Controls />
          <MiniMap zoomable pannable />
        </ReactFlow>
      </div>

      {/* ── Sidebar — always visible, fixed 288px width ───────────────── */}
      <div className="w-72 shrink-0 h-full border-l border-border bg-background flex flex-col overflow-hidden">
        <ConfigSidebar
          selectedNode={selectedNode}
          users={users}
          departments={departments}
          flowId={flowId}
          flowStatus={currentFlowStatus}
          onFlowStatusChange={setCurrentFlowStatus}
          onVersionRestored={handleVersionRestored}
          initialAllowedDeptIds={initialAllowedDeptIds}
        />
      </div>
    </div>
  )
}
