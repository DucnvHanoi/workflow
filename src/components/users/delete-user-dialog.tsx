'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { deleteUser } from '@/app/(app)/users/actions'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: { id: string; full_name: string | null; email: string }
  currentUserId: string
}

export function DeleteUserDialog({ open, onOpenChange, user, currentUserId }: Props) {
  // _open is unused parameter
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const isSelf = user.id === currentUserId

  function handleDelete() {
    startTransition(async () => {
      try {
        await deleteUser(user.id)
        toast.success('User deleted.')
        router.refresh()
        onOpenChange(false)
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Failed to delete user.')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete user</DialogTitle>
          <DialogDescription>
            Are you sure you want to permanently delete{' '}
            <strong>{user.full_name ?? user.email}</strong>? This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={isPending || isSelf}>
            {isPending ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
