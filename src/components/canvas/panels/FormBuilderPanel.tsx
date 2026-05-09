'use client'

import { useState } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { Plus, ChevronDown } from 'lucide-react'
import type { Node } from '@xyflow/react'
import {
  useCanvasStore,
  type FormField,
  type FormFieldType,
  type NodeData,
} from '@/store/canvas-store'
import FormFieldRow from './FormFieldRow'

// ─── Types ────────────────────────────────────────────────────────────────────

interface FormBuilderPanelProps {
  node: Node
}

// ─── Add-field menu options ───────────────────────────────────────────────────

const FIELD_TYPES: { type: FormFieldType; label: string; description: string }[] = [
  { type: 'text', label: 'Text', description: 'Single-line or multi-line text input' },
  { type: 'dropdown', label: 'Dropdown', description: 'Select one from a list' },
  { type: 'radio', label: 'Radio', description: 'Pick one from visible options' },
  { type: 'checkbox', label: 'Checkbox', description: 'One or more selections' },
  { type: 'file', label: 'File upload', description: 'Upload one or more files' },
]

// ─── Component ────────────────────────────────────────────────────────────────

export default function FormBuilderPanel({ node }: FormBuilderPanelProps) {
  const { addFormField, updateFormField, removeFormField, reorderFormFields } = useCanvasStore()

  const [menuOpen, setMenuOpen] = useState(false)

  const data = node.data as NodeData
  const fields: FormField[] = data.formSchema ?? []

  // ── dnd-kit sensors ─────────────────────────────────────────────────────
  // PointerSensor with a 5px activation distance prevents accidental drags
  // when clicking inputs inside the field row.
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  )

  // ── Drag end handler ─────────────────────────────────────────────────────

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = fields.findIndex((f) => f.id === active.id)
    const newIndex = fields.findIndex((f) => f.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const reordered = arrayMove(fields, oldIndex, newIndex)
    reorderFormFields(node.id, reordered)
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
              {/* Backdrop to close menu on outside click */}
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full z-20 mt-1 w-52 rounded-md border border-border bg-popover shadow-md">
                {FIELD_TYPES.map(({ type, label, description }) => (
                  <button
                    key={type}
                    onClick={() => {
                      addFormField(node.id, type)
                      setMenuOpen(false)
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

      {/* ── Empty state ──────────────────────────────────────────────── */}
      {fields.length === 0 && (
        <div className="rounded-md border border-dashed border-border bg-muted/20 py-4 text-center">
          <p className="text-xs text-muted-foreground">
            No fields yet. Click <span className="font-semibold">Add field</span> to start.
          </p>
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
                  onUpdate={(fieldId, patch) => updateFormField(node.id, fieldId, patch)}
                  onRemove={(fieldId) => removeFormField(node.id, fieldId)}
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
