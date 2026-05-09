'use client'

import { useCallback, useEffect } from 'react'
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  type NodeTypes,
  type Node,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { useCanvasStore } from '@/store/canvas-store'
import { TriggerNode } from './nodes/TriggerNode'
import { ActionNode } from './nodes/ActionNode'
import { BranchNode } from './nodes/BranchNode'
import { CompleteNode } from './nodes/CompleteNode'
import { NodeToolbar } from './NodeToolbar'
import { ConfigSidebar } from './panels/ConfigSidebar'

// Must be outside component — React Flow requirement
const nodeTypes: NodeTypes = {
  trigger: TriggerNode,
  action: ActionNode,
  branch: BranchNode,
  complete: CompleteNode,
}

interface FlowCanvasProps {
  flowId: string
}

export function FlowCanvas({ flowId }: FlowCanvasProps) {
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

  useEffect(() => {
    reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flowId])

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      setSelectedNodeId(node.id)
    },
    [setSelectedNodeId]
  )

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null)
  }, [setSelectedNodeId])

  return (
    // position:relative so sidebar can use position:absolute within this container
    <div className="relative h-full w-full overflow-hidden">
      <NodeToolbar />

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        fitView
        deleteKeyCode="Delete"
        // Shrink the canvas area when sidebar is open to avoid overlap
        style={{ width: selectedNode ? 'calc(100% - 288px)' : '100%' }}
        className="bg-gray-50"
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#d1d5db" />
        <Controls />
        <MiniMap
          nodeColor={(node) => {
            const colors: Record<string, string> = {
              trigger: '#10b981',
              action: '#3b82f6',
              branch: '#f59e0b',
              complete: '#8b5cf6',
            }
            return colors[node.type ?? ''] ?? '#9ca3af'
          }}
          className="!bottom-4 !right-4"
        />
      </ReactFlow>

      {/* Sidebar overlays the right edge of the container */}
      <ConfigSidebar selectedNode={selectedNode} />
    </div>
  )
}
