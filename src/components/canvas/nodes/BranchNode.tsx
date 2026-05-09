'use client'

import { Handle, Position, type NodeProps } from '@xyflow/react'
import { GitBranch } from 'lucide-react'

export function BranchNode({ data, selected }: NodeProps) {
  return (
    <div
      className={`
        min-w-[160px] rounded-lg border-2 bg-amber-50 px-4 py-3
        ${selected ? 'border-amber-500 shadow-md' : 'border-amber-300'}
      `}
    >
      <Handle type="target" position={Position.Top} />

      <div className="flex items-center gap-2">
        <GitBranch className="h-4 w-4 text-amber-600" />
        <span className="text-sm font-semibold text-amber-800">
          {String(data.label ?? 'Branch')}
        </span>
      </div>
      <p className="mt-1 text-xs text-amber-600">Condition</p>

      {/* Named output handles with visible labels */}
      <div className="relative mt-3 flex justify-between px-2 text-xs">
        <span className="text-emerald-600 font-medium">Yes</span>
        <span className="text-rose-600 font-medium">No</span>
      </div>

      <Handle type="source" position={Position.Bottom} id="yes" style={{ left: '30%' }} />
      <Handle type="source" position={Position.Bottom} id="no" style={{ left: '70%' }} />
    </div>
  )
}
