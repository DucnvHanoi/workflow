'use client'

import { useState, useEffect, useTransition } from 'react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { editDepartment } from '@/app/(app)/departments/actions'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  department: { id: string; name: string; parent_id: string | null }
  allDepartments: { id: string; name: string; parent_id: string | null }[]
}

function getValidParents(
  all: { id: string; name: string; parent_id: string | null }[],
  departmentId: string
) {
  function descendants(id: string): Set<string> {
    const result = new Set<string>()
    function walk(currentId: string) {
      const children = all.filter((d) => d.parent_id === currentId)
      for (const c of children) {
        result.add(c.id)
        walk(c.id)
      }
    }
    walk(id)
    return result
  }

  const desc = descendants(departmentId)

  return all.filter((d) => {
    if (d.id === departmentId) return false
    if (desc.has(d.id)) return false
    if (!d.parent_id) return true
    const parent = all.find((p) => p.id === d.parent_id)
    if (!parent) return true
    if (!parent.parent_id) return true
    return false
  })
}

export function EditDepartmentDialog({ open, onOpenChange, department, allDepartments }: Props) {
  const router = useRouter()
  const [name, setName] = useState(department.name)
  const [parentId, setParentId] = useState<string | null>(department.parent_id)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    setName(department.name)
    setParentId(department.parent_id)
  }, [department])

  const validParents = getValidParents(allDepartments, department.id)

  const unchanged = name.trim() === department.name.trim() && parentId === department.parent_id

  function handleSave() {
    startTransition(async () => {
      const result = await editDepartment(department.id, name, parentId)
      if (result?.error) {
        toast.error(result.error)
        return
      }
      toast.success('Department updated.')
      router.refresh()
      onOpenChange(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Department</DialogTitle>
          <DialogDescription>
            Update <span className="font-medium">{department.name}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label htmlFor="edit-dept-name">Department Name</Label>
            <Input
              id="edit-dept-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isPending}
              autoFocus
            />
          </div>

          <div className="space-y-1">
            <Label>Parent Department</Label>
            <Select
              value={parentId ?? 'none'}
              onValueChange={(v) => setParentId(v === 'none' ? null : v)}
              disabled={isPending}
            >
              <SelectTrigger>
                <SelectValue placeholder="No parent (top level)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No parent (top level)</SelectItem>
                {validParents.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.parent_id ? `↳ ${d.name}` : d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isPending || !name.trim() || unchanged}>
            {isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
