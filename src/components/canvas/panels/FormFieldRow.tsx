'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Trash2, Plus, X } from 'lucide-react'
import type { FormField } from '@/store/canvas-store'

// ─── Types ───────────────────────────────────────────────────────────────────

interface FormFieldRowProps {
  nodeId: string
  field: FormField // _field is unused parameter
  onUpdate: (_fieldId: string, _patch: Partial<FormField>) => void
  onRemove: (_fieldId: string) => void
}

// ─── Field type label map ─────────────────────────────────────────────────────

// ─── Field type label map ─────────────────────────────────────────────────────

const FIELD_TYPE_LABELS: Record<FormField['type'], string> = {
  text: 'Text',
  dropdown: 'Dropdown',
  radio: 'Radio',
  checkbox: 'Checkbox',
  file: 'File',
  date: 'Date', // <-- Add this missing line!
}

const FIELD_TYPE_COLORS: Record<FormField['type'], string> = {
  text: 'bg-sky-100 text-sky-700',
  dropdown: 'bg-violet-100 text-violet-700',
  radio: 'bg-orange-100 text-orange-700',
  checkbox: 'bg-teal-100 text-teal-700',
  file: 'bg-pink-100 text-pink-700',
  date: 'bg-emerald-100 text-emerald-700', // <-- Add this line (or choose your preferred Tailwind colors)
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function FormFieldRow({ field, onUpdate, onRemove }: FormFieldRowProps) {
  // ── dnd-kit sortable setup ───────────────────────────────────────────────
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: field.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 10 : 'auto',
  }

  // ── Option helpers (dropdown / radio) ───────────────────────────────────

  const hasOptions =
    field.type === 'dropdown' || field.type === 'radio' || field.type === 'checkbox'

  function addOption() {
    onUpdate(field.id, { options: [...(field.options ?? []), ''] })
  }

  function updateOption(index: number, value: string) {
    const updated = [...(field.options ?? [])]
    updated[index] = value
    onUpdate(field.id, { options: updated })
  }

  function removeOption(index: number) {
    const updated = (field.options ?? []).filter((_, i) => i !== index)
    onUpdate(field.id, { options: updated })
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div
      ref={setNodeRef}
      style={style as React.CSSProperties}
      className="rounded-md border border-border bg-card shadow-sm"
    >
      {/* ── Field header row ─────────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 p-2">
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="flex-shrink-0 cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
          aria-label="Drag to reorder"
          tabIndex={-1}
        >
          <GripVertical className="h-4 w-4" />
        </button>

        {/* Type badge */}
        <span
          className={`flex-shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${FIELD_TYPE_COLORS[field.type]}`}
        >
          {FIELD_TYPE_LABELS[field.type]}
        </span>

        {/* Label input */}
        <input
          type="text"
          value={field.label}
          onChange={(e) => onUpdate(field.id, { label: e.target.value })}
          placeholder="Field label"
          className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 py-0.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-border focus:outline-none focus:ring-0"
        />

        {/* Required toggle */}
        <label className="flex flex-shrink-0 cursor-pointer items-center gap-1 text-xs text-muted-foreground select-none">
          <input
            type="checkbox"
            checked={field.required}
            onChange={(e) => onUpdate(field.id, { required: e.target.checked })}
            className="h-3 w-3 rounded accent-primary"
          />
          Req
        </label>

        {/* Delete button */}
        <button
          onClick={() => onRemove(field.id)}
          className="flex-shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          aria-label="Remove field"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* ── Options editor (dropdown / radio only) ───────────────────── */}
      {hasOptions && (
        <div className="border-t border-border px-2 pb-2 pt-1.5">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Options
          </p>

          <div className="flex flex-col gap-1">
            {(field.options ?? []).map((opt, i) => (
              <div key={i} className="flex items-center gap-1">
                <span className="flex-shrink-0 text-xs text-muted-foreground">{i + 1}.</span>
                <input
                  type="text"
                  value={opt}
                  onChange={(e) => updateOption(i, e.target.value)}
                  placeholder={`Option ${i + 1}`}
                  className="min-w-0 flex-1 rounded border border-border bg-muted/30 px-1.5 py-0.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-0"
                />
                <button
                  onClick={() => removeOption(i)}
                  disabled={(field.options?.length ?? 0) <= 1}
                  className="flex-shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:text-destructive disabled:cursor-not-allowed disabled:opacity-30"
                  aria-label="Remove option"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>

          {/* Add option button */}
          <button
            onClick={addOption}
            className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <Plus className="h-3 w-3" />
            Add option
          </button>
        </div>
      )}
    </div>
  )
}
