'use client'

import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Play } from 'lucide-react'

export function TriggerNode({ data, selected }: NodeProps) {
  return (
    <div
      className={`
        min-w-[160px] rounded-lg border-2 bg-emerald-50 px-4 py-3
        ${selected ? 'border-emerald-500 shadow-md' : 'border-emerald-300'}
      `}
    >
      <div className="flex items-center gap-2">
        <Play className="h-4 w-4 text-emerald-600" />
        <span className="text-sm font-semibold text-emerald-800">
          {String(data.label ?? 'Start')}
        </span>
      </div>
      <p className="mt-1 text-xs text-emerald-600">Trigger</p>
      {/* Only output handle — trigger has no input */}
      <Handle type="source" position={Position.Bottom} />
    </div>
  )
}
