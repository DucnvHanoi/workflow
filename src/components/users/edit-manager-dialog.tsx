'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { updateUserManager } from '@/app/(app)/users/actions'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  user:
    | { id: string; full_name: string | null; email: string; manager_id: string | null }
    | undefined
  allUsers: { id: string; full_name: string | null; email: string }[]
}

export function EditManagerDialog({ open, onOpenChange, user, allUsers }: Props) {
  const router = useRouter()
  const [selectedManagerId, setSelectedManagerId] = useState<string>('__none__')
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (open && user) {
      setSelectedManagerId(user.manager_id ?? '__none__')
    }
  }, [open, user])

  function handleCancel() {
    if (!isPending) onOpenChange(false)
  }

  function handleSave() {
    if (!user) return
    const managerId = selectedManagerId === '__none__' ? null : selectedManagerId

    startTransition(async () => {
      try {
        await updateUserManager(user.id, managerId)
        toast.success('Manager updated.')
        router.refresh()
        onOpenChange(false)
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Failed to update manager.')
      }
    })
  }

  const otherUsers = user ? allUsers.filter((u) => u.id !== user.id) : allUsers

  // Don't render dialog content if no user selected yet
  if (!user) return null

  return (
    <Dialog open={open} onOpenChange={handleCancel}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit manager</DialogTitle>
        </DialogHeader>
        <div className="py-2 space-y-1.5">
          <Label>Manager for {user.full_name ?? user.email}</Label>
          <Select value={selectedManagerId} onValueChange={setSelectedManagerId}>
            <SelectTrigger>
              <SelectValue placeholder="— No manager —" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">— No manager —</SelectItem>
              {otherUsers.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.full_name ?? u.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
