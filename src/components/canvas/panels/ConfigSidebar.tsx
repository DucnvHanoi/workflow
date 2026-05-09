'use client'

import { X } from 'lucide-react'
import type { Node } from '@xyflow/react'
import { useCanvasStore, type TenantUser, type TenantDepartment } from '@/store/canvas-store'
import StepConfigPanel from './StepConfigPanel'
import BranchConfigPanel from './BranchConfigPanel'
import FormBuilderPanel from './FormBuilderPanel'
import AssigneePanel from './AssigneePanel'

interface ConfigSidebarProps {
  selectedNode: Node | undefined
  users: TenantUser[]
  departments: TenantDepartment[]
}

export default function ConfigSidebar({ selectedNode, users, departments }: ConfigSidebarProps) {
  const { setSelectedNodeId } = useCanvasStore()

  const isOpen = !!selectedNode
  const hasFormAndAssignee = selectedNode?.type === 'action' || selectedNode?.type === 'branch'

  return (
    <div
      className={`
        absolute right-0 top-0 h-full w-72 border-l border-border bg-background
        transition-transform duration-200 ease-in-out
        ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        overflow-y-auto shadow-md
      `}
    >
      {selectedNode && (
        <>
          <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
            <p className="text-sm font-semibold text-foreground">Configure step</p>
            <button
              onClick={() => setSelectedNodeId(null)}
              className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Close sidebar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex flex-col gap-4 p-3">
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
      )}
    </div>
  )
}
