'use client'

import { useEffect, useState } from 'react'
import { useCanvasStore, type NodeData } from '@/store/canvas-store'
import { type Node } from '@xyflow/react'

interface Props {
  node: Node
}

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  trigger: { label: 'Trigger', color: 'bg-emerald-100 text-emerald-700' },
  action: { label: 'Action Step', color: 'bg-blue-100 text-blue-700' },
  branch: { label: 'Branch', color: 'bg-amber-100 text-amber-700' },
  complete: { label: 'End', color: 'bg-purple-100 text-purple-700' },
}

export default function StepConfigPanel({ node }: Props) {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData)
  const data = node.data as NodeData

  const [label, setLabel] = useState(data.label ?? '')
  const [description, setDescription] = useState(data.description ?? '')

  // Sync local state when a different node is selected
  useEffect(() => {
    setLabel(data.label ?? '')
    setDescription(data.description ?? '')
  }, [node.id, data.label, data.description])

  const handleLabelChange = (value: string) => {
    setLabel(value)
    updateNodeData(node.id, { label: value })
  }

  const handleDescriptionChange = (value: string) => {
    setDescription(value)
    updateNodeData(node.id, { description: value })
  }

  const typeInfo = TYPE_LABELS[node.type ?? ''] ?? {
    label: node.type,
    color: 'bg-gray-100 text-gray-600',
  }

  return (
    <div className="space-y-5">
      {/* Node type badge */}
      <div className="flex items-center gap-2">
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${typeInfo.color}`}>
          {typeInfo.label}
        </span>
      </div>

      {/* Step name */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Step name
        </label>
        <input
          type="text"
          value={label}
          onChange={(e) => handleLabelChange(e.target.value)}
          placeholder="Enter step name…"
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        />
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Description
          <span className="ml-1 font-normal normal-case text-muted-foreground/60">(optional)</span>
        </label>
        <textarea
          value={description}
          onChange={(e) => handleDescriptionChange(e.target.value)}
          placeholder="What happens in this step…"
          rows={3}
          className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        />
      </div>
    </div>
  )
}
