'use client'

// FILE PATH: src/components/canvas/StepFormModal.tsx
//
// Renders the step form inside a Dialog modal.
// Opened from the step timeline on /my-flows/[id].
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
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { saveDraftStep, submitStep } from '@/lib/flows/actions'
import type { FormField } from '@/store/canvas-store'
import { createBrowserClient } from '@supabase/ssr'
import { FieldRenderer, defaultDateValue } from '@/components/canvas/FormFieldRenderer'

// ─── Props ────────────────────────────────────────────────────────────────────

interface StepFormModalProps {
  open: boolean
  onClose: () => void
  onSubmitted: () => void
  stepInstanceId: string
  stepLabel: string
  flowName?: string
  formSchema: FormField[]
  initialData: Record<string, unknown>
  isReadOnly: boolean
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
  flowName,
  formSchema,
  initialData,
  isReadOnly,
  tenantId,
  instanceId,
  stepId,
}: StepFormModalProps) {
  const [values, setValues] = useState<Record<string, unknown>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSavingDraft, startSaveDraft] = useTransition()
  const [isSubmitting, startSubmit] = useTransition()
  const [filesByField, setFilesByField] = useState<Record<string, File[]>>({})
  const [uploadProgress, setUploadProgress] = useState<Record<string, string>>({})

  useEffect(() => {
    if (open) {
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

  function setValue(fieldId: string, value: unknown) {
    setValues((prev) => ({ ...prev, [fieldId]: value }))
    if (errors[fieldId]) {
      setErrors((prev) => {
        const n = { ...prev }
        delete n[fieldId]
        return n
      })
    }
  }

  function toggleCheckbox(fieldId: string, option: string, checked: boolean) {
    setValues((prev) => {
      const current = (prev[fieldId] as string[]) ?? []
      const next = checked ? [...current, option] : current.filter((v) => v !== option)
      return { ...prev, [fieldId]: next }
    })
    if (errors[fieldId]) {
      setErrors((prev) => {
        const n = { ...prev }
        delete n[fieldId]
        return n
      })
    }
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {}
    for (const field of formSchema) {
      if (!field.required) continue
      const val = values[field.id]
      if (field.type === 'checkbox') {
        if (((val as string[]) ?? []).length === 0)
          newErrors[field.id] = 'Please select at least one option.'
      } else if (field.type === 'file') {
        if ((filesByField[field.id] ?? []).length === 0)
          newErrors[field.id] = 'Please select at least one file.'
      } else {
        if (!(typeof val === 'string' ? val.trim() : ''))
          newErrors[field.id] = 'This field is required.'
      }
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  function handleSaveDraft() {
    startSaveDraft(async () => {
      const result = await saveDraftStep(stepInstanceId, values)
      if (result.error) toast.error(result.error)
      else toast.success('Draft saved.')
    })
  }

  function handleSubmit() {
    if (!validate()) return
    startSubmit(async () => {
      try {
        const finalValues = { ...values }
        const supabase = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        )
        for (const [fieldId, files] of Object.entries(filesByField)) {
          if (!files.length) continue
          const paths: string[] = []
          for (const file of files) {
            if (file.size > 10 * 1024 * 1024) {
              toast.error(`${file.name} exceeds the 10 MB file size limit.`)
              return
            }
            setUploadProgress((p) => ({ ...p, [fieldId]: `Uploading ${file.name}…` }))
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
          finalValues[fieldId] = paths
        }
        const result = await submitStep(stepInstanceId, finalValues)
        if (result.error) {
          toast.error(result.error)
        } else {
          toast.success(
            result.milestone === 'first_task'
              ? '🎉 You completed your first task!'
              : 'Step completed.'
          )
          onSubmitted()
          onClose()
        }
      } catch {
        toast.error('Failed to submit step.')
      }
    })
  }

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
              stepLabel={stepLabel}
              flowName={flowName}
            />
          ))}
        </div>

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
