'use client'

import { useState, useTransition } from 'react'
import { Sparkles, Loader2, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { generateFlowFromDescription, modifyFlowFromDescription } from '@/lib/ai/flow-builder'
import type { SerializedGraph } from '@/lib/flows/graph'

type Mode = 'generate' | 'modify'

interface AiFlowGeneratorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  hasExistingNodes: boolean
  currentGraph: SerializedGraph
  onGraphGenerated: (graph: SerializedGraph) => void
}

export function AiFlowGeneratorDialog({
  open,
  onOpenChange,
  hasExistingNodes,
  currentGraph,
  onGraphGenerated,
}: AiFlowGeneratorDialogProps) {
  const [mode, setMode] = useState<Mode>('generate')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleClose(val: boolean) {
    if (isPending) return
    if (!val) {
      setDescription('')
      setError(null)
    }
    onOpenChange(val)
  }

  // Reset mode to 'generate' when dialog opens with no nodes
  function handleOpenChange(val: boolean) {
    if (val && !hasExistingNodes) setMode('generate')
    handleClose(val)
  }

  function handleGenerate() {
    setError(null)
    startTransition(async () => {
      const result =
        mode === 'modify'
          ? await modifyFlowFromDescription(description, currentGraph)
          : await generateFlowFromDescription(description)

      if (result.error || !result.graph) {
        setError(result.error ?? 'Unknown error')
        return
      }
      onGraphGenerated(result.graph)
      setDescription('')
      onOpenChange(false)
    })
  }

  const isModify = mode === 'modify'

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-600" />
            {isModify ? 'Modify flow with AI' : 'Generate flow with AI'}
          </DialogTitle>
          <DialogDescription>
            {isModify
              ? 'Describe what you want to change. Claude will apply the modification and return the updated flow.'
              : 'Describe your workflow in plain English. Claude will generate the steps, form fields, and connections as a starting draft.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          {/* Mode toggle — only shown when canvas has existing nodes */}
          {hasExistingNodes && (
            <div className="flex rounded-lg border border-border overflow-hidden text-xs font-medium">
              {(['modify', 'generate'] as Mode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  disabled={isPending}
                  className={`flex-1 py-2 transition-colors capitalize ${
                    mode === m ? 'bg-violet-600 text-white' : 'text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {m === 'modify' ? 'Modify existing' : 'Replace with new'}
                </button>
              ))}
            </div>
          )}

          {/* Warning when replacing existing canvas */}
          {!isModify && hasExistingNodes && (
            <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <p className="text-xs text-amber-700">
                This will replace your current canvas. Make sure you have saved or versioned
                anything you want to keep.
              </p>
            </div>
          )}

          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={
              isModify
                ? `e.g. "Add a Finance approval step after Manager approval, assigned to finance@company.com" or "Remove the second branch and connect directly to Complete"`
                : `e.g. "3-step expense approval: employee submits amount and receipt, manager approves or rejects, finance team does final confirmation"`
            }
            rows={5}
            disabled={isPending}
            className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          />

          <p className="text-right text-xs text-muted-foreground">{description.length} chars</p>

          {error && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <p className="text-xs text-destructive">{error}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={isPending || description.trim().length < 10}
            className="gap-2 bg-violet-600 hover:bg-violet-700 text-white"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {isModify ? 'Modifying…' : 'Generating…'}
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                {isModify ? 'Apply changes' : 'Generate'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
