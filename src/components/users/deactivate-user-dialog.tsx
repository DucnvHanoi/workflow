'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { deactivateUser, reactivateUser } from '@/app/(app)/users/actions'

type Props = {
  user: { id: string; full_name: string | null; email: string; is_active: boolean }
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DeactivateUserDialog({ user, open, onOpenChange }: Props) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const name = user.full_name ?? user.email
  const isDeactivating = user.is_active

  function handleConfirm() {
    startTransition(async () => {
      try {
        if (isDeactivating) {
          await deactivateUser(user.id)
          toast.success(`${name} has been deactivated and can no longer log in.`)
        } else {
          await reactivateUser(user.id)
          toast.success(`${name} has been reactivated.`)
        }
        onOpenChange(false)
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Something went wrong')
      }
    })
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isDeactivating ? 'Deactivate' : 'Reactivate'} {name}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isDeactivating
              ? `${name} will be immediately banned from logging in and their account will be marked inactive. Their completed history is preserved. You can reactivate them at any time.`
              : `${name} will be able to log in again and will appear in assignee dropdowns.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isPending}
            className={isDeactivating ? 'bg-destructive hover:bg-destructive/90' : undefined}
          >
            {isPending
              ? isDeactivating
                ? 'Deactivating…'
                : 'Reactivating…'
              : isDeactivating
                ? 'Deactivate'
                : 'Reactivate'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
