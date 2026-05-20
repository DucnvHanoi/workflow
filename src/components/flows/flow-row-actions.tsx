'use client'

// FILE PATH: src/components/flows/flow-row-actions.tsx
// Row-level action dropdown for the flows list table.
// Handles: Edit, Delete, Unpublish, Assign Category.

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { MoreHorizontalIcon, PencilIcon, Trash2Icon, EyeOffIcon, TagIcon } from 'lucide-react'
import { deleteFlow, unpublishFlow } from '@/lib/flows/actions'
import { AssignCategoryDialog } from '@/components/flows/assign-category-dialog'
import type { FlowCategory } from '@/lib/flows/category-actions'

interface Props {
  flowId: string
  flowName: string
  status: 'draft' | 'published'
  currentCategoryId: string | null
  categories: FlowCategory[]
  // Called when category is updated so FlowsClient can patch its local state
  onCategoryUpdated: (
    _flowId: string,
    _categoryId: string | null,
    _categoryName: string | null,
    _categoryColor: string | null
  ) => void
}

export function FlowRowActions({
  flowId,
  flowName,
  status,
  currentCategoryId,
  categories,
  onCategoryUpdated,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [categoryOpen, setCategoryOpen] = useState(false)

  // ── Delete ────────────────────────────────────────────────────────────────
  function handleDelete() {
    startTransition(async () => {
      const result = await deleteFlow(flowId)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success(`"${flowName}" deleted`)
      router.refresh()
    })
  }

  // ── Unpublish ─────────────────────────────────────────────────────────────
  function handleUnpublish() {
    startTransition(async () => {
      const result = await unpublishFlow(flowId)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success(`"${flowName}" unpublished`)
      router.refresh()
    })
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" disabled={isPending}>
            <MoreHorizontalIcon className="h-4 w-4" />
            <span className="sr-only">Actions</span>
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-48">
          {/* Edit — navigate to canvas */}
          <DropdownMenuItem onClick={() => router.push(`/flows/${flowId}/edit`)}>
            <PencilIcon className="mr-2 h-3.5 w-3.5" />
            Edit flow
          </DropdownMenuItem>

          {/* Assign Category */}
          <DropdownMenuItem
            onClick={() => setCategoryOpen(true)}
            onSelect={(e) => e.preventDefault()} // keep menu from closing before dialog opens
          >
            <TagIcon className="mr-2 h-3.5 w-3.5" />
            Assign category
          </DropdownMenuItem>

          {/* Unpublish — only when published */}
          {status === 'published' && (
            <DropdownMenuItem onClick={handleUnpublish}>
              <EyeOffIcon className="mr-2 h-3.5 w-3.5" />
              Unpublish
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />

          {/* Delete */}
          <DropdownMenuItem
            onClick={() => setDeleteOpen(true)}
            onSelect={(e) => e.preventDefault()}
            className="text-destructive focus:text-destructive"
          >
            <Trash2Icon className="mr-2 h-3.5 w-3.5" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* ── Delete confirm ── */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &ldquo;{flowName}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              All versions and non-active instances will be permanently deleted. Flows with active
              (pending) instances cannot be deleted — cancel them first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Assign Category ── */}
      <AssignCategoryDialog
        open={categoryOpen}
        onOpenChange={setCategoryOpen}
        flowId={flowId}
        flowName={flowName}
        currentCategoryId={currentCategoryId}
        categories={categories}
        onUpdated={(catId, catName, catColor) =>
          onCategoryUpdated(flowId, catId, catName, catColor)
        }
      />
    </>
  )
}
