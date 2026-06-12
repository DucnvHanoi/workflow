'use client'

import { Handle, Position, type NodeProps } from '@xyflow/react'
import { GitMerge, Clock, Zap } from 'lucide-react'

export function SubflowNode({ data, selected }: NodeProps) {
  const hasTarget = !!data.subflowId
  const waits = !!data.waitForCompletion

  return (
    <div
      className={`
        min-w-[180px] rounded-lg border-2 bg-orange-50 px-4 py-3
        ${selected ? 'border-orange-500 shadow-md' : 'border-orange-300'}
        ${!hasTarget ? 'opacity-70' : ''}
      `}
    >
      <Handle type="target" position={Position.Top} />
      <div className="flex items-center gap-2">
        <GitMerge className="h-4 w-4 shrink-0 text-orange-600" />
        <span className="text-sm font-semibold text-orange-800 truncate max-w-[130px]">
          {String(data.label ?? 'Sub-flow')}
        </span>
      </div>
      <div className="mt-1 flex items-center gap-1">
        {waits ? (
          <Clock className="h-3 w-3 text-orange-400" />
        ) : (
          <Zap className="h-3 w-3 text-orange-400" />
        )}
        <p className="text-xs text-orange-500">
          {hasTarget
            ? waits
              ? 'Wait · ' + String(data.subflowName ?? 'Sub-flow')
              : 'Fire & continue · ' + String(data.subflowName ?? 'Sub-flow')
            : 'No flow selected'}
        </p>
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  )
}
