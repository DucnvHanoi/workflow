// FILE PATH: src/components/canvas/panels/StepConfigPanel.tsx  (REPLACE EXISTING FILE)

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
  const triggerSave = useCanvasStore((s) => s.triggerSave)
  const data = node.data as NodeData

  const [label, setLabel] = useState(data.label ?? '')
  const [description, setDescription] = useState(data.description ?? '')
  const [slaValue, setSlaValue] = useState<number | ''>(() => deriveSlaDisplay(data.slaHours).value)
  const [slaUnit, setSlaUnit] = useState<'hours' | 'days'>(
    () => deriveSlaDisplay(data.slaHours).unit
  )
  const [escValue, setEscValue] = useState<number | ''>(
    () => deriveSlaDisplay(data.escalateAfterHours).value
  )
  const [escUnit, setEscUnit] = useState<'hours' | 'days'>(
    () => deriveSlaDisplay(data.escalateAfterHours).unit
  )

  // Sync local state when a different node is selected
  useEffect(() => {
    setLabel(data.label ?? '')
    setDescription(data.description ?? '')
    const sla = deriveSlaDisplay(data.slaHours)
    setSlaValue(sla.value)
    setSlaUnit(sla.unit)
    const esc = deriveSlaDisplay(data.escalateAfterHours)
    setEscValue(esc.value)
    setEscUnit(esc.unit)
  }, [node.id, data.label, data.description, data.slaHours, data.escalateAfterHours])

  const handleLabelChange = (value: string) => {
    setLabel(value)
    updateNodeData(node.id, { label: value })
    triggerSave()
  }

  const handleDescriptionChange = (value: string) => {
    setDescription(value)
    updateNodeData(node.id, { description: value })
    triggerSave()
  }

  const handleSlaValueChange = (raw: string) => {
    if (raw === '') {
      setSlaValue('')
      updateNodeData(node.id, { slaHours: undefined })
    } else {
      const num = parseInt(raw, 10)
      if (!isNaN(num) && num > 0) {
        setSlaValue(num)
        updateNodeData(node.id, { slaHours: num * (slaUnit === 'days' ? 24 : 1) })
      } else {
        setSlaValue('')
        updateNodeData(node.id, { slaHours: undefined })
      }
    }
    triggerSave()
  }

  const handleSlaUnitChange = (unit: 'hours' | 'days') => {
    setSlaUnit(unit)
    if (slaValue !== '') {
      updateNodeData(node.id, { slaHours: (slaValue as number) * (unit === 'days' ? 24 : 1) })
      triggerSave()
    }
  }

  const handleEscValueChange = (raw: string) => {
    if (raw === '') {
      setEscValue('')
      updateNodeData(node.id, { escalateAfterHours: undefined })
    } else {
      const num = parseInt(raw, 10)
      if (!isNaN(num) && num > 0) {
        setEscValue(num)
        updateNodeData(node.id, { escalateAfterHours: num * (escUnit === 'days' ? 24 : 1) })
      } else {
        setEscValue('')
        updateNodeData(node.id, { escalateAfterHours: undefined })
      }
    }
    triggerSave()
  }

  const handleEscUnitChange = (unit: 'hours' | 'days') => {
    setEscUnit(unit)
    if (escValue !== '') {
      updateNodeData(node.id, {
        escalateAfterHours: (escValue as number) * (unit === 'days' ? 24 : 1),
      })
      triggerSave()
    }
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

      {/* SLA — action and branch nodes (both have an assignee who must complete a form) */}
      {(node.type === 'action' || node.type === 'branch') && (
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Due within
            <span className="ml-1 font-normal normal-case text-muted-foreground/60">
              (optional)
            </span>
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              min={1}
              value={slaValue}
              onChange={(e) => handleSlaValueChange(e.target.value)}
              placeholder="e.g. 48"
              className="w-24 rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            />
            <select
              value={slaUnit}
              onChange={(e) => handleSlaUnitChange(e.target.value as 'hours' | 'days')}
              className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <option value="hours">hours</option>
              <option value="days">days</option>
            </select>
          </div>
          {slaValue !== '' && (
            <p className="text-xs text-muted-foreground">
              Assignee must complete within{' '}
              <span className="font-medium">
                {slaValue} {slaUnit}
              </span>{' '}
              of assignment.
            </p>
          )}
        </div>
      )}

      {/* Escalation — only shown when an SLA due date is configured */}
      {(node.type === 'action' || node.type === 'branch') && slaValue !== '' && (
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Escalate after
            <span className="ml-1 font-normal normal-case text-muted-foreground/60">
              (optional, hours overdue)
            </span>
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              min={1}
              value={escValue}
              onChange={(e) => handleEscValueChange(e.target.value)}
              placeholder="e.g. 24"
              className="w-24 rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            />
            <select
              value={escUnit}
              onChange={(e) => handleEscUnitChange(e.target.value as 'hours' | 'days')}
              className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <option value="hours">hours overdue</option>
              <option value="days">days overdue</option>
            </select>
          </div>
          {escValue !== '' && (
            <p className="text-xs text-muted-foreground">
              Manager notified if overdue by more than{' '}
              <span className="font-medium">
                {escValue} {escUnit}
              </span>
              .
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// Derive display value + unit from the stored slaHours number
function deriveSlaDisplay(slaHours: number | undefined): {
  value: number | ''
  unit: 'hours' | 'days'
} {
  if (!slaHours || slaHours <= 0) return { value: '', unit: 'hours' }
  if (slaHours % 24 === 0) return { value: slaHours / 24, unit: 'days' }
  return { value: slaHours, unit: 'hours' }
}
