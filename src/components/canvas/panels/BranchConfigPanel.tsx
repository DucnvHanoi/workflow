'use client'

// FILE PATH: src/components/canvas/panels/BranchConfigPanel.tsx
//
// ENHANCEMENT (Day 38):
//   Branch conditions can now reference fields from ANY upstream step, not
//   just the branch node's own form fields. The field dropdown is grouped by
//   step name, with the branch's own fields first, then upstream steps ordered
//   by graph distance (closest first).
//
//   BranchCondition now stores `nodeId` alongside `fieldId` so advanceFlow
//   knows which step_instance.form_data to look the value up from.
//
// M3 — AI Condition Parser:
//   Each branch group (Yes/No) has a plain-English input with a Sparkles
//   button. Typing "amount is more than 1000" and pressing the button calls
//   parseConditionFromText(), which maps it to a real fieldId + operator +
//   value and appends the condition. Falls back gracefully with an error
//   message if the field cannot be resolved.
//   Operators expanded: eq | neq | gt | lt | gte | lte | contains.

import { useEffect, useMemo, useState, useTransition } from 'react'
import { Plus, Trash2, Sparkles, Loader2, AlertTriangle } from 'lucide-react'
import {
  useCanvasStore,
  type NodeData,
  type BranchCondition,
  type FormField,
} from '@/store/canvas-store'
import { type Node, type Edge } from '@xyflow/react'
import { parseConditionFromText, type AvailableField } from '@/lib/ai/condition-parser'

interface Props {
  node: Node
}

