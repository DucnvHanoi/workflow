'use client'

// FILE PATH: src/components/departments/set-department-head-dialog.tsx

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { UserCogIcon } from 'lucide-react'
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
import { Label } from '@/components/ui/label'
import { setDepartmentHead } from '@/app/(app)/departments/actions'

interface DeptUser {
  id: string
  full_name: string | null
  email: string
  department_id: string | null
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  department: {
    id: string
    name: string
    head_user_id: string | null
    head_name: string | null
  }
  /** All users in the tenant — filtered to dept members in this dialog */
  allUsers: DeptUser[]
}

export function SetDepartmentHeadDialog({ open, onOpenChange, department, allUsers }: Props) {
  // _open is unused parameter
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Initialise to current head (or empty = none)
  const [selectedUserId, setSelectedUserId] = useState<string>(
    department.head_user_id ?? '__none__'
  )

  // Re-sync when department changes (different row opened)
  useEffect(() => {
    setSelectedUserId(department.head_user_id ?? '__none__')
  }, [department.id, department.head_user_id])

  // Only show users assigned to this department
  const deptUsers = allUsers.filter((u) => u.department_id === department.id)

  function handleSave() {
    const userId = selectedUserId === '__none__' ? null : selectedUserId
    startTransition(async () => {
      const result = await setDepartmentHead(department.id, userId)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(userId ? 'Department head updated.' : 'Department head cleared.')
        router.refresh()
        onOpenChange(false)
      }
    })
  }

  const unchanged = selectedUserId === (department.head_user_id ?? '__none__')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCogIcon className="h-4 w-4 text-muted-foreground" />
            Set Department Head
          </DialogTitle>
          <DialogDescription>
            Choose the head of <span className="font-medium">{department.name}</span>. Only members
            of this department are listed. The selected user will be assigned first when this
            department&apos;s assignee rule is used in a flow.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {deptUsers.length === 0 ? (
            <p className="rounded-md border border-dashed px-4 py-3 text-sm text-muted-foreground">
              No users are assigned to this department yet. Assign users first via the{' '}
              <span className="font-medium">Users</span> page.
            </p>
          ) : (
            <div className="space-y-1.5">
              <Label>Department head</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId} disabled={isPending}>
                <SelectTrigger>
                  <SelectValue placeholder="— No head set —" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— No head set —</SelectItem>
                  {deptUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.full_name ?? u.email}
                      {u.full_name ? (
                        <span className="ml-1 text-xs text-muted-foreground">({u.email})</span>
                      ) : null}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Current head info */}
          {department.head_name && (
            <p className="text-xs text-muted-foreground">
              Current head:{' '}
              <span className="font-medium text-foreground">{department.head_name}</span>
            </p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isPending || unchanged || deptUsers.length === 0}
          >
            {isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
