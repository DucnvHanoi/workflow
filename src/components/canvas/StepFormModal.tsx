'use client'

// FILE PATH: src/components/canvas/StepFormModal.tsx
//
// Renders the step form inside a Dialog modal.
// Opened from the step timeline on /my-flows/[id].
//
// Props:
//   open          — whether the modal is visible
//   onClose       — called when the modal closes (Cancel or after Submit)
//   onSubmitted   — called after a successful submit so the parent can refresh
//   stepInstanceId — the step_instance row to load + save
//   stepLabel     — display name for the step (from graph node label)
//   formSchema    — FormField[] from the graph node's data.formSchema
//   initialData   — pre-populated form_data (saved draft or {} for a new step)
//   isReadOnly    — true when the step is already completed/skipped
//
// Flow:
//   1. On open, initialise local state from initialData
//   2. "Save Draft" → calls saveDraftStep(), shows toast, keeps modal open
//   3. "Submit"     → validates required fields client-side, calls submitStep(),
//                     shows toast, closes modal, calls onSubmitted()

import { useState, useEffect, useTransition } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { saveDraftStep, submitStep } from '@/lib/flows/actions'
import type { FormField } from '@/store/canvas-store'

// ─── Props ────────────────────────────────────────────────────────────────────

interface StepFormModalProps {
  open: boolean
  onClose: () => void
  onSubmitted: () => void
  stepInstanceId: string
  stepLabel: string
  formSchema: FormField[]
  initialData: Record<string, unknown>
  isReadOnly: boolean
}

// ─── Component ────────────────────────────────────────────────────────────────

