'use client'

// FlowInitiationModal — opens immediately when a user clicks "Start Flow".
//
// Behaviour:
//   1. On open: calls triggerFlowForInitiation() → creates the flow instance
//      and step-1 (always assigned to the triggerer).
//   2. If the flow has no first step (trivial): navigates to /tasks and closes.
//   3. Otherwise: renders the first step's form fields inline.
//   4. On submit: uploads any files, calls submitStep(), navigates to
//      /tasks?open=<instanceId> so the user can track their flow.
//   5. On cancel: calls cancelInstance() to clean up the pending instance.

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Loader2, PlayIcon } from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'
import { triggerFlowForInitiation, submitStep, cancelInstance } from '@/lib/flows/actions'
import { FieldRenderer, defaultDateValue } from '@/components/canvas/FormFieldRenderer'
import type { FormField } from '@/store/canvas-store'

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean
  onClose: () => void
  flowId: string
  flowName: string
}

// ─── Component ────────────────────────────────────────────────────────────────

export function FlowInitiationModal({ open, onClose, flowId, flowName }: Props) {
  const router = useRouter()

  // Stage machine: loading → ready (with or without fields) → submitting
  const [stage, setStage] = useState<'loading' | 'ready' | 'submitting'>('loading')
  const [loadError, setLoadError] = useState<string | null>(null)

  // Data returned by triggerFlowForInitiation
  const [instanceId, setInstanceId] = useState<string | null>(null)
  const [stepInstanceId, setStepInstanceId] = useState<string | null>(null)
  const [stepNodeId, setStepNodeId] = useState<string | null>(null)
  const [stepLabel, setStepLabel] = useState('')
  const [stepDescription, setStepDescription] = useState<string | null>(null)
  const [fields, setFields] = useState<FormField[]>([])
  const [tenantId, setTenantId] = useState<string | null>(null)

  // Form state
  const [values, setValues] = useState<Record<string, unknown>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [filesByField, setFilesByField] = useState<Record<string, File[]>>({})
  const [uploadProgress, setUploadProgress] = useState<Record<string, string>>({})
  const [isCancelling, startCancel] = useTransition()

  // ── Trigger on open ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!open) return
    setStage('loading')
    setLoadError(null)
    setValues({})
    setErrors({})
    setFilesByField({})
    setUploadProgress({})

    triggerFlowForInitiation(flowId).then((result) => {
      if (result.error) {
        setLoadError(result.error)
        setStage('ready')
        return
      }

      setInstanceId(result.instanceId)
      setTenantId(result.tenantId)

      // Trivial flow: no first step — navigate directly
      if (!result.stepInstanceId) {
        onClose()
        router.push(`/tasks?open=${result.instanceId}`)
        return
      }

      setStepInstanceId(result.stepInstanceId)
      setStepNodeId(result.stepNodeId)
      setStepLabel(result.stepLabel)
      setStepDescription(result.stepDescription)
      setFields(result.fields)

      // Seed date defaults
      const defaults: Record<string, unknown> = {}
      for (const field of result.fields) {
        if (field.type === 'date') defaults[field.id] = defaultDateValue()
      }
      setValues(defaults)
      setStage('ready')
    })
  }, [open, flowId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Field helpers ───────────────────────────────────────────────────────────

  function setValue(fieldId: string, value: unknown) {
    setValues((prev) => ({ ...prev, [fieldId]: value }))
    if (errors[fieldId])
      setErrors((prev) => {
        const n = { ...prev }
        delete n[fieldId]
        return n
      })
  }

  function toggleCheckbox(fieldId: string, option: string, checked: boolean) {
    setValues((prev) => {
      const current = (prev[fieldId] as string[]) ?? []
      return {
        ...prev,
        [fieldId]: checked ? [...current, option] : current.filter((v) => v !== option),
      }
    })
    if (errors[fieldId])
      setErrors((prev) => {
        const n = { ...prev }
        delete n[fieldId]
        return n
      })
  }

  // ── Validation ──────────────────────────────────────────────────────────────

  function validate(): boolean {
    const newErrors: Record<string, string> = {}
    for (const field of fields) {
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

  // ── Submit ──────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!validate()) return
    if (!stepInstanceId) return
    setStage('submitting')
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
            setStage('ready')
            return
          }
          setUploadProgress((p) => ({ ...p, [fieldId]: `Uploading ${file.name}…` }))
          const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
          const path = `${tenantId}/${instanceId}/${stepNodeId}/${fieldId}/${Date.now()}_${safeName}`
          const { error: uploadError } = await supabase.storage
            .from('step-attachments')
            .upload(path, file, { upsert: false })
          if (uploadError) {
            toast.error(`Failed to upload ${file.name}: ${uploadError.message}`)
            setUploadProgress((p) => ({ ...p, [fieldId]: '' }))
            setStage('ready')
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
        setStage('ready')
      } else {
        onClose()
        router.push(`/tasks?open=${instanceId}`)
      }
    } catch {
      toast.error('Failed to start flow.')
      setStage('ready')
    }
  }

  // ── Cancel ──────────────────────────────────────────────────────────────────

  function handleCancel() {
    if (instanceId) {
      startCancel(async () => {
        await cancelInstance(instanceId)
        onClose()
      })
    } else {
      onClose()
    }
  }

  const isLoading = stage === 'loading'
  const isSubmitting = stage === 'submitting'
  const isBusy = isLoading || isSubmitting || isCancelling
  const hasFields = fields.length > 0

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && !isBusy) handleCancel()
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{flowName}</DialogTitle>
          {!isLoading && !loadError && hasFields && (
            <DialogDescription>Fill in the details below to start this flow.</DialogDescription>
          )}
        </DialogHeader>

        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Error state */}
        {!isLoading && loadError && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-3">
            <p className="text-sm text-destructive">{loadError}</p>
          </div>
        )}

        {/* Form / confirmation */}
        {!isLoading && !loadError && (
          <div className="space-y-5 py-1">
            {stepLabel && (
              <div className="space-y-0.5">
                <p className="text-sm font-semibold text-foreground">{stepLabel}</p>
                {stepDescription && (
                  <p className="text-xs text-muted-foreground">{stepDescription}</p>
                )}
              </div>
            )}

            {!hasFields && (
              <p className="text-sm text-muted-foreground">
                Click <strong>Start Flow</strong> to begin.
              </p>
            )}

            {fields.map((field) => (
              <FieldRenderer
                key={field.id}
                field={field}
                value={values[field.id]}
                error={errors[field.id]}
                disabled={isSubmitting}
                onChange={(val) => setValue(field.id, val)}
                onCheckboxChange={(option, checked) => toggleCheckbox(field.id, option, checked)}
                files={filesByField[field.id] ?? []}
                uploadProgress={uploadProgress[field.id] ?? ''}
                onFilesChange={(files) =>
                  setFilesByField((prev) => ({ ...prev, [field.id]: files }))
                }
                tenantId={tenantId ?? ''}
                supabaseUrl={process.env.NEXT_PUBLIC_SUPABASE_URL!}
                supabaseAnonKey={process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}
                stepLabel={stepLabel}
                flowName={flowName}
              />
            ))}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="ghost" size="sm" onClick={handleCancel} disabled={isBusy}>
            Cancel
          </Button>
          {!loadError && (
            <Button size="sm" onClick={handleSubmit} disabled={isBusy} className="gap-1.5">
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <PlayIcon className="h-3.5 w-3.5" />
              )}
              {isSubmitting ? 'Starting…' : 'Start Flow'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
