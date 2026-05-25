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
import { FileDownloadLink, isFilePaths } from '@/components/canvas/FileDownloadLink'
import { useState, useEffect, useRef, useTransition } from 'react'
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
import { createBrowserClient } from '@supabase/ssr'

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
  // Required for file upload path construction
  tenantId: string
  instanceId: string
  stepId: string
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
  tenantId,
  instanceId,
  stepId,
}: StepFormModalProps) {
  // Local form state — keyed by FormField.id
  const [values, setValues] = useState<Record<string, unknown>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [isSavingDraft, startSaveDraft] = useTransition()
  const [isSubmitting, startSubmit] = useTransition()

  // File upload state: fieldId → File[]
  const [filesByField, setFilesByField] = useState<Record<string, File[]>>({})
  const [uploadProgress, setUploadProgress] = useState<Record<string, string>>({})

  // Re-initialise values whenever the modal opens or initialData changes
  useEffect(() => {
    if (open) {
      // For date fields with no saved value, default to today at 23:59:59
      const defaults: Record<string, unknown> = {}
      for (const field of formSchema) {
        if (field.type === 'date' && !initialData?.[field.id]) {
          defaults[field.id] = defaultDateValue()
        }
      }
      setValues({ ...defaults, ...(initialData ?? {}) })
      setErrors({})
      setFilesByField({})
      setUploadProgress({})
    }
  }, [open, initialData, formSchema])

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
      } else if (field.type === 'file') {
        // File fields store selected files in filesByField, not in values
        const selectedFiles = filesByField[field.id] ?? []
        if (selectedFiles.length === 0) newErrors[field.id] = 'Please select at least one file.'
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
        // 1. Upload any files first, collect storage paths into values
        const finalValues = { ...values }
        const supabase = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        )

        for (const [fieldId, files] of Object.entries(filesByField)) {
          if (!files.length) continue
          const paths: string[] = []

          for (const file of files) {
            // Enforce 10 MB limit client-side (bucket policy also enforces it)
            if (file.size > 10 * 1024 * 1024) {
              toast.error(`${file.name} exceeds the 10 MB file size limit.`)
              return
            }

            setUploadProgress((p) => ({ ...p, [fieldId]: `Uploading ${file.name}…` }))

            // Path: {tenantId}/{instanceId}/{stepId}/{fieldId}/{filename}
            const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
            const path = `${tenantId}/${instanceId}/${stepId}/${fieldId}/${Date.now()}_${safeName}`

            const { error: uploadError } = await supabase.storage
              .from('step-attachments')
              .upload(path, file, { upsert: false })

            if (uploadError) {
              toast.error(`Failed to upload ${file.name}: ${uploadError.message}`)
              setUploadProgress((p) => ({ ...p, [fieldId]: '' }))
              return
            }

            paths.push(path)
          }

          setUploadProgress((p) => ({ ...p, [fieldId]: '' }))
          // Store as array of paths — download via signed URL in read-only view
          finalValues[fieldId] = paths
        }

        // 2. Submit with file paths included in form_data
        const result = await submitStep(stepInstanceId, finalValues)
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
              files={filesByField[field.id] ?? []}
              uploadProgress={uploadProgress[field.id] ?? ''}
              onFilesChange={(files) => setFilesByField((prev) => ({ ...prev, [field.id]: files }))}
              tenantId={tenantId}
              supabaseUrl={process.env.NEXT_PUBLIC_SUPABASE_URL!}
              supabaseAnonKey={process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}
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

// ─── AutoTextarea ─────────────────────────────────────────────────────────────
// Textarea that auto-grows with content, starting at 5 rows minimum.

