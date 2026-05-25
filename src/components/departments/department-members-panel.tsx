'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { X, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { addMemberToDepartment, removeMemberFromDepartment } from '@/app/(app)/departments/actions'

interface DeptUser {
  id: string
  full_name: string | null
  email: string
  department_id: string | null
}

interface Props {
  department: { id: string; name: string }
  allUsers: DeptUser[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DepartmentMembersPanel({ department, allUsers, open, onOpenChange }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [selectedUserId, setSelectedUserId] = useState('')

  const members = allUsers.filter((u) => u.department_id === department.id)
  const available = allUsers.filter((u) => u.department_id !== department.id)

  const displayName = (u: DeptUser) => u.full_name ?? u.email

  function handleRemove(userId: string) {
    startTransition(async () => {
      const result = await removeMemberFromDepartment(userId, department.id)
      if (result.error) toast.error(result.error)
      else router.refresh()
    })
  }

  function handleAdd() {
    if (!selectedUserId) return
    startTransition(async () => {
      const result = await addMemberToDepartment(selectedUserId, department.id)
      if (result.error) {
        toast.error(result.error)
      } else {
        setSelectedUserId('')
        router.refresh()
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            {department.name}
          </DialogTitle>
          <DialogDescription>
            {members.length} member{members.length !== 1 ? 's' : ''} — add or remove users from this
            department.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current member list */}
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {members.length === 0 ? (
              <p className="rounded-md border border-dashed px-4 py-3 text-sm text-center text-muted-foreground">
                No members yet.
              </p>
            ) : (
              members.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center justify-between rounded-lg border px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{displayName(u)}</div>
                    {u.full_name && (
                      <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 ml-2 text-muted-foreground hover:text-destructive"
                    onClick={() => handleRemove(u.id)}
                    disabled={isPending}
                    title="Remove from department"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))
            )}
          </div>

          {/* Add member */}
          <div className="border-t pt-3 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Add member
            </p>
            {available.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                All users are already in this department.
              </p>
            ) : (
              <div className="flex gap-2">
                <Select
                  value={selectedUserId}
                  onValueChange={setSelectedUserId}
                  disabled={isPending}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select a user…" />
                  </SelectTrigger>
                  <SelectContent>
                    {available.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {displayName(u)}
                        {u.department_id && (
                          <span className="ml-1 text-xs text-muted-foreground">(moving dept)</span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" onClick={handleAdd} disabled={!selectedUserId || isPending}>
                  Add
                </Button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