export function StepFormModal({
  open,
  onClose,
  onSubmitted,
  stepInstanceId,
  stepLabel,
  formSchema,
  initialData,
  isReadOnly,
}: StepFormModalProps) {
  // Local form state — keyed by FormField.id
  const [values, setValues] = useState<Record<string, unknown>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [isSavingDraft, startSaveDraft] = useTransition()
  const [isSubmitting, startSubmit] = useTransition()

  // Re-initialise values whenever the modal opens or initialData changes
  useEffect(() => {
    if (open) {
      setValues(initialData ?? {})
      setErrors({})
    }
  }, [open, initialData])

  // ── Field change helpers ─────────────────────────────────────────────────

  function setValue(fieldId: string, value: unknown) {
    setValues((prev) => ({ ...prev, [fieldId]: value }))
    // Clear error on change
    if (errors[fieldId]) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[fieldId]
        return next
      })
    }
  }

  // checkbox: toggle a value in/out of a string[]
  function toggleCheckbox(fieldId: string, option: string, checked: boolean) {
    setValues((prev) => {
      const current = (prev[fieldId] as string[]) ?? []
      const next = checked ? [...current, option] : current.filter((v) => v !== option)
      return { ...prev, [fieldId]: next }
    })
    if (errors[fieldId]) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[fieldId]
        return next
      })
    }
  }

  // ── Client-side validation ───────────────────────────────────────────────

  function validate(): boolean {
    const newErrors: Record<string, string> = {}

    for (const field of formSchema) {
      if (!field.required) continue

      const val = values[field.id]

      if (field.type === 'checkbox') {
        const arr = (val as string[]) ?? []
        if (arr.length === 0) newErrors[field.id] = 'Please select at least one option.'
      } else {
        const str = typeof val === 'string' ? val.trim() : ''
        if (!str) newErrors[field.id] = 'This field is required.'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // ── Save draft ───────────────────────────────────────────────────────────

  function handleSaveDraft() {
    startSaveDraft(async () => {
      try {
        const result = await saveDraftStep(stepInstanceId, values)
        if (result.error) {
          toast.error(result.error)
        } else {
          toast.success('Draft saved.')
        }
      } catch {
        toast.error('Failed to save draft.')
      }
    })
  }

  // ── Submit ───────────────────────────────────────────────────────────────

  function handleSubmit() {
    if (!validate()) return

    startSubmit(async () => {
      try {
        const result = await submitStep(stepInstanceId, values)
        if (result.error) {
          toast.error(result.error)
        } else {
          toast.success('Step completed.')
          onSubmitted()
          onClose()
        }
      } catch {
        toast.error('Failed to submit step.')
      }
    })
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose()
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {stepLabel}
            {isReadOnly && (
              <Badge variant="secondary" className="text-xs">
                Completed
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* ── Form fields ── */}
        <div className="space-y-5 py-2">
          {formSchema.length === 0 && (
            <p className="text-sm text-muted-foreground">No fields defined for this step.</p>
          )}

          {formSchema.map((field) => (
            <FieldRenderer
              key={field.id}
              field={field}
              value={values[field.id]}
              error={errors[field.id]}
              disabled={isReadOnly || isSubmitting || isSavingDraft}
              onChange={(val) => setValue(field.id, val)}
              onCheckboxChange={(option, checked) => toggleCheckbox(field.id, option, checked)}
            />
          ))}
        </div>

        {/* ── Footer buttons ── */}
        {!isReadOnly && (
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSaveDraft}
              disabled={isSavingDraft || isSubmitting}
            >
              {isSavingDraft ? 'Saving…' : 'Save Draft'}
            </Button>

            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSubmit} disabled={isSubmitting || isSavingDraft}>
                {isSubmitting ? 'Submitting…' : 'Submit'}
              </Button>
            </div>
          </DialogFooter>
        )}

        {isReadOnly && (
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ─── FieldRenderer ────────────────────────────────────────────────────────────
// Renders a single form field based on its type.

function FieldRenderer({
  field,
  value,
  error,
  disabled,
  onChange,
  onCheckboxChange,
}: {
  field: FormField
  value: unknown
  error?: string
  disabled: boolean
  onChange: (val: unknown) => void
  onCheckboxChange: (option: string, checked: boolean) => void
}) {
  return (
    <div className="space-y-1.5">
      {/* Label */}
      <Label htmlFor={`field-${field.id}`} className="text-sm font-medium">
        {field.label || <span className="italic text-muted-foreground">Unlabelled field</span>}
        {field.required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>

      {/* Input by type */}
      {field.type === 'text' && (
        <Input
          id={`field-${field.id}`}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder="Enter your answer…"
          className={error ? 'border-destructive' : ''}
        />
      )}

      {field.type === 'dropdown' && (
        <select
          id={`field-${field.id}`}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={`flex h-9 w-full rounded-md border bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${
            error ? 'border-destructive' : 'border-input'
          }`}
        >
          <option value="">Select an option…</option>
          {(field.options ?? []).map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      )}

      {field.type === 'radio' && (
        <div className="space-y-2">
          {(field.options ?? [])
            .filter((o) => o.trim() !== '')
            .map((opt) => (
              <label key={opt} className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name={`field-${field.id}`}
                  value={opt}
                  checked={value === opt}
                  onChange={() => onChange(opt)}
                  disabled={disabled}
                  className="accent-primary"
                />
                {opt}
              </label>
            ))}
          {(field.options ?? []).filter((o) => o.trim() !== '').length === 0 && (
            <p className="text-xs text-muted-foreground">No options defined.</p>
          )}
        </div>
      )}

      {field.type === 'checkbox' && (
        <div className="space-y-2">
          {/* options is undefined: field was saved before the checkbox bug fix.
              Show a clear message so the user knows to re-save the flow. */}
          {(field.options === undefined || field.options === null) && (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              This checkbox field has no options configured. Open the flow builder, edit this field
              to add options, then re-publish the flow.
            </p>
          )}

          {/* options exists but all entries are blank */}
          {Array.isArray(field.options) &&
            field.options.filter((o) => o.trim() !== '').length === 0 && (
              <p className="text-xs text-muted-foreground">No options defined.</p>
            )}

          {/* Normal render: only show non-empty option strings if options exists */}
          {(field.options ?? [])
            .filter((o) => o.trim() !== '')
            .map((opt) => {
              const selected = ((value as string[]) ?? []).includes(opt)
              return (
                <label key={opt} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    value={opt}
                    checked={selected}
                    onChange={(e) => onCheckboxChange(opt, e.target.checked)}
                    disabled={disabled}
                    className="accent-primary"
                  />
                  {opt}
                </label>
              )
            })}
        </div>
      )}

      {field.type === 'file' && (
        <div className="rounded-md border border-dashed bg-muted/30 px-4 py-3 text-center">
          <p className="text-sm text-muted-foreground">File upload coming soon.</p>
          {typeof value === 'string' && value && (
            <p className="mt-1 text-xs text-muted-foreground">
              Previously uploaded: <span className="font-medium">{value}</span>
            </p>
          )}
        </div>
      )}

      {/* Error message */}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