function AutoTextarea({
  id,
  value,
  onChange,
  disabled,
  className,
}: {
  id: string
  value: string
  onChange: (val: string) => void
  disabled: boolean
  className?: string
}) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [value])

  return (
    <textarea
      ref={ref}
      id={id}
      value={value}
      rows={5}
      disabled={disabled}
      placeholder="Enter your answer…"
      onChange={(e) => onChange(e.target.value)}
      className={`flex w-full rounded-md border bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none overflow-hidden ${className ?? ''}`}
    />
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
  files,
  uploadProgress,
  onFilesChange,
  tenantId: _tenantId,
  supabaseUrl: _supabaseUrl,
  supabaseAnonKey: _supabaseAnonKey,
}: {
  field: FormField
  value: unknown
  error?: string
  disabled: boolean
  onChange: (val: unknown) => void
  onCheckboxChange: (option: string, checked: boolean) => void
  files: File[]
  uploadProgress: string
  onFilesChange: (files: File[]) => void
  tenantId: string
  supabaseUrl: string
  supabaseAnonKey: string
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

      {field.type === 'textarea' && (
        <AutoTextarea
          id={`field-${field.id}`}
          value={typeof value === 'string' ? value : ''}
          onChange={onChange}
          disabled={disabled}
          className={error ? 'border-destructive' : 'border-input'}
        />
      )}

      {field.type === 'number' && (
        <Input
          id={`field-${field.id}`}
          type="number"
          value={typeof value === 'string' || typeof value === 'number' ? String(value) : ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder="Enter a number…"
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
        <div className="space-y-2">
          {/* Read-only: show download links for already-uploaded files */}
          {disabled && isFilePaths(value as unknown) && (
            <div className="space-y-1">
              {(value as unknown as string[]).map((path) => (
                <FileDownloadLink key={path} storagePath={path} />
              ))}
            </div>
          )}
          {/* Editable: show file picker */}
          {!disabled && (
            <>
              <input
                id={`field-${field.id}`}
                type="file"
                multiple
                disabled={disabled}
                className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-accent"
                onChange={(e) => onFilesChange(Array.from(e.target.files ?? []))}
              />
              <p className="text-xs text-muted-foreground">
                Max 10 MB per file. Multiple files allowed.
              </p>
              {files.length > 0 && (
                <ul className="space-y-1">
                  {files.map((f, i) => (
                    <li key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="truncate flex-1">{f.name}</span>
                      <span className="shrink-0 tabular-nums">{(f.size / 1024).toFixed(0)} KB</span>
                      {f.size > 10 * 1024 * 1024 && (
                        <span className="shrink-0 text-destructive font-medium">Too large</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {uploadProgress && (
                <p className="text-xs text-blue-600 animate-pulse">{uploadProgress}</p>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Date & Time field ── */}
      {field.type === 'date' && (
        <div className="space-y-1">
          {disabled ? (
            // Read-only: display as friendly string
            <p className="rounded-md border border-input bg-muted/40 px-3 py-2 text-sm text-foreground">
              {value ? (
                formatDateDisplay(String(value))
              ) : (
                <span className="text-muted-foreground">(no date set)</span>
              )}
            </p>
          ) : (
            <input
              id={`field-${field.id}`}
              type="datetime-local"
              value={toDatetimeLocal(String(value ?? ''))}
              disabled={disabled}
              onChange={(e) => onChange(fromDatetimeLocal(e.target.value))}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
          )}
        </div>
      )}

      {/* Error message */}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
// ─── Date helpers ─────────────────────────────────────────────────────────────

/**
 * Returns ISO string for today at 23:59:59 local time.
 * Used as the default value for date fields when no draft value exists.
 */
function defaultDateValue(): string {
  const d = new Date()
  d.setHours(23, 59, 59, 0)
  return d.toISOString()
}

/**
 * Converts an ISO string (stored in form_data) to the "YYYY-MM-DDTHH:mm"
 * format required by <input type="datetime-local">.
 */
function toDatetimeLocal(iso: string): string {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    // toISOString gives UTC; we want local time for the input
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  } catch {
    return ''
  }
}

/**
 * Converts the "YYYY-MM-DDTHH:mm" value from datetime-local back to ISO string
 * with seconds set to :59 (to include the full minute as per design).
 */
function fromDatetimeLocal(localStr: string): string {
  if (!localStr) return ''
  try {
    // datetime-local gives "2026-05-17T23:59" — parse as local time
    const d = new Date(localStr)
    d.setSeconds(59, 0)
    return d.toISOString()
  } catch {
    return localStr
  }
}

/**
 * Formats an ISO date string for friendly display in read-only mode.
 * e.g. "2026-05-17T23:59:00.000Z" → "17 May 2026, 11:59 PM"
 */
function formatDateDisplay(iso: string): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })
  } catch {
    return iso
  }
}
