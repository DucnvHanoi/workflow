// FILE PATH: src/components/canvas/panels/FormBuilderPanel.tsx  (REPLACE EXISTING FILE)

'use client'

import { useState, useTransition } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { Plus, ChevronDown, Sparkles, Loader2, X, AlertTriangle } from 'lucide-react'
import type { Node } from '@xyflow/react'
import {
  useCanvasStore,
  type FormField,
  type FormFieldType,
  type NodeData,
} from '@/store/canvas-store'
import { suggestFormFields, type FieldSuggestion } from '@/lib/ai/form-suggestions'
import FormFieldRow from './FormFieldRow'

// ─── Types ────────────────────────────────────────────────────────────────────

interface FormBuilderPanelProps {
  node: Node
  flowName: string
}

// ─── Add-field menu options ───────────────────────────────────────────────────

const FIELD_TYPES: { type: FormFieldType; label: string; description: string }[] = [
  { type: 'text', label: 'Short Text', description: 'Single-line text input' },
  { type: 'textarea', label: 'Long Text', description: 'Multi-line text area (auto-grows)' },
  { type: 'number', label: 'Number', description: 'Numeric input (integers or decimals)' },
  { type: 'dropdown', label: 'Dropdown', description: 'Select one from a list' },
  { type: 'radio', label: 'Radio', description: 'Pick one from visible options' },
  { type: 'checkbox', label: 'Checkbox', description: 'One or more selections' },
  { type: 'file', label: 'File upload', description: 'Upload one or more files' },
  { type: 'date', label: 'Date & Time', description: 'Date and time picker' },
]

// ─── Component ────────────────────────────────────────────────────────────────

export default function FormBuilderPanel({ node, flowName }: FormBuilderPanelProps) {
  const { addFormField, updateFormField, removeFormField, reorderFormFields } = useCanvasStore()
  const triggerSave = useCanvasStore((s) => s.triggerSave)

  const [menuOpen, setMenuOpen] = useState(false)
  const [suggestions, setSuggestions] = useState<FieldSuggestion[] | null>(null)
  const [suggestError, setSuggestError] = useState<string | null>(null)
  const [isSuggesting, startSuggesting] = useTransition()

  const data = node.data as NodeData
  const fields: FormField[] = data.formSchema ?? []

  // ── dnd-kit sensors ─────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  )

  // ── AI field suggestions ─────────────────────────────────────────────────

  function handleSuggest() {
    setSuggestError(null)
    setSuggestions(null)
    startSuggesting(async () => {
      const result = await suggestFormFields(
        data.label ?? '',
        data.description ?? '',
        flowName,
        node.type as 'action' | 'branch'
      )
      if (result.error || !result.suggestions) {
        setSuggestError(result.error ?? 'Unknown error')
      } else {
        setSuggestions(result.suggestions)
      }
    })
  }

  function handleAddSuggestion(suggestion: FieldSuggestion) {
    addFormField(node.id, suggestion.type)
    // addFormField is synchronous Zustand — read updated node from store immediately
    const updatedNode = useCanvasStore.getState().nodes.find((n) => n.id === node.id)
    const updatedFields = (updatedNode?.data as NodeData | undefined)?.formSchema ?? []
    const newField = updatedFields[updatedFields.length - 1]
    if (newField) {
      updateFormField(node.id, newField.id, { label: suggestion.label })
    }
    triggerSave()
    setSuggestions((prev) => {
      if (!prev) return null
      const next = prev.filter((s) => s !== suggestion)
      return next.length > 0 ? next : null
    })
  }

  // ── Drag end handler ─────────────────────────────────────────────────────

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = fields.findIndex((f) => f.id === active.id)
    const newIndex = fields.findIndex((f) => f.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const reordered = arrayMove(fields, oldIndex, newIndex)
    reorderFormFields(node.id, reordered)
    triggerSave() // FIX: persist after reorder
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-2">
      {/* ── Header + Add button ─────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Form fields
        </p>

        {/* Add field dropdown trigger */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-muted"
          >
            <Plus className="h-3 w-3" />
            Add field
            <ChevronDown
              className={`h-3 w-3 transition-transform ${menuOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {/* Dropdown menu */}
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full z-20 mt-1 w-52 rounded-md border border-border bg-popover shadow-md">
                {FIELD_TYPES.map(({ type, label, description }) => (
                  <button
                    key={type}
                    onClick={() => {
                      addFormField(node.id, type)
                      setMenuOpen(false)
                      triggerSave() // FIX: persist after adding a field
                    }}
                    className="flex w-full flex-col px-3 py-2 text-left transition-colors hover:bg-muted first:rounded-t-md last:rounded-b-md"
                  >
                    <span className="text-sm font-medium text-foreground">{label}</span>
                    <span className="text-xs text-muted-foreground">{description}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Empty state + AI suggest button ─────────────────────────── */}
      {fields.length === 0 && (
        <div className="rounded-md border border-dashed border-border bg-muted/20 py-4 text-center">
          <p className="text-xs text-muted-foreground">
            No fields yet. Click <span className="font-semibold">Add field</span> to start.
          </p>
          {(data.label ?? '').trim() && (
            <button
              onClick={handleSuggest}
              disabled={isSuggesting}
              className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-violet-200 bg-white px-2.5 py-1.5 text-xs font-medium text-violet-600 transition-colors hover:bg-violet-50 disabled:opacity-50"
            >
              {isSuggesting ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Sparkles className="h-3 w-3" />
              )}
              {isSuggesting ? 'Suggesting…' : 'Suggest fields with AI'}
            </button>
          )}
        </div>
      )}

      {/* ── AI suggestion strip ───────────────────────────────────────── */}
      {suggestError && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-2">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
          <p className="text-xs text-destructive">{suggestError}</p>
        </div>
      )}

      {suggestions && suggestions.length > 0 && (
        <div className="rounded-md border border-violet-200 bg-violet-50 p-2">
          <div className="mb-1.5 flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-600">
              AI suggestions — click to add
            </p>
            <button
              onClick={() => setSuggestions(null)}
              className="rounded p-0.5 text-violet-400 hover:text-violet-600"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
          <div className="flex flex-col gap-1">
            {suggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => handleAddSuggestion(s)}
                className="flex items-center gap-2 rounded-md border border-violet-200 bg-white px-2 py-1.5 text-left transition-colors hover:bg-violet-50"
              >
                <span className="shrink-0 rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700">
                  {s.type}
                </span>
                <span className="text-xs text-foreground">{s.label}</span>
                <Plus className="ml-auto h-3 w-3 shrink-0 text-violet-400" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Sortable field list ──────────────────────────────────────── */}
      {fields.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-1.5">
              {fields.map((field) => (
                <FormFieldRow
                  key={field.id}
                  nodeId={node.id}
                  field={field}
                  onUpdate={(fieldId, patch) => {
                    updateFormField(node.id, fieldId, patch)
                    triggerSave() // FIX: persist after updating a field
                  }}
                  onRemove={(fieldId) => {
                    removeFormField(node.id, fieldId)
                    triggerSave() // FIX: persist after removing a field
                  }}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* ── Field count summary ───────────────────────────────────────── */}
      {fields.length > 0 && (
        <p className="text-right text-[10px] text-muted-foreground">
          {fields.length} field{fields.length !== 1 ? 's' : ''}
          {' · '}
          {fields.filter((f) => f.required).length} required
        </p>
      )}
    </div>
  )
}
