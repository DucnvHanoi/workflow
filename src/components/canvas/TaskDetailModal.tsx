'use client'

// FILE PATH: src/components/canvas/TaskDetailModal.tsx
//
// Full-picture task modal for the /tasks page.
// Shows two tabs:
//   "Context"   — activity log + previous steps' submitted values, so the
//                 assignee understands everything that happened before their turn.
//   "Your Task" — the step form fields to fill in (identical to StepFormModal).
//
// Fetches task context (timeline + previous data) via getTaskContext() on open.
// On submit, calls submitStep() + onSubmitted() so tasks-client.tsx can refresh.

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
import {
  // data fetching
  getTaskContext,
  // form actions
  saveDraftStep,
  submitStep,
  // types
  type TaskContext,
  type FlowEventLog,
  type PreviousStepData,
} from '@/lib/flows/actions'
import type { FormField } from '@/store/canvas-store'
import { createBrowserClient } from '@supabase/ssr'
import { FileDownloadLink, isFilePaths } from '@/components/canvas/FileDownloadLink'
import {
  RocketIcon,
  UserIcon,
  SaveIcon,
  CheckCircleIcon,
  GitBranchIcon,
  FlagIcon,
  XCircleIcon,
  BanIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  Loader2Icon,
  ClipboardIcon,
  ActivityIcon,
} from 'lucide-react'

// ─── Props ────────────────────────────────────────────────────────────────────

interface TaskDetailModalProps {
  open: boolean
  onClose: () => void
  onSubmitted: () => void
  stepInstanceId: string
  stepLabel: string
  formSchema: FormField[]
  initialData: Record<string, unknown>
  flowName: string
  triggeredByName: string | null
  tenantId: string
  instanceId: string
  stepNodeId: string
}

// ─── Tab type ─────────────────────────────────────────────────────────────────

type Tab = 'context' | 'task'

// ─── Component ────────────────────────────────────────────────────────────────

