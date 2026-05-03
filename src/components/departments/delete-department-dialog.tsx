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
import { deleteDepartment } from '@/app/(app)/departments/actions'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  department: { id: string; name: string }
  userCount: number
}

export function DeleteDepartmentDialog({ open, onOpenChange, department, userCount }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteDepartment(department.id)
      if (result?.error) {
        toast.error(result.error)
        return
      }
      toast.success('Department deleted.')
      router.refresh()
      onOpenChange(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete department</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete <strong>{department.name}</strong>? This cannot be
            undone.
          </DialogDescription>
        </DialogHeader>
        {userCount > 0 && (
          <p className="text-sm text-destructive">
            This department has {userCount} member{userCount > 1 ? 's' : ''}. Reassign them before
            deleting.
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isPending || userCount > 0}
          >
            {isPending ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
