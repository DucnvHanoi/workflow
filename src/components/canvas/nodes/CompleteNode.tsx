'use client'

import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Flag } from 'lucide-react'

export function CompleteNode({ data, selected }: NodeProps) {
  return (
    <div
      className={`
        min-w-[160px] rounded-lg border-2 bg-purple-50 px-4 py-3
        ${selected ? 'border-purple-500 shadow-md' : 'border-purple-300'}
      `}
    >
      <Handle type="target" position={Position.Top} />
      <div className="flex items-center gap-2">
        <Flag className="h-4 w-4 text-purple-600" />
        <span className="text-sm font-semibold text-purple-800">
          {String(data.label ?? 'Complete')}
        </span>
      </div>
      <p className="mt-1 text-xs text-purple-600">End of flow</p>
      {/* No output handle — complete is a terminal node */}
    </div>
  )
}
