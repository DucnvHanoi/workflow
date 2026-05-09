'use client'

import { Handle, Position, type NodeProps } from '@xyflow/react'
import { CheckSquare } from 'lucide-react'

export function ActionNode({ data, selected }: NodeProps) {
  return (
    <div
      className={`
        min-w-[160px] rounded-lg border-2 bg-blue-50 px-4 py-3
        ${selected ? 'border-blue-500 shadow-md' : 'border-blue-300'}
      `}
    >
      <Handle type="target" position={Position.Top} />
      <div className="flex items-center gap-2">
        <CheckSquare className="h-4 w-4 text-blue-600" />
        <span className="text-sm font-semibold text-blue-800">
          {String(data.label ?? 'Action')}
        </span>
      </div>
      <p className="mt-1 text-xs text-blue-600">Action step</p>
      <Handle type="source" position={Position.Bottom} />
    </div>
  )
}
