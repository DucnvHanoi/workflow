'use client'

// FILE PATH: src/components/flows/assign-category-dialog.tsx
// Dialog to assign (or clear) the category on a single flow.
// Opened from the row actions dropdown in the flows list.

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { CheckIcon } from 'lucide-react'
import { updateFlowCategory, type FlowCategory } from '@/lib/flows/category-actions'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  flowId: string
  flowName: string
  currentCategoryId: string | null
  categories: FlowCategory[] // _open is unused parameter
  // Called after a successful update so the parent can update UI without reload
  onUpdated: (
    _categoryId: string | null,
    _categoryName: string | null,
    _categoryColor: string | null
  ) => void
}

export function AssignCategoryDialog({
  open,
  onOpenChange,
  flowId,
  flowName,
  currentCategoryId,
  categories,
  onUpdated,
}: Props) {
  const [isPending, startTransition] = useTransition()
  const [selected, setSelected] = useState<string | null>(currentCategoryId)

  // Reset selected when dialog opens with a potentially different flow
  function handleOpenChange(isOpen: boolean) {
    if (isOpen) setSelected(currentCategoryId)
    onOpenChange(isOpen)
  }

  function handleSave() {
    startTransition(async () => {
      const result = await updateFlowCategory(flowId, selected)
      if (result.error) {
        toast.error(result.error)
        return
      }
      const cat = categories.find((c) => c.id === selected) ?? null
      toast.success(cat ? `Moved to "${cat.name}"` : 'Removed from category')
      onUpdated(cat?.id ?? null, cat?.name ?? null, cat?.color ?? null)
      onOpenChange(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Assign Category</DialogTitle>
          <p className="text-sm text-muted-foreground truncate">{flowName}</p>
        </DialogHeader>

        <div className="space-y-1">
          {/* Uncategorized option */}
          <button
            onClick={() => setSelected(null)}
            className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted/60 ${
              selected === null ? 'bg-muted font-medium' : ''
            }`}
          >
            <span className="h-3 w-3 rounded-full border-2 border-muted-foreground/40" />
            <span className="flex-1 text-left">Uncategorized</span>
            {selected === null && <CheckIcon className="h-4 w-4 text-primary" />}
          </button>

          {/* Category options */}
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelected(cat.id)}
              className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted/60 ${
                selected === cat.id ? 'bg-muted font-medium' : ''
              }`}
            >
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: cat.color }}
              />
              <span className="flex-1 text-left">{cat.name}</span>
              {selected === cat.id && <CheckIcon className="h-4 w-4 text-primary" />}
            </button>
          ))}

          {categories.length === 0 && (
            <p className="px-3 py-4 text-center text-sm text-muted-foreground">
              No categories yet. Ask an admin to create some.
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={isPending}>
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
