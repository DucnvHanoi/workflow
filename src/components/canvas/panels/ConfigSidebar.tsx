'use client'

import { X } from 'lucide-react'
import { useCanvasStore } from '@/store/canvas-store'
import { StepConfigPanel } from './StepConfigPanel'
import { BranchConfigPanel } from './BranchConfigPanel'
import { type Node } from '@xyflow/react'

interface Props {
  selectedNode: Node | null
}

export function ConfigSidebar({ selectedNode }: Props) {
  const setSelectedNodeId = useCanvasStore((s) => s.setSelectedNodeId)

  const isOpen = selectedNode !== null

  return (
    <>
      {/* Sidebar panel */}
      <div
        className={`
          absolute right-0 top-0 z-20 flex h-full w-72 flex-col border-l bg-white shadow-xl
          transition-transform duration-200 ease-in-out
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        {selectedNode && (
          <>
            {/* Header */}
            <div className="flex h-12 shrink-0 items-center justify-between border-b px-4">
              <span className="text-sm font-semibold">Configure step</span>
              <button
                onClick={() => setSelectedNodeId(null)}
                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {/* Step config always shown */}
              <StepConfigPanel node={selectedNode} />

              {/* Branch-specific config — only for branch nodes */}
              {selectedNode.type === 'branch' && (
                <>
                  <div className="border-t pt-5">
                    <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Branch conditions
                    </p>
                    <BranchConfigPanel node={selectedNode} />
                  </div>
                </>
              )}

              {/* Assignee config placeholder — added in Week 12 (Day 31) */}
              {(selectedNode.type === 'action' || selectedNode.type === 'branch') && (
                <div className="border-t pt-5">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Assignee
                  </p>
                  <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                    Assignee config coming in Week 12.
                  </p>
                </div>
              )}

              {/* Form builder placeholder — added in Week 11 (Day 31) */}
              {(selectedNode.type === 'action' || selectedNode.type === 'branch') && (
                <div className="border-t pt-5">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Form fields
                  </p>
                  <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                    Form builder coming in Week 11.
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  )
}
