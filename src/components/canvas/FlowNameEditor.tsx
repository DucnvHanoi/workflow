'use client'

// FILE PATH: src/components/canvas/FlowNameEditor.tsx
// Inline-editable flow name in the canvas top bar.
// Click name → becomes input → Enter or blur → saves → back to text.
// Escape → cancels without saving.
// Shows a subtle pencil icon on hover so the affordance is visible.

import { useState, useRef, useTransition, useCallback } from 'react'
import { toast } from 'sonner'
import { Pencil, Loader2 } from 'lucide-react'
import { updateFlowName } from '@/lib/flows/actions'

interface FlowNameEditorProps {
  flowId: string
  initialName: string
}

export function FlowNameEditor({ flowId, initialName }: FlowNameEditorProps) {
  const [name, setName] = useState(initialName)
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState(initialName)
  const [isPending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  // ── Enter edit mode ───────────────────────────────────────────────────────
  function startEditing() {
    setDraft(name)
    setIsEditing(true)
    // Focus the input after React renders it
    setTimeout(() => inputRef.current?.select(), 0)
  }

  // ── Commit save ───────────────────────────────────────────────────────────
  const commitSave = useCallback(() => {
    const trimmed = draft.trim()

    // Nothing changed or empty — revert
    if (!trimmed || trimmed === name) {
      setIsEditing(false)
      setDraft(name)
      return
    }

    startTransition(async () => {
      const result = await updateFlowName(flowId, trimmed)
      if (result.error) {
        toast.error(result.error)
        // Revert draft back to last saved name
        setDraft(name)
      } else {
        setName(trimmed)
        toast.success('Flow renamed')
      }
      setIsEditing(false)
    })
  }, [draft, name, flowId])

  // ── Cancel ────────────────────────────────────────────────────────────────
  function cancelEdit() {
    setIsEditing(false)
    setDraft(name)
  }

  // ── Keyboard handling ─────────────────────────────────────────────────────
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      commitSave()
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      cancelEdit()
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commitSave}
        onKeyDown={handleKeyDown}
        disabled={isPending}
        maxLength={100}
        className="
          h-7 rounded-md border border-input bg-background
          px-2 py-0 text-sm font-medium text-foreground
          focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1
          disabled:opacity-50
          w-56 min-w-0
        "
        autoComplete="off"
        spellCheck={false}
      />
    )
  }

  return (
    <button
      onClick={startEditing}
      disabled={isPending}
      title="Click to rename"
      className="
        group flex items-center gap-1.5
        rounded-md px-1.5 py-0.5
        text-sm font-medium text-foreground
        hover:bg-muted transition-colors
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
        disabled:opacity-50 disabled:cursor-not-allowed
        max-w-xs
      "
    >
      {isPending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0 text-muted-foreground" />
      ) : (
        <Pencil
          className="
            h-3.5 w-3.5 shrink-0 text-muted-foreground
            opacity-0 group-hover:opacity-100 transition-opacity
          "
        />
      )}
      <span className="truncate">{name}</span>
    </button>
  )
}
