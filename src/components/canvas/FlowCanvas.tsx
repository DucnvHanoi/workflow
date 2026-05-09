'use client'

import { useEffect } from 'react'
import { useCanvasStore, type TenantUser, type TenantDepartment } from '@/store/canvas-store'
import { ReactFlow, Background, BackgroundVariant, Controls, MiniMap } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { TriggerNode } from './nodes/TriggerNode'
import { ActionNode } from './nodes/ActionNode'
import { BranchNode } from './nodes/BranchNode'
import { CompleteNode } from './nodes/CompleteNode'
import { NodeToolbar } from './NodeToolbar'
import ConfigSidebar from './panels/ConfigSidebar'

// ─── Node types must be defined OUTSIDE the component ────────────────────────
// Defining inside causes React Flow to re-register on every render → flickering

const nodeTypes = {
  trigger: TriggerNode,
  action: ActionNode,
  branch: BranchNode,
  complete: CompleteNode,
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface FlowCanvasProps {
  flowId: string
  users: TenantUser[]
  departments: TenantDepartment[]
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function FlowCanvas({ flowId, users, departments }: FlowCanvasProps) {
  const {
    nodes,
    edges,
    selectedNodeId,
    onNodesChange,
    onEdgesChange,
    onConnect,
    setSelectedNodeId,
    reset,
  } = useCanvasStore()

  // Reset canvas state when navigating to a different flow
  useEffect(() => {
    reset()
  }, [flowId, reset])

  const selectedNode = nodes.find((n) => n.id === selectedNodeId)

  return (
    <div className="relative flex h-full w-full overflow-hidden">
      {/* ── Canvas area — shrinks when sidebar is open ─────────────── */}
      <div
        className="h-full transition-all duration-200"
        style={{ width: selectedNode ? 'calc(100% - 288px)' : '100%' }}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={(_, node) => setSelectedNodeId(node.id)}
          onPaneClick={() => setSelectedNodeId(null)}
          fitView
        >
          <Background variant={BackgroundVariant.Dots} gap={16} color="#d1d5db" />
          <MiniMap
            nodeColor={(node) => {
              switch (node.type) {
                case 'trigger':
                  return '#10b981' // emerald-500
                case 'action':
                  return '#3b82f6' // blue-500
                case 'branch':
                  return '#f59e0b' // amber-500
                case 'complete':
                  return '#8b5cf6' // violet-500
                default:
                  return '#6b7280'
              }
            }}
          />
          <Controls />
        </ReactFlow>
      </div>

      {/* ── Node toolbar — left edge ───────────────────────────────── */}
      <NodeToolbar />

      {/* ── Config sidebar — right edge ────────────────────────────── */}
      <ConfigSidebar selectedNode={selectedNode} users={users} departments={departments} />
    </div>
  )
}