export function TaskDetailModal({
  open,
  onClose,
  onSubmitted,
  stepInstanceId,
  stepLabel,
  formSchema,
  initialData,
  flowName,
  triggeredByName,
  tenantId,
  instanceId,
  stepNodeId,
}: TaskDetailModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>('context')
  const [context, setContext] = useState<TaskContext | null>(null)
  const [contextLoading, setContextLoading] = useState(false)
  const [contextError, setContextError] = useState<string | null>(null)

  // Form state
  const [values, setValues] = useState<Record<string, unknown>>({})
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [isSavingDraft, startSaveDraft] = useTransition()
  const [isSubmitting, startSubmit] = useTransition()
  // File upload state: fieldId → File[]
  const [filesByField, setFilesByField] = useState<Record<string, File[]>>({})
  const [uploadProgress, setUploadProgress] = useState<Record<string, string>>({})

  // Fetch context when modal opens
  useEffect(() => {
    if (!open || !stepInstanceId) return

    setContext(null)
    setContextError(null)
    setContextLoading(true)
    setActiveTab('context')

    // For date fields with no saved value, default to today at 23:59:59
    const dateDefaults: Record<string, unknown> = {}
    for (const field of formSchema) {
      if (field.type === 'date' && !initialData?.[field.id]) {
        dateDefaults[field.id] = defaultDateValueTDM()
      }
    }
    setValues({ ...dateDefaults, ...(initialData ?? {}) })
    setFieldErrors({})
    setFilesByField({})
    setUploadProgress({})

    getTaskContext(stepInstanceId)
      .then(({ context: ctx, error }) => {
        if (error || !ctx) {
          setContextError(error ?? 'Failed to load context.')
        } else {
          setContext(ctx)
        }
      })
      .catch(() => setContextError('Failed to load context.'))
      .finally(() => setContextLoading(false))
  }, [open, stepInstanceId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Field helpers ────────────────────────────────────────────────────────

  function setValue(fieldId: string, value: unknown) {
    setValues((prev) => ({ ...prev, [fieldId]: value }))
    if (fieldErrors[fieldId]) {
      setFieldErrors((prev) => {
        const next = { ...prev }
        delete next[fieldId]
        return next
      })
    }
  }

  function toggleCheckbox(fieldId: string, option: string, checked: boolean) {
    setValues((prev) => {
      const current = (prev[fieldId] as string[]) ?? []
      const next = checked ? [...current, option] : current.filter((v) => v !== option)
      return { ...prev, [fieldId]: next }
    })
    if (fieldErrors[fieldId]) {
      setFieldErrors((prev) => {
        const next = { ...prev }
        delete next[fieldId]
        return next
      })
    }
  }

  // ── Validation ───────────────────────────────────────────────────────────

  function validate(): boolean {
    const newErrors: Record<string, string> = {}
    for (const field of formSchema) {
      if (!field.required) continue
      const val = values[field.id]
      if (field.type === 'checkbox') {
        if (((val as string[]) ?? []).length === 0)
          newErrors[field.id] = 'Please select at least one option.'
      } else if (field.type === 'file') {
        const selectedFiles = filesByField[field.id] ?? []
        if (selectedFiles.length === 0) newErrors[field.id] = 'Please select at least one file.'
      } else {
        if (!String(val ?? '').trim()) newErrors[field.id] = 'This field is required.'
      }
    }
    setFieldErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // ── Save draft ───────────────────────────────────────────────────────────

  function handleSaveDraft() {
    startSaveDraft(async () => {
      try {
        const result = await saveDraftStep(stepInstanceId, values)
        if (result.error) toast.error(result.error)
        else toast.success('Draft saved.')
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
            const path = `${tenantId}/${instanceId}/${stepNodeId}/${fieldId}/${Date.now()}_${safeName}`
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
      <DialogContent className="flex max-h-[92vh] flex-col gap-0 p-0 sm:max-w-2xl">
        {/* ── Fixed header ── */}
        <DialogHeader className="shrink-0 border-b px-6 py-4">
          <DialogTitle className="flex items-center gap-2 text-base">
            {stepLabel}
            <Badge
              variant="secondary"
              className="border-blue-200 bg-blue-100 text-xs text-blue-800"
            >
              Pending
            </Badge>
          </DialogTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {flowName}
            {triggeredByName && (
              <>
                {' '}
                · Started by <span className="font-medium">{triggeredByName}</span>
              </>
            )}
          </p>
        </DialogHeader>

        {/* ── Tab bar ── */}
        <div className="shrink-0 flex border-b bg-muted/30">
          <TabButton
            active={activeTab === 'context'}
            onClick={() => setActiveTab('context')}
            icon={<ActivityIcon className="h-3.5 w-3.5" />}
            label="Context"
          />
          <TabButton
            active={activeTab === 'task'}
            onClick={() => setActiveTab('task')}
            icon={<ClipboardIcon className="h-3.5 w-3.5" />}
            label="Your Task"
          />
        </div>

        {/* ── Scrollable body ── */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {/* Context tab */}
          {activeTab === 'context' && (
            <div className="px-6 py-4">
              {contextLoading && (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                  Loading history…
                </div>
              )}

              {contextError && !contextLoading && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {contextError}
                </div>
              )}

              {context && !contextLoading && (
                <div className="space-y-6">
                  {/* Previous steps summary */}
                  {context.previousSteps.length > 0 && (
                    <section>
                      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Previous steps
                      </h3>
                      <div className="space-y-3">
                        {context.previousSteps.map((step) => (
                          <PreviousStepCard key={step.stepId} step={step} />
                        ))}
                      </div>
                    </section>
                  )}

                  {context.previousSteps.length === 0 && (
                    <div className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                      You are the first person to act on this flow.
                    </div>
                  )}

                  {/* Activity log */}
                  {context.timeline.length > 0 && (
                    <section>
                      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Activity log
                      </h3>
                      <ActivityTimeline
                        timeline={context.timeline}
                        // Pass graph nodes from context for field label resolution
                        // We don't have the graph here directly, but formData with
                        // labels was resolved server-side in previousSteps already.
                        // The timeline just shows descriptions + metadata.
                      />
                    </section>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Your Task tab */}
          {activeTab === 'task' && (
            <div className="px-6 py-4">
              <div className="space-y-5">
                {formSchema.length === 0 && (
                  <p className="text-sm text-muted-foreground">No fields defined for this step.</p>
                )}
                {formSchema.map((field) => (
                  <FieldRenderer
                    key={field.id}
                    field={field}
                    value={values[field.id]}
                    error={fieldErrors[field.id]}
                    disabled={isSubmitting || isSavingDraft}
                    onChange={(val) => setValue(field.id, val)}
                    onCheckboxChange={(option, checked) =>
                      toggleCheckbox(field.id, option, checked)
                    }
                    files={filesByField[field.id] ?? []}
                    uploadProgress={uploadProgress[field.id] ?? ''}
                    onFilesChange={(files) =>
                      setFilesByField((prev) => ({ ...prev, [field.id]: files }))
                    }
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Fixed footer ── */}
        <DialogFooter className="shrink-0 border-t px-6 py-3">
          {activeTab === 'context' ? (
            // Context tab footer — just a prompt to go to the task tab
            <div className="flex w-full items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Review the history above, then complete your step.
              </p>
              <Button size="sm" onClick={() => setActiveTab('task')}>
                Go to my task →
              </Button>
            </div>
          ) : (
            // Task tab footer — save draft + submit
            <div className="flex w-full items-center justify-between">
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
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── TabButton ────────────────────────────────────────────────────────────────

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 border-b-2 px-5 py-2.5 text-sm font-medium transition-colors ${
        active
          ? 'border-primary text-primary'
          : 'border-transparent text-muted-foreground hover:text-foreground'
      }`}
    >
      {icon}
      {label}
    </button>
  )
}

// ─── PreviousStepCard ─────────────────────────────────────────────────────────
// Shows one completed step with all submitted field values expanded by default.

function PreviousStepCard({ step }: { step: PreviousStepData }) {
  const [collapsed, setCollapsed] = useState(false)

  const visibleFields = step.fields.filter((f) => f.value !== '(empty)')

  return (
    <div className="rounded-lg border bg-card shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <CheckCircleIcon className="h-4 w-4 shrink-0 text-emerald-600" />
          <span className="font-medium text-sm">{step.stepLabel}</span>
          {step.assigneeName && (
            <span className="text-xs text-muted-foreground">
              by <span className="font-medium text-foreground">{step.assigneeName}</span>
            </span>
          )}
          {step.completedAt && (
            <span className="text-xs text-muted-foreground">· {formatExact(step.completedAt)}</span>
          )}
        </div>

        {visibleFields.length > 0 && (
          <button
            onClick={() => setCollapsed((v) => !v)}
            className="ml-2 shrink-0 text-xs text-muted-foreground hover:text-foreground"
          >
            {collapsed ? (
              <ChevronDownIcon className="h-4 w-4" />
            ) : (
              <ChevronUpIcon className="h-4 w-4" />
            )}
          </button>
        )}
      </div>

      {/* Field values — expanded by default */}
      {!collapsed && visibleFields.length > 0 && (
        <div className="border-t bg-muted/30 px-4 py-3">
          <dl className="space-y-2">
            {visibleFields.map((f) => (
              <div key={f.fieldId} className="flex gap-3 text-sm">
                <dt className="w-36 shrink-0 font-medium text-muted-foreground truncate">
                  {f.fieldLabel}
                </dt>
                <dd className="flex-1 break-words text-foreground">
                  {f.fieldType === 'file' ? (
                    <FilePaths value={f.value} />
                  ) : f.fieldType === 'textarea' ? (
                    <span className="whitespace-pre-wrap">{f.value}</span>
                  ) : (
                    f.value
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {!collapsed && visibleFields.length === 0 && (
        <div className="border-t px-4 py-2 text-xs text-muted-foreground italic">
          No values submitted.
        </div>
      )}
    </div>
  )
}

// ─── ActivityTimeline ─────────────────────────────────────────────────────────
// Compact version of the timeline — same data as on /my-flows/[id] but
// without the expandable form values panel (those are already shown above
// in PreviousStepCard, so we avoid duplicating).

function ActivityTimeline({ timeline }: { timeline: FlowEventLog[] }) {
  return (
    <ol className="relative border-l border-border">
      {timeline.map((event, idx) => {
        const config = EVENT_CONFIG[event.eventType] ?? EVENT_CONFIG.flow_triggered
        const isLast = idx === timeline.length - 1
        const branchPath =
          event.eventType === 'branch_evaluated'
            ? ((event.metadata.path as string | undefined) ?? null)
            : null

        return (
          <li key={event.id} className={`ml-4 ${isLast ? 'pb-0' : 'pb-4'}`}>
            {/* Timeline dot */}
            <span
              className={`absolute -left-[9px] flex h-4 w-4 items-center justify-center rounded-full border-2 border-background ${config.dotColor}`}
            />

            <div className="flex items-start gap-2">
              <span className={`mt-0.5 shrink-0 ${config.iconColor}`}>
                <config.Icon className="h-3.5 w-3.5" />
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-sm leading-snug text-foreground">{event.description}</p>

                {branchPath && (
                  <span
                    className={`mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                      branchPath.startsWith('yes')
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-rose-100 text-rose-700'
                    }`}
                  >
                    {branchPath.startsWith('yes') ? '✓ Yes path' : '✗ No path'}
                    {branchPath.includes('default') && ' (default)'}
                  </span>
                )}

                {event.eventType === 'flow_error' && (
                  <p className="mt-1 rounded bg-red-50 px-2 py-1 text-xs text-red-700">
                    {String(event.metadata.error ?? event.description)}
                  </p>
                )}
              </div>

              <time
                dateTime={event.createdAt}
                className="shrink-0 whitespace-nowrap text-xs text-muted-foreground"
                title={formatExact(event.createdAt)}
              >
                {formatExact(event.createdAt)}
              </time>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

// ─── Event config (same as instance-detail-client) ───────────────────────────

type EventConfig = {
  Icon: React.ComponentType<{ className?: string }>
  iconColor: string
  dotColor: string
}

const EVENT_CONFIG: Record<FlowEventLog['eventType'], EventConfig> = {
  flow_triggered: { Icon: RocketIcon, iconColor: 'text-blue-600', dotColor: 'bg-blue-500' },
  step_assigned: { Icon: UserIcon, iconColor: 'text-violet-600', dotColor: 'bg-violet-400' },
  step_draft_saved: { Icon: SaveIcon, iconColor: 'text-zinc-500', dotColor: 'bg-zinc-400' },
  step_submitted: {
    Icon: CheckCircleIcon,
    iconColor: 'text-emerald-600',
    dotColor: 'bg-emerald-500',
  },
  branch_evaluated: { Icon: GitBranchIcon, iconColor: 'text-amber-600', dotColor: 'bg-amber-400' },
  flow_completed: { Icon: FlagIcon, iconColor: 'text-emerald-700', dotColor: 'bg-emerald-600' },
  flow_error: { Icon: XCircleIcon, iconColor: 'text-red-600', dotColor: 'bg-red-500' },
  flow_cancelled: { Icon: BanIcon, iconColor: 'text-zinc-500', dotColor: 'bg-zinc-400' },
}

// ─── AutoTextarea ─────────────────────────────────────────────────────────────

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
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={`field-${field.id}`} className="text-sm font-medium">
        {field.label || <span className="italic text-muted-foreground">Unlabelled field</span>}
        {field.required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>

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
          {(field.options === undefined || field.options === null) && (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              This checkbox field has no options configured. Open the flow builder and re-publish.
            </p>
          )}
          {Array.isArray(field.options) &&
            field.options.filter((o) => o.trim() !== '').length === 0 && (
              <p className="text-xs text-muted-foreground">No options defined.</p>
            )}
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
            <p className="rounded-md border border-input bg-muted/40 px-3 py-2 text-sm text-foreground">
              {value ? (
                formatDateFieldDisplay(String(value))
              ) : (
                <span className="text-muted-foreground">(no date set)</span>
              )}
            </p>
          ) : (
            <input
              id={`field-${field.id}`}
              type="datetime-local"
              value={toDatetimeLocalStr(String(value ?? ''))}
              disabled={disabled}
              onChange={(e) => onChange(fromDatetimeLocalStr(e.target.value))}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
          )}
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

// ─── FilePaths ────────────────────────────────────────────────────────────────
// Parses a JSON-serialized array of storage paths (from getTaskContext/getMyCompletedTasks)
// and renders a FileDownloadLink for each one.

function FilePaths({ value }: { value: string }) {
  let paths: string[] = []
  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed)) paths = parsed as string[]
  } catch {
    // Fall back to plain text if not valid JSON
    return <span>{value}</span>
  }
  if (paths.length === 0) return <span className="text-muted-foreground">(no files)</span>
  return (
    <span className="flex flex-col gap-1">
      {paths.map((path) => (
        <FileDownloadLink key={path} storagePath={path} />
      ))}
    </span>
  )
}

// ─── Date helpers (date field type) ──────────────────────────────────────────

function defaultDateValueTDM(): string {
  const d = new Date()
  d.setHours(23, 59, 59, 0)
  return d.toISOString()
}

function toDatetimeLocalStr(iso: string): string {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  } catch {
    return ''
  }
}

function fromDatetimeLocalStr(localStr: string): string {
  if (!localStr) return ''
  try {
    const d = new Date(localStr)
    d.setSeconds(59, 0)
    return d.toISOString()
  } catch {
    return localStr
  }
}

function formatDateFieldDisplay(iso: string): string {
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

// ─── Date helper ──────────────────────────────────────────────────────────────

function formatExact(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  })
}
