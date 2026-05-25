'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Sparkles,
  Loader2,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  ArrowRight,
  RotateCcw,
} from 'lucide-react'
import {
  suggestFlowForRequest,
  type FlowSummary,
  type FlowSuggestion,
} from '@/lib/ai/trigger-assistant'
import { triggerFlow } from '@/lib/flows/actions'

interface Props {
  flows: FlowSummary[]
}

const CONFIDENCE_BADGE: Record<string, string> = {
  high: 'border-emerald-200 bg-emerald-100 text-emerald-700',
  medium: 'border-amber-200 bg-amber-100 text-amber-700',
  low: 'border-zinc-200 bg-zinc-100 text-zinc-600',
}

export function FlowTriggerAssistant({ flows }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [suggestion, setSuggestion] = useState<FlowSuggestion | null>(null)
  const [aiError, setAiError] = useState<string | null>(null)
  const [triggerError, setTriggerError] = useState<string | null>(null)
  const [isSuggesting, startSuggesting] = useTransition()
  const [isTriggering, startTriggering] = useTransition()

  if (flows.length === 0) return null

  function handleSuggest() {
    setAiError(null)
    setSuggestion(null)
    setTriggerError(null)
    startSuggesting(async () => {
      const result = await suggestFlowForRequest(text.trim(), flows)
      if (result.error || !result.suggestion) {
        setAiError(result.error ?? 'Unknown error')
      } else {
        setSuggestion(result.suggestion)
      }
    })
  }

  function handleTrigger(flowId: string) {
    setTriggerError(null)
    startTriggering(async () => {
      const result = await triggerFlow(flowId)
      if (result.error) {
        setTriggerError(result.error)
      } else {
        router.push('/tasks')
      }
    })
  }

  function handleReset() {
    setSuggestion(null)
    setAiError(null)
    setTriggerError(null)
    setText('')
  }

  const matchedFlow = suggestion?.flowId ? flows.find((f) => f.id === suggestion.flowId) : null

  return (
    <div className="mb-6 rounded-lg border border-violet-200 bg-violet-50/40">
      {/* ── Collapsed header ──────────────────────────────────────── */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-500" />
          <span className="text-sm font-medium text-violet-700">Start a flow with AI</span>
          <span className="hidden text-xs text-violet-400 sm:inline">— describe what you need</span>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-violet-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-violet-400" />
        )}
      </button>

      {/* ── Expanded body ─────────────────────────────────────────── */}
      {open && (
        <div className="space-y-4 border-t border-violet-200 px-4 py-4">
          {/* Input area — hidden once a suggestion is shown */}
          {!suggestion && (
            <div className="space-y-2">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && text.trim() && !isSuggesting)
                    handleSuggest()
                }}
                placeholder="e.g. I need to submit a leave request for next week, or I want to claim $300 travel expenses…"
                rows={3}
                className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
              />
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">⌘↵ / Ctrl↵ to submit</p>
                <button
                  onClick={handleSuggest}
                  disabled={!text.trim() || isSuggesting}
                  className="flex items-center gap-1.5 rounded-md bg-violet-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-violet-700 disabled:opacity-50"
                >
                  {isSuggesting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  {isSuggesting ? 'Thinking…' : 'Find a flow'}
                </button>
              </div>
            </div>
          )}

          {/* AI error */}
          {aiError && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
              <p className="text-xs text-destructive">{aiError}</p>
            </div>
          )}

          {/* Suggestion result */}
          {suggestion && (
            <div className="space-y-3">
              {/* Echo the user's request */}
              <p className="text-xs italic text-muted-foreground">&ldquo;{text}&rdquo;</p>

              {matchedFlow ? (
                <div className="space-y-2 rounded-md border border-border bg-background p-3">
                  {/* Flow name + confidence */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{matchedFlow.name}</p>
                      {matchedFlow.description && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {matchedFlow.description}
                        </p>
                      )}
                    </div>
                    <span
                      className={`shrink-0 rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${CONFIDENCE_BADGE[suggestion.confidence]}`}
                    >
                      {suggestion.confidence}
                    </span>
                  </div>

                  {/* Reasoning */}
                  <p className="text-xs text-muted-foreground">{suggestion.reasoning}</p>

                  {/* Inferred field values */}
                  {Object.keys(suggestion.prefillData).length > 0 && (
                    <div className="rounded-md bg-muted/40 px-3 py-2 space-y-1.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Inferred values
                      </p>
                      {Object.entries(suggestion.prefillData).map(([key, val]) => {
                        const field = matchedFlow.firstStepFields.find((f) => f.key === key)
                        return (
                          <div key={key} className="flex items-center gap-2 text-xs">
                            <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-500" />
                            <span className="text-muted-foreground">{field?.label ?? key}:</span>
                            <span className="font-medium text-foreground">{val}</span>
                          </div>
                        )
                      })}
                      <p className="pt-0.5 text-[10px] text-muted-foreground/60">
                        Enter these when the task form opens.
                      </p>
                    </div>
                  )}

                  {/* Trigger error */}
                  {triggerError && (
                    <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1.5">
                      <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-destructive" />
                      <p className="text-[11px] text-destructive">{triggerError}</p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-3 pt-1">
                    <button
                      onClick={() => handleTrigger(matchedFlow.id)}
                      disabled={isTriggering}
                      className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                    >
                      {isTriggering ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <ArrowRight className="h-3.5 w-3.5" />
                      )}
                      {isTriggering ? 'Starting…' : 'Start this flow'}
                    </button>
                    <button
                      onClick={handleReset}
                      className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Try again
                    </button>
                  </div>
                </div>
              ) : (
                /* No match */
                <div className="space-y-2 rounded-md border border-border bg-background p-3">
                  <div className="flex items-center gap-2">
                    <CircleDashed className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm font-medium text-foreground">No matching flow found</p>
                  </div>
                  <p className="text-xs text-muted-foreground">{suggestion.reasoning}</p>
                  <button
                    onClick={handleReset}
                    className="flex items-center gap-1 text-xs font-medium text-violet-600 transition-colors hover:text-violet-700"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Try a different description
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
