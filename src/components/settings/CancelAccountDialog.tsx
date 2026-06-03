'use client'

import { useState, useTransition } from 'react'
import { Trash2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { initiateAccountCancellation } from '@/lib/settings/cancellation-actions'

interface Props {
  orgName: string
}

export function CancelAccountDialog({ orgName }: Props) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleConfirm() {
    startTransition(async () => {
      const { error } = await initiateAccountCancellation()
      if (error) {
        toast.error(error)
      } else {
        toast.success(
          'Cancellation scheduled. Check your email for your data export and reversal instructions.'
        )
        setOpen(false)
      }
    })
  }

  return (
    <>
      <Button variant="destructive" size="sm" onClick={() => setOpen(true)} className="mt-3">
        <Trash2 className="h-4 w-4 mr-1.5" />
        Cancel account
      </Button>

      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!isPending) setOpen(v)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel your account</DialogTitle>
            <DialogDescription>
              This will schedule <strong>{orgName}</strong> for permanent deletion.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 space-y-2">
              <p className="text-sm font-semibold text-destructive">
                After the 7-day cooling-off period, we will permanently delete:
              </p>
              <ul className="text-sm text-destructive space-y-1 pl-2">
                {[
                  'All users and their login credentials',
                  'All workflows, instances, and form data',
                  'All departments and organisational structure',
                  'All attached files and exports',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-1.5">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-destructive shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <p className="text-sm text-muted-foreground">
              We will email you a full data export (users, flows, departments as CSV) immediately.
              You can reverse this decision from Settings within 7 days.
            </p>
          </div>

          <div className="flex justify-between gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
              Keep my account
            </Button>
            <Button variant="destructive" onClick={handleConfirm} disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Yes, cancel my account
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
