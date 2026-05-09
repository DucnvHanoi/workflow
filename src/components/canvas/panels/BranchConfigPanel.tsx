'use client'

import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useCanvasStore, type NodeData, type BranchCondition } from '@/store/canvas-store'
import { type Node } from '@xyflow/react'

interface Props {
  node: Node
}

const generateId = () => `cond_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

export default function BranchConfigPanel({ node }: Props) {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData)
  const data = node.data as NodeData

  const [conditions, setConditions] = useState<BranchCondition[]>(data.branchConditions ?? [])

  // Sync when switching between branch nodes
  useEffect(() => {
    setConditions(data.branchConditions ?? [])
  }, [node.id])

  const persist = (updated: BranchCondition[]) => {
    setConditions(updated)
    updateNodeData(node.id, { branchConditions: updated })
  }

  const addCondition = (handleId: 'yes' | 'no') => {
    const next: BranchCondition = {
      id: generateId(),
      fieldId: '',
      operator: 'eq',
      value: '',
      handleId,
    }
    persist([...conditions, next])
  }

  const updateCondition = (id: string, patch: Partial<BranchCondition>) => {
    persist(conditions.map((c) => (c.id === id ? { ...c, ...patch } : c)))
  }

  const removeCondition = (id: string) => {
    persist(conditions.filter((c) => c.id !== id))
  }

  const yesConditions = conditions.filter((c) => c.handleId === 'yes')
  const noConditions = conditions.filter((c) => c.handleId === 'no')

  return (
    <div className="space-y-5">
      <p className="text-xs text-muted-foreground">
        Define when each branch path is taken. Fields are evaluated against values submitted in the
        previous step.
      </p>

      {/* Yes branch */}
      <BranchGroup
        label="Yes path"
        color="emerald"
        conditions={yesConditions}
        handleId="yes"
        onAdd={() => addCondition('yes')}
        onUpdate={updateCondition}
        onRemove={removeCondition}
      />

      {/* No branch */}
      <BranchGroup
        label="No path"
        color="rose"
        conditions={noConditions}
        handleId="no"
        onAdd={() => addCondition('no')}
        onUpdate={updateCondition}
        onRemove={removeCondition}
      />

      <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
        Tip: Leave conditions empty to use a path as the default fallback.
      </p>
    </div>
  )
}

/* ─── Branch group (Yes / No) ─────────────────────────────────────── */

interface GroupProps {
  label: string
  color: 'emerald' | 'rose'
  conditions: BranchCondition[]
  handleId: 'yes' | 'no'
  onAdd: () => void
  onUpdate: (id: string, patch: Partial<BranchCondition>) => void
  onRemove: (id: string) => void
}

function BranchGroup({ label, color, conditions, onAdd, onUpdate, onRemove }: GroupProps) {
  const borderColor = color === 'emerald' ? 'border-emerald-200' : 'border-rose-200'
  const badgeColor =
    color === 'emerald' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
  const btnColor =
    color === 'emerald'
      ? 'text-emerald-600 hover:bg-emerald-50 border-emerald-200'
      : 'text-rose-600 hover:bg-rose-50 border-rose-200'

  return (
    <div className={`rounded-lg border-2 ${borderColor} p-3 space-y-3`}>
      <div className="flex items-center justify-between">
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badgeColor}`}>
          {label}
        </span>
        <button
          onClick={onAdd}
          className={`flex items-center gap-1 rounded border px-2 py-1 text-xs font-medium transition-colors ${btnColor}`}
        >
          <Plus className="h-3 w-3" />
          Add condition
        </button>
      </div>

      {conditions.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">No conditions — acts as fallback.</p>
      ) : (
        <div className="space-y-2">
          {conditions.map((cond) => (
            <ConditionRow
              key={cond.id}
              condition={cond}
              onUpdate={(patch) => onUpdate(cond.id, patch)}
              onRemove={() => onRemove(cond.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/* ─── Individual condition row ────────────────────────────────────── */

interface RowProps {
  condition: BranchCondition
  onUpdate: (patch: Partial<BranchCondition>) => void
  onRemove: () => void
}

function ConditionRow({ condition, onUpdate, onRemove }: RowProps) {
  return (
    <div className="flex items-center gap-2">
      {/* Field ID input — will be a dropdown in Phase 2 Week 10 when form schema exists */}
      <input
        type="text"
        value={condition.fieldId}
        onChange={(e) => onUpdate({ fieldId: e.target.value })}
        placeholder="Field ID"
        className="w-28 rounded border border-input bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
      />

      {/* Operator — fixed to 'eq' for now (plan: simple one field = one value) */}
      <span className="rounded border border-input bg-muted px-2 py-1 text-xs text-muted-foreground">
        equals
      </span>

      {/* Expected value */}
      <input
        type="text"
        value={condition.value}
        onChange={(e) => onUpdate({ value: e.target.value })}
        placeholder="Value"
        className="flex-1 rounded border border-input bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
      />

      {/* Remove */}
      <button
        onClick={onRemove}
        className="text-muted-foreground hover:text-destructive transition-colors"
        title="Remove condition"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
