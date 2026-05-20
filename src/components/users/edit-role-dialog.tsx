'use client'

import { useState, useTransition } from 'react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { updateUserRole } from '@/app/(app)/users/actions'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: { id: string; full_name: string | null; email: string; role: string }
  currentUserId: string
}

export function EditRoleDialog({ open, onOpenChange, user, currentUserId }: Props) {
  // _open is unused parameter
  const router = useRouter()
  //const [role, setRole] = useState(user.role)
  const [role, setRole] = useState<'user' | 'admin'>(user.role as 'user' | 'admin')
  const [isPending, startTransition] = useTransition()
  const isSelf = user.id === currentUserId

  function handleSave() {
    startTransition(async () => {
      try {
        await updateUserRole(user.id, role)
        toast.success('Role updated. User has been signed out and must log back in.')
        router.refresh()
        onOpenChange(false)
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Failed to update role.')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit role</DialogTitle>
          <DialogDescription>
            Change the role for <strong>{user.full_name ?? user.email}</strong>.
          </DialogDescription>
        </DialogHeader>
        <div className="py-2">
          <Select
            value={role}
            onValueChange={(v) => setRole(v as 'user' | 'admin')}
            disabled={isSelf}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="user">User</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
          {isSelf && (
            <p className="text-xs text-muted-foreground mt-2">You cannot change your own role.</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isPending || isSelf || role === user.role}>
            {isPending ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
