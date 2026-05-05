'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
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
import { updateUserDepartment } from '@/app/(app)/users/actions'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  user:
    | { id: string; full_name: string | null; email: string; department_id: string | null }
    | undefined
  allDepartments: { id: string; name: string; parent_id: string | null }[]
}

export function EditDepartmentDialog({ open, onOpenChange, user, allDepartments }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [selectedDeptId, setSelectedDeptId] = useState<string>('__none__')

  // Sync when dialog opens
  useEffect(() => {
    if (open && user) {
      setSelectedDeptId(user.department_id ?? '__none__')
    }
  }, [open, user])

  if (!user) return null

  const isUnchanged = selectedDeptId === (user.department_id ?? '__none__')

  function handleSave() {
    if (!user) return
    const deptId = selectedDeptId === '__none__' ? null : selectedDeptId

    startTransition(async () => {
      try {
        await updateUserDepartment(user.id, deptId)
        toast.success('Department updated.')
        router.refresh()
        onOpenChange(false)
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Failed to update department.')
      }
    })
  }

  // Show parent > child label for nested departments
  function getDeptLabel(dept: { id: string; name: string; parent_id: string | null }) {
    if (!dept.parent_id) return dept.name
    const parent = allDepartments.find((d) => d.id === dept.parent_id)
    return parent ? `${parent.name} › ${dept.name}` : dept.name
  }

  // Sort: root depts first, then children alphabetically
  const sorted = [...allDepartments].sort((a, b) => {
    const labelA = getDeptLabel(a)
    const labelB = getDeptLabel(b)
    return labelA.localeCompare(labelB)
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!isPending) onOpenChange(o)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit department</DialogTitle>
        </DialogHeader>

        <div className="py-2 space-y-1.5">
          <Label>Department for {user.full_name ?? user.email}</Label>
          <Select value={selectedDeptId} onValueChange={setSelectedDeptId}>
            <SelectTrigger>
              <SelectValue placeholder="— No department —" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">— No department —</SelectItem>
              {sorted.map((dept) => (
                <SelectItem key={dept.id} value={dept.id}>
                  {getDeptLabel(dept)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isPending || isUnchanged}>
            {isPending ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
