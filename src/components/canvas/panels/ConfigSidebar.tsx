'use client'

// FILE PATH: src/components/canvas/panels/ConfigSidebar.tsx

import { useState } from 'react'
import { X } from 'lucide-react'
import type { Node } from '@xyflow/react'
import { useCanvasStore, type TenantUser, type TenantDepartment } from '@/store/canvas-store'
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
  flowId: string
  flowName: string
  flowStatus: 'draft' | 'published'
  onFlowStatusChange: (status: 'draft' | 'published') => void
  onVersionRestored: () => void
  initialAllowedDeptIds: string[]
}

type SidebarTab = 'publish' | 'versions'

interface IdlePanelProps {
  flowId: string
  flowStatus: 'draft' | 'published'
  departments: TenantDepartment[]
  initialAllowedDeptIds: string[]
  onFlowStatusChange: (status: 'draft' | 'published') => void
  onVersionRestored: () => void
}

function IdlePanel({
  flowId,
  flowStatus,
  departments,
  initialAllowedDeptIds,
  onFlowStatusChange,
  onVersionRestored,
}: IdlePanelProps) {
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
            departments={departments}
            initialAllowedDeptIds={initialAllowedDeptIds}
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
  flowName,
  flowStatus,
  onFlowStatusChange,
  onVersionRestored,
  initialAllowedDeptIds,
}: ConfigSidebarProps) {
  const { setSelectedNodeId } = useCanvasStore()

  const hasFormAndAssignee = selectedNode?.type === 'action' || selectedNode?.type === 'branch'

  return (
    // FIX: removed translate-x-full / isOpen logic.
    // Sidebar is now always visible — it has content in both states
    // (node selected → config panels, no node → Publish/Versions tabs).
    // FlowCanvas already subtracts 288px (w-72) from the ReactFlow width
    // at all times, so the canvas never overlaps the sidebar.
    <div className="absolute right-0 top-0 h-full w-72 border-l border-border bg-background overflow-hidden shadow-md flex flex-col">
      {selectedNode ? (
        /* ── Node selected: step config panels ──────────────────────── */
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
                <FormBuilderPanel node={selectedNode} flowName={flowName} />

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
        /* ── No node selected: Publish + Versions tabs ───────────────── */
        <IdlePanel
          flowId={flowId}
          flowStatus={flowStatus}
          departments={departments}
          initialAllowedDeptIds={initialAllowedDeptIds}
          onFlowStatusChange={onFlowStatusChange}
          onVersionRestored={onVersionRestored}
        />
      )}
    </div>
  )
}
