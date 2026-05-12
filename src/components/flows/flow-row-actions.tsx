// src/components/flows/flow-row-actions.tsx
'use client'

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
import { MoreHorizontal, Pencil, Globe, EyeOff, Trash2 } from 'lucide-react'
import { deleteFlow, unpublishFlow } from '@/lib/flows/actions'

interface FlowRowActionsProps {
  flowId: string
  flowName: string
  status: 'draft' | 'published'
}

export function FlowRowActions({ flowId, flowName, status }: FlowRowActionsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  function handleUnpublish() {
    startTransition(async () => {
      const result = await unpublishFlow(flowId)
      if (result?.error) {
        toast.error(result.error)
      } else {
        toast.success('Flow unpublished')
        router.refresh()
      }
    })
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteFlow(flowId)
      if (result?.error) {
        toast.error(result.error)
      } else {
        toast.success(`"${flowName}" deleted`)
        router.refresh()
      }
      setShowDeleteDialog(false)
    })
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">Open menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          {/* Edit */}
          <DropdownMenuItem onClick={() => router.push(`/flows/${flowId}/edit`)}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </DropdownMenuItem>

          {/* Unpublish — only shown when published */}
          {status === 'published' && (
            <DropdownMenuItem onClick={handleUnpublish} disabled={isPending}>
              <EyeOff className="mr-2 h-4 w-4" />
              Unpublish
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />

          {/* Delete */}
          <DropdownMenuItem
            onClick={() => setShowDeleteDialog(true)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Delete confirm dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &ldquo;{flowName}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the flow and all its versions. Running instances will be
              checked — deletion is blocked if any are still active.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
