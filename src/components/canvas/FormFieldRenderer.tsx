'use client'

// Shared form-field rendering used by both StepFormModal and FlowInitiationModal.
// Exports: FieldRenderer, FieldRendererProps, and date helpers.

import { useState, useEffect, useRef, useTransition } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SparklesIcon, Loader2Icon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FileDownloadLink, isFilePaths } from '@/components/canvas/FileDownloadLink'
import { assistTextarea } from '@/lib/ai/text-assist'
import type { FormField } from '@/store/canvas-store'

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

// ─── TextareaWithAI ───────────────────────────────────────────────────────────

function TextareaWithAI({
  id,
  value,
  onChange,
  disabled,
  className,
  fieldLabel,
  stepLabel,
  flowName,
}: {
  id: string
  value: string
  onChange: (val: unknown) => void
  disabled: boolean
  className?: string
  fieldLabel: string
  stepLabel: string
  flowName?: string
}) {
  const [aiOpen, setAiOpen] = useState(false)
  const [aiInstruction, setAiInstruction] = useState('')
  const [aiPreview, setAiPreview] = useState<string | null>(null)
  const [aiError, setAiError] = useState<string | null>(null)
  const [isGenerating, startGenerating] = useTransition()

  const hasContent = value.trim().length > 0
  const mode = hasContent ? 'rewrite' : 'generate'

  function handleClose() {
    setAiOpen(false)
    setAiInstruction('')
    setAiPreview(null)
    setAiError(null)
  }

  function handleGenerate() {
    if (!aiInstruction.trim()) return
    setAiError(null)
    setAiPreview(null)
    startGenerating(async () => {
      const result = await assistTextarea({
        fieldLabel,
        stepLabel,
        flowName,
        instruction: aiInstruction,
        currentText: hasContent ? value : undefined,
      })
      if (result.error) {
        setAiError(result.error)
      } else if (result.text) {
        setAiPreview(result.text)
      }
    })
  }

  function handleAccept() {
    if (aiPreview) {
      onChange(aiPreview)
      handleClose()
    }
  }

  return (
    <div className="space-y-1.5">
      <AutoTextarea
        id={id}
        value={value}
        onChange={(v) => onChange(v)}
        disabled={disabled}
        className={className}
      />
      {!disabled && (
        <div>
          {!aiOpen ? (
            <button
              type="button"
              onClick={() => setAiOpen(true)}
              className="inline-flex items-center gap-1 text-xs text-violet-600 hover:text-violet-800 dark:text-violet-400 dark:hover:text-violet-300"
            >
              <SparklesIcon className="h-3 w-3" />
              {mode === 'generate' ? 'Generate with AI' : 'Rewrite with AI'}
            </button>
          ) : (
            <div className="space-y-2 rounded-md border border-violet-200 bg-violet-50 px-3 py-2.5 dark:border-violet-800 dark:bg-violet-950/30">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={aiInstruction}
                  onChange={(e) => setAiInstruction(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleGenerate()
                  }}
                  placeholder={
                    mode === 'generate' ? 'Describe what to write…' : 'How should it be rewritten?'
                  }
                  className="flex-1 rounded-md border border-input bg-background px-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  disabled={isGenerating}
                  autoFocus={!aiPreview}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleGenerate}
                  disabled={isGenerating || !aiInstruction.trim()}
                  className="h-7 border-violet-300 text-xs text-violet-700 hover:bg-violet-100 dark:border-violet-700 dark:text-violet-300"
                >
                  {isGenerating ? (
                    <Loader2Icon className="h-3 w-3 animate-spin" />
                  ) : aiPreview ? (
                    'Regenerate'
                  ) : mode === 'generate' ? (
                    'Generate'
                  ) : (
                    'Rewrite'
                  )}
                </Button>
                <button
                  type="button"
                  onClick={handleClose}
                  className="text-xs text-muted-foreground hover:text-foreground"
                  disabled={isGenerating}
                >
                  Cancel
                </button>
              </div>

              {aiError && <p className="text-xs text-destructive">{aiError}</p>}

              {aiPreview && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-violet-700 dark:text-violet-400">
                    AI suggestion — review before applying:
                  </p>
                  <div className="whitespace-pre-wrap rounded-md border border-violet-200 bg-white px-3 py-2 text-sm leading-relaxed dark:border-violet-700 dark:bg-zinc-900">
                    {aiPreview}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleAccept}
                      className="h-7 bg-violet-600 text-xs text-white hover:bg-violet-700"
                    >
                      Use this
                    </Button>
                    <button
                      type="button"
                      onClick={handleClose}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Discard
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── FieldRenderer ────────────────────────────────────────────────────────────

export interface FieldRendererProps {
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
  stepLabel: string
  flowName?: string
}

export function FieldRenderer({
  field,
  value,
  error,
  disabled,
  onChange,
  onCheckboxChange,
  files,
  uploadProgress,
  onFilesChange,
  stepLabel,
  flowName,
}: FieldRendererProps) {
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
        <TextareaWithAI
          id={`field-${field.id}`}
          value={typeof value === 'string' ? value : ''}
          onChange={onChange}
          disabled={disabled}
          className={error ? 'border-destructive' : 'border-input'}
          fieldLabel={field.label || 'Text'}
          stepLabel={stepLabel}
          flowName={flowName}
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
          {(field.options === undefined || field.options === null) && (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              This checkbox field has no options configured. Open the flow builder, edit this field
              to add options, then re-publish the flow.
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
          {disabled && isFilePaths(value as unknown) && (
            <div className="space-y-1">
              {(value as unknown as string[]).map((path) => (
                <FileDownloadLink key={path} storagePath={path} />
              ))}
            </div>
          )}
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

      {field.type === 'date' && (
        <div className="space-y-1">
          {disabled ? (
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

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

// ─── Date helpers (exported for use in modal useEffect defaults) ──────────────

export function defaultDateValue(): string {
  const d = new Date()
  d.setHours(23, 59, 59, 0)
  return d.toISOString()
}

export function toDatetimeLocal(iso: string): string {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  } catch {
    return ''
  }
}

export function fromDatetimeLocal(localStr: string): string {
  if (!localStr) return ''
  try {
    const d = new Date(localStr)
    d.setSeconds(59, 0)
    return d.toISOString()
  } catch {
    return localStr
  }
}

export function formatDateDisplay(iso: string): string {
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
