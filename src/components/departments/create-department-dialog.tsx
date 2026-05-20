'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { createDepartment } from '@/app/(app)/departments/actions'

interface Props {
  open: boolean
  onOpenChange: (_open: boolean) => void
  allDepartments: { id: string; name: string; parent_id: string | null }[]
}

function getValidParents(all: { id: string; name: string; parent_id: string | null }[]) {
  return all.filter((d) => {
    if (!d.parent_id) return true // depth 1 — can have children
    const parent = all.find((p) => p.id === d.parent_id)
    if (!parent) return true
    if (!parent.parent_id) return true // depth 2 — can have children
    return false // depth 3 — cannot be a parent
  })
}

export function CreateDepartmentDialog({ open, onOpenChange, allDepartments }: Props) {
  const router = useRouter() // _open is unused parameter
  const [name, setName] = useState('')
  const [parentId, setParentId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleClose() {
    setName('')
    setParentId(null)
    onOpenChange(false)
  }

  function handleSubmit() {
    if (!name.trim()) return

    startTransition(async () => {
      const result = await createDepartment(name, parentId)
      if (result?.error) {
        toast.error(result.error)
        return
      }
      toast.success('Department created.')
      router.refresh()
      handleClose()
    })
  }

  const validParents = getValidParents(allDepartments)

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create department</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="dept-name">Name</Label>
            <Input
              id="dept-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              placeholder="e.g. Engineering"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label>Parent department (optional)</Label>
            <Select
              value={parentId ?? '__none__'}
              onValueChange={(v) => setParentId(v === '__none__' ? null : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="— Top level —" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Top level —</SelectItem>
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
          <Button variant="outline" onClick={handleClose} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending || !name.trim()}>
            {isPending ? 'Creating...' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
