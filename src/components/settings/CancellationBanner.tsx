'use client'

import { useState, useTransition } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { undoCancellation } from '@/lib/settings/cancellation-actions'

interface Props {
  cancelAt: string // ISO string
}

export function CancellationBanner({ cancelAt }: Props) {
  const [isPending, startTransition] = useTransition()
  const [undone, setUndone] = useState(false)

  const deletionDate = new Date(cancelAt).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const daysLeft = Math.max(0, Math.ceil((new Date(cancelAt).getTime() - Date.now()) / 86_400_000))

  if (undone) return null

  function handleUndo() {
    startTransition(async () => {
      const { error } = await undoCancellation()
      if (error) {
        toast.error(error)
      } else {
        toast.success('Cancellation reversed. Your account is active again.')
        setUndone(true)
      }
    })
  }

  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-4 flex items-start gap-3">
      <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
          Account scheduled for deletion
        </p>
        <p className="text-sm text-amber-700 dark:text-amber-300 mt-0.5">
          Your workspace and all data will be permanently deleted on <strong>{deletionDate}</strong>
          {daysLeft > 0 && ` (${daysLeft} day${daysLeft === 1 ? '' : 's'} remaining)`}. This cannot
          be undone after that date.
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        disabled={isPending}
        onClick={handleUndo}
        className="shrink-0 border-amber-300 text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-200 dark:hover:bg-amber-900/30"
      >
        {isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
        Undo cancellation
      </Button>
    </div>
  )
}
