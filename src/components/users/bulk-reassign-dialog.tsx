'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { bulkReassignTasks } from '@/lib/flows/actions'

type Props = {
  fromUser: { id: string; full_name: string | null; email: string }
  pendingCount: number
  activeUsers: { id: string; full_name: string | null; email: string }[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function BulkReassignDialog({
  fromUser,
  pendingCount,
  activeUsers,
  open,
  onOpenChange,
}: Props) {
  const [toUserId, setToUserId] = useState<string>('')
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const fromName = fromUser.full_name ?? fromUser.email
  const candidates = activeUsers.filter((u) => u.id !== fromUser.id)

  function handleReassign() {
    if (!toUserId) return
    startTransition(async () => {
      const { count, error } = await bulkReassignTasks(fromUser.id, toUserId)
      if (error) {
        toast.error(error)
        return
      }
      toast.success(`${count} task${count !== 1 ? 's' : ''} reassigned successfully.`)
      onOpenChange(false)
      setToUserId('')
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reassign all pending tasks</DialogTitle>
          <DialogDescription>
            Move all {pendingCount} pending task{pendingCount !== 1 ? 's' : ''} from{' '}
            <span className="font-medium">{fromName}</span> to another active user.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <Label htmlFor="reassign-target">Reassign to</Label>
          <Select value={toUserId} onValueChange={setToUserId}>
            <SelectTrigger id="reassign-target">
              <SelectValue placeholder="Select a user…" />
            </SelectTrigger>
            <SelectContent>
              {candidates.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.full_name ?? u.email}
                  {u.full_name ? (
                    <span className="ml-1 text-muted-foreground text-xs">({u.email})</span>
                  ) : null}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleReassign} disabled={!toUserId || isPending}>
            {isPending
              ? 'Reassigning…'
              : `Reassign ${pendingCount} task${pendingCount !== 1 ? 's' : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
