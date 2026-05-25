'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Merge } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import { mergeDepartment } from '@/app/(app)/departments/actions'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  department: {
    id: string
    name: string
    userCount: number
    head_user_id: string | null
    head_name: string | null
  }
  allDepartments: { id: string; name: string; parent_id: string | null }[]
}

export function MergeDepartmentDialog({ open, onOpenChange, department, allDepartments }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [targetId, setTargetId] = useState('')
  const [deleteSource, setDeleteSource] = useState(false)

  const hasChildren = allDepartments.some((d) => d.parent_id === department.id)
  const targets = allDepartments.filter((d) => d.id !== department.id)

  const targetName = allDepartments.find((d) => d.id === targetId)?.name ?? ''

  function handleConfirm() {
    if (!targetId) return
    startTransition(async () => {
      const result = await mergeDepartment(department.id, targetId, deleteSource)
      if (result.error) {
        toast.error(result.error)
      } else {
        const moved = result.movedCount
        toast.success(
          `Merged ${moved} user${moved !== 1 ? 's' : ''} into ${targetName}.` +
            (deleteSource ? ` ${department.name} was deleted.` : '')
        )
        onOpenChange(false)
        setTargetId('')
        setDeleteSource(false)
        router.refresh()
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Merge className="h-4 w-4 text-muted-foreground" />
            Merge Department
          </DialogTitle>
          <DialogDescription>
            All {department.userCount} user{department.userCount !== 1 ? 's' : ''} in{' '}
            <span className="font-medium">{department.name}</span> will be moved to the target
            department.
            {department.head_user_id &&
              ' The department head will transfer if the target has none.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Target selector */}
          <div className="space-y-1.5">
            <Label>Merge into</Label>
            {targets.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No other departments available to merge into.
              </p>
            ) : (
              <Select value={targetId} onValueChange={setTargetId} disabled={isPending}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a department…" />
                </SelectTrigger>
                <SelectContent>
                  {targets.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Delete source checkbox */}
          <div className="flex items-start gap-2.5">
            <input
              id="delete-source"
              type="checkbox"
              checked={deleteSource}
              onChange={(e) => setDeleteSource(e.target.checked)}
              disabled={isPending}
              className="mt-0.5 h-4 w-4 rounded border-input accent-primary cursor-pointer"
            />
            <div>
              <label
                htmlFor="delete-source"
                className="text-sm font-medium leading-none cursor-pointer"
              >
                Delete <span className="font-semibold">{department.name}</span> after merge
              </label>
              {hasChildren && (
                <p className="text-xs text-amber-600 mt-1">
                  This department has sub-departments — deletion will be skipped even if checked.
                  Delete sub-departments first to remove it.
                </p>
              )}
            </div>
          </div>
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
            onClick={handleConfirm}
            disabled={!targetId || isPending || targets.length === 0}
          >
            {isPending ? 'Merging…' : 'Merge'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
