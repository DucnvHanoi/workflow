'use client'

// FIX: removed flowName prop — page.tsx (server component) renders the flow
// name directly in the top bar. CanvasToolbar's only job is the save indicator.
// Having flowName here caused it to render twice side-by-side.

import { useCanvasStore } from '@/store/canvas-store'
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react'

export function CanvasToolbar() {
  const saveStatus = useCanvasStore((s) => s.saveStatus)

  return (
    <div className="flex items-center gap-2 text-sm">
      {saveStatus === 'saving' && (
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Saving…
        </span>
      )}
      {saveStatus === 'saved' && (
        <span className="flex items-center gap-1.5 text-emerald-600">
          <CheckCircle className="h-3.5 w-3.5" />
          Saved
        </span>
      )}
      {saveStatus === 'error' && (
        <span className="flex items-center gap-1.5 text-destructive">
          <AlertCircle className="h-3.5 w-3.5" />
          Save failed
        </span>
      )}
      {saveStatus === 'idle' && (
        <span className="text-muted-foreground/50 text-xs">No changes</span>
      )}
    </div>
  )
}
