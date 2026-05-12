'use client'

// FILE PATH: src/components/canvas/panels/ConfigSidebar.tsx

import { useState, useCallback } from 'react'
import { X } from 'lucide-react'
import type { Node } from '@xyflow/react'
import { useCanvasStore, type TenantUser, type TenantDepartment } from '@/store/canvas-store'
import { deserializeGraph } from '@/lib/flows/graph'
import { getLatestDraftGraph } from '@/lib/flows/actions'
import StepConfigPanel from './StepConfigPanel'
import BranchConfigPanel from './BranchConfigPanel'
import FormBuilderPanel from './FormBuilderPanel'
import AssigneePanel from './AssigneePanel'
import VersionListPanel from './VersionListPanel'
import PublishPanel from './PublishPanel'

// ─── Props ────────────────────────────────────────────────────────────────────

interface ConfigSidebarProps {
  selectedNode: Node | undefined
  users: TenantUser[]
  departments: TenantDepartment[]
  // Day 30 additions:
  flowId: string
  flowStatus: 'draft' | 'published'
  onFlowStatusChange: (status: 'draft' | 'published') => void
}

// ─── No-node-selected panel (Publish + Versions tabs) ────────────────────────

type SidebarTab = 'publish' | 'versions'

interface IdlePanelProps {
  flowId: string
  flowStatus: 'draft' | 'published'
  onFlowStatusChange: (status: 'draft' | 'published') => void
  onVersionRestored: () => void
}

function IdlePanel({ flowId, flowStatus, onFlowStatusChange, onVersionRestored }: IdlePanelProps) {
  const [tab, setTab] = useState<SidebarTab>('publish')

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex border-b border-border shrink-0">
        {(['publish', 'versions'] as SidebarTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`
              flex-1 py-2.5 text-xs font-medium capitalize transition-colors
              ${
                tab === t
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }
            `}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {tab === 'publish' ? (
          <PublishPanel
            flowId={flowId}
            flowStatus={flowStatus}
            onStatusChange={onFlowStatusChange}
          />
        ) : (
          <VersionListPanel flowId={flowId} onRestored={onVersionRestored} />
        )}
      </div>
    </div>
  )
}

// ─── Main sidebar ─────────────────────────────────────────────────────────────

export default function ConfigSidebar({
  selectedNode,
  users,
  departments,
  flowId,
  flowStatus,
  onFlowStatusChange,
}: ConfigSidebarProps) {
  const { setSelectedNodeId, setReadOnly } = useCanvasStore()

  const isOpen = !!selectedNode
  const hasFormAndAssignee = selectedNode?.type === 'action' || selectedNode?.type === 'branch'

  // Re-hydrates the canvas from the DB after a version restore or preview exit.
  // Defined here so it can be passed down to both IdlePanel → VersionListPanel.
  const handleVersionRestored = useCallback(async () => {
    const { graph } = await getLatestDraftGraph(flowId)
    if (!graph) return
    const { nodes, edges } = deserializeGraph(graph)
    // Update the store directly — same pattern as FlowCanvas hydration on mount
    const store = useCanvasStore.getState()
    store.reset()
    store.setFlowId(flowId)
    setReadOnly(false)
    // Manually set nodes/edges via the store's internal setter
    useCanvasStore.setState({ nodes, edges, isReadOnly: false })
  }, [flowId, setReadOnly])

  return (
    <div
      className={`
        absolute right-0 top-0 h-full w-72 border-l border-border bg-background
        transition-transform duration-200 ease-in-out
        ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        overflow-hidden shadow-md flex flex-col
      `}
    >
      {selectedNode ? (
        /* ── Node selected: show config panels ──────────────────────── */
        <>
          <div className="flex items-center justify-between border-b border-border px-3 py-2.5 shrink-0">
            <p className="text-sm font-semibold text-foreground">Configure step</p>
            <button
              onClick={() => setSelectedNodeId(null)}
              className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Close sidebar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex flex-col gap-4 p-3 overflow-y-auto flex-1">
            <StepConfigPanel node={selectedNode} />

            {hasFormAndAssignee && (
              <>
                <div className="border-t border-border" />
                <FormBuilderPanel node={selectedNode} />

                <div className="border-t border-border" />
                <AssigneePanel node={selectedNode} users={users} departments={departments} />
              </>
            )}

            {selectedNode.type === 'branch' && (
              <>
                <div className="border-t border-border" />
                <BranchConfigPanel node={selectedNode} />
              </>
            )}
          </div>
        </>
      ) : (
        /* ── No node selected: show Publish + Versions tabs ─────────── */
        // The sidebar is always mounted but hidden via translate-x-full when
        // isOpen is false. We render IdlePanel unconditionally so its state
        // (selected tab) persists across node selection/deselection.
        <IdlePanel
          flowId={flowId}
          flowStatus={flowStatus}
          onFlowStatusChange={onFlowStatusChange}
          onVersionRestored={handleVersionRestored}
        />
      )}
    </div>
  )
}