const generateId = () => `cond_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

// ─── Operator display labels ──────────────────────────────────────────────────

const OPERATOR_LABELS: Record<string, string> = {
  eq: 'equals',
  neq: '≠',
  gt: '>',
  lt: '<',
  gte: '≥',
  lte: '≤',
  contains: 'contains',
}

// Allowed operators per form field type
const OPERATORS_BY_TYPE: Record<string, Array<BranchCondition['operator']>> = {
  text: ['eq', 'neq', 'contains'],
  textarea: ['eq', 'neq', 'contains'],
  number: ['eq', 'neq', 'gt', 'lt', 'gte', 'lte'],
  dropdown: ['eq', 'neq'],
  radio: ['eq', 'neq'],
  checkbox: ['eq', 'contains'],
  date: ['eq', 'gt', 'lt', 'gte', 'lte'],
  file: ['eq'],
}

// ─── Upstream field collection ────────────────────────────────────────────────
// Walk graph edges backwards from the branch node (BFS), collecting every
// action/branch node that is an ancestor. Returns nodes in BFS order so the
// closest ancestor comes first.

function getUpstreamNodes(branchNodeId: string, allNodes: Node[], allEdges: Edge[]): Node[] {
  const reverseMap = new Map<string, string[]>()
  for (const edge of allEdges) {
    if (!reverseMap.has(edge.target)) reverseMap.set(edge.target, [])
    reverseMap.get(edge.target)!.push(edge.source)
  }

  const visited = new Set<string>([branchNodeId])
  const queue: string[] = [branchNodeId]
  const orderedIds: string[] = []

  while (queue.length > 0) {
    const current = queue.shift()!
    for (const parentId of reverseMap.get(current) ?? []) {
      if (!visited.has(parentId)) {
        visited.add(parentId)
        orderedIds.push(parentId)
        queue.push(parentId)
      }
    }
  }

  const nodeMap = new Map(allNodes.map((n) => [n.id, n]))
  return orderedIds
    .map((id) => nodeMap.get(id))
    .filter((n): n is Node => !!n && (n.type === 'action' || n.type === 'branch'))
}

// ─── FieldOption ──────────────────────────────────────────────────────────────

interface FieldOption {
  nodeId: string
  nodeLabel: string
  fieldId: string
  fieldLabel: string
  isOwn: boolean
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function BranchConfigPanel({ node }: Props) {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData)
  const triggerSave = useCanvasStore((s) => s.triggerSave)
  const allNodes = useCanvasStore((s) => s.nodes)
  const allEdges = useCanvasStore((s) => s.edges)

  const data = node.data as NodeData
  const [conditions, setConditions] = useState<BranchCondition[]>(data.branchConditions ?? [])

  useEffect(() => {
    setConditions(data.branchConditions ?? [])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node.id])

  const fieldOptions = useMemo<FieldOption[]>(() => {
    const ownFields = (data.formSchema ?? []) as FormField[]
    const own: FieldOption[] = ownFields.map((f) => ({
      nodeId: node.id,
      nodeLabel: (node.data as NodeData).label || 'This step',
      fieldId: f.id,
      fieldLabel: f.label || f.id,
      isOwn: true,
    }))

    const upstream = getUpstreamNodes(node.id, allNodes, allEdges)
    const upstreamOptions: FieldOption[] = upstream.flatMap((upNode) => {
      const upData = upNode.data as NodeData
      const upFields = (upData.formSchema ?? []) as FormField[]
      return upFields.map((f) => ({
        nodeId: upNode.id,
        nodeLabel: upData.label || 'Unnamed step',
        fieldId: f.id,
        fieldLabel: f.label || f.id,
        isOwn: false,
      }))
    })

    return [...own, ...upstreamOptions]
  }, [node.id, node.data, allNodes, allEdges, data.formSchema])

  // Build AvailableField list for AI parsing — enriches FieldOption with fieldType
  const availableFieldsForAI = useMemo<AvailableField[]>(() => {
    return fieldOptions.map((opt) => {
      const ownerNode = allNodes.find((n) => n.id === opt.nodeId)
      const ownerData = ownerNode?.data as NodeData | undefined
      const field = (ownerData?.formSchema ?? []).find((f: FormField) => f.id === opt.fieldId)
      return {
        nodeId: opt.nodeId,
        nodeLabel: opt.nodeLabel,
        fieldId: opt.fieldId,
        fieldLabel: opt.fieldLabel,
        fieldType: field?.type ?? 'text',
      }
    })
  }, [fieldOptions, allNodes])

  const persist = (updated: BranchCondition[]) => {
    setConditions(updated)
    updateNodeData(node.id, { branchConditions: updated })
    triggerSave()
  }

  const addCondition = (handleId: 'yes' | 'no') => {
    persist([
      ...conditions,
      { id: generateId(), fieldId: '', nodeId: undefined, operator: 'eq', value: '', handleId },
    ])
  }

  const addParsedCondition = (partial: Omit<BranchCondition, 'id'>) => {
    persist([...conditions, { ...partial, id: generateId() }])
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
        Define when each branch path is taken. Conditions can reference fields from any previous
        step in this flow.
      </p>

      <BranchGroup
        label="Yes path"
        color="emerald"
        handleId="yes"
        conditions={yesConditions}
        fieldOptions={fieldOptions}
        availableFields={availableFieldsForAI}
        onAdd={() => addCondition('yes')}
        onAddParsed={addParsedCondition}
        onUpdate={updateCondition}
        onRemove={removeCondition}
      />

      <BranchGroup
        label="No path"
        color="rose"
        handleId="no"
        conditions={noConditions}
        fieldOptions={fieldOptions}
        availableFields={availableFieldsForAI}
        onAdd={() => addCondition('no')}
        onAddParsed={addParsedCondition}
        onUpdate={updateCondition}
        onRemove={removeCondition}
      />

      <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
        Tip: Leave a path with no conditions to use it as the default fallback.
      </p>
    </div>
  )
}

/* ─── Branch group ────────────────────────────────────────────────── */

interface GroupProps {
  label: string
  color: 'emerald' | 'rose'
  handleId: 'yes' | 'no'
  conditions: BranchCondition[]
  fieldOptions: FieldOption[]
  availableFields: AvailableField[]
  onAdd: () => void
  onAddParsed: (_partial: Omit<BranchCondition, 'id'>) => void
  onUpdate: (_id: string, _patch: Partial<BranchCondition>) => void
  onRemove: (_id: string) => void
}

function BranchGroup({
  label,
  color,
  handleId,
  conditions,
  fieldOptions,
  availableFields,
  onAdd,
  onAddParsed,
  onUpdate,
  onRemove,
}: GroupProps) {
  const [aiText, setAiText] = useState('')
  const [aiError, setAiError] = useState<string | null>(null)
  const [isParsing, startParsing] = useTransition()

  const borderColor = color === 'emerald' ? 'border-emerald-200' : 'border-rose-200'
  const badgeColor =
    color === 'emerald' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
  const btnColor =
    color === 'emerald'
      ? 'text-emerald-600 hover:bg-emerald-50 border-emerald-200'
      : 'text-rose-600 hover:bg-rose-50 border-rose-200'

  function handleAiParse() {
    setAiError(null)
    startParsing(async () => {
      const result = await parseConditionFromText(aiText.trim(), availableFields, handleId)
      if (result.error || !result.condition) {
        setAiError(result.error ?? 'Unknown error')
      } else {
        onAddParsed(result.condition)
        setAiText('')
      }
    })
  }

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
              fieldOptions={fieldOptions}
              availableFields={availableFields}
              onUpdate={(patch) => onUpdate(cond.id, patch)}
              onRemove={() => onRemove(cond.id)}
            />
          ))}
        </div>
      )}

      {/* AI condition input strip */}
      {availableFields.length > 0 && (
        <div className="border-t border-dashed border-border pt-2 space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-500">
            Parse with AI
          </p>
          <div className="flex gap-1.5">
            <input
              type="text"
              value={aiText}
              onChange={(e) => {
                setAiText(e.target.value)
                setAiError(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && aiText.trim() && !isParsing) handleAiParse()
              }}
              placeholder={`e.g. "amount is more than 1000"`}
              className="flex-1 rounded border border-input bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <button
              onClick={handleAiParse}
              disabled={!aiText.trim() || isParsing}
              title="Parse condition with AI"
              className="flex items-center gap-1 rounded border border-violet-200 bg-white px-2 py-1 text-xs font-medium text-violet-600 transition-colors hover:bg-violet-50 disabled:opacity-50"
            >
              {isParsing ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Sparkles className="h-3 w-3" />
              )}
            </button>
          </div>
          {aiError && (
            <div className="flex items-start gap-1.5 rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1.5">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-destructive" />
              <p className="text-[11px] text-destructive">{aiError}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ─── Condition row ───────────────────────────────────────────────── */

interface RowProps {
  condition: BranchCondition
  fieldOptions: FieldOption[]
  availableFields: AvailableField[]
  onUpdate: (_patch: Partial<BranchCondition>) => void
  onRemove: () => void
}

function ConditionRow({ condition, fieldOptions, availableFields, onUpdate, onRemove }: RowProps) {
  const selectedField = availableFields.find(
    (f) => f.fieldId === condition.fieldId && f.nodeId === condition.nodeId
  )
  const allowedOperators: Array<BranchCondition['operator']> = OPERATORS_BY_TYPE[
    selectedField?.fieldType ?? ''
  ] ?? ['eq', 'neq']
  // Group by step label for <optgroup>
  const groups = useMemo(() => {
    const map = new Map<string, { nodeId: string; isOwn: boolean; fields: FieldOption[] }>()
    for (const opt of fieldOptions) {
      if (!map.has(opt.nodeLabel))
        map.set(opt.nodeLabel, { nodeId: opt.nodeId, isOwn: opt.isOwn, fields: [] })
      map.get(opt.nodeLabel)!.fields.push(opt)
    }
    // FIX: use Array.from() instead of spread on MapIterator
    // (spread of map.entries() fails when TS target is below ES2015)
    const entries = Array.from(map.entries())
    const own = entries.filter(([, v]) => v.isOwn)
    const upstream = entries.filter(([, v]) => !v.isOwn)
    return [...own, ...upstream]
  }, [fieldOptions])

  // Composite value: "nodeId::fieldId" — lets us carry both in one <select>
  const compositeValue =
    condition.nodeId && condition.fieldId
      ? `${condition.nodeId}::${condition.fieldId}`
      : condition.fieldId
        ? `::${condition.fieldId}`
        : ''

  function handleFieldChange(val: string) {
    const sep = val.indexOf('::')
    const nodeId = val.slice(0, sep) || undefined
    const fieldId = val.slice(sep + 2)
    const field = availableFields.find((f) => f.fieldId === fieldId && f.nodeId === nodeId)
    const allowed = OPERATORS_BY_TYPE[field?.fieldType ?? ''] ?? ['eq', 'neq']
    const operator = allowed.includes(condition.operator) ? condition.operator : allowed[0]
    onUpdate({ nodeId, fieldId, operator })
  }

  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-input bg-muted/20 p-2">
      {/* Field selector */}
      <select
        value={compositeValue}
        onChange={(e) => handleFieldChange(e.target.value)}
        className="w-full cursor-pointer rounded border border-input bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
      >
        <option value="" disabled>
          Select field…
        </option>
        {groups.map(([groupLabel, { nodeId, fields }]) => (
          <optgroup key={nodeId} label={groupLabel}>
            {fields.map((f) => (
              <option key={`${f.nodeId}::${f.fieldId}`} value={`${f.nodeId}::${f.fieldId}`}>
                {f.fieldLabel || f.fieldId}
              </option>
            ))}
          </optgroup>
        ))}
      </select>

      {/* Operator + value + remove */}
      <div className="flex items-center gap-2">
        <select
          value={condition.operator}
          onChange={(e) => onUpdate({ operator: e.target.value as BranchCondition['operator'] })}
          className="shrink-0 cursor-pointer rounded border border-input bg-background px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
        >
          {allowedOperators.map((op) => (
            <option key={op} value={op}>
              {OPERATOR_LABELS[op]}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={condition.value}
          onChange={(e) => onUpdate({ value: e.target.value })}
          placeholder="Value…"
          className="flex-1 rounded border border-input bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <button
          onClick={onRemove}
          className="shrink-0 text-muted-foreground transition-colors hover:text-destructive"
          title="Remove condition"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
