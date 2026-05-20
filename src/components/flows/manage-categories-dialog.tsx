'use client'

// FILE PATH: src/components/flows/manage-categories-dialog.tsx
// Admin-only dialog to create, rename, and delete flow categories.
// Opened from the flows list page header.

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { PencilIcon, Trash2Icon, PlusIcon, TagsIcon } from 'lucide-react'
import {
  createCategory,
  updateCategory,
  deleteCategory,
  type FlowCategory,
} from '@/lib/flows/category-actions'

// ─── Preset colours the admin can pick from ───────────────────────────────────
const COLOR_OPTIONS = [
  { label: 'Indigo', value: '#6366f1' },
  { label: 'Blue', value: '#3b82f6' },
  { label: 'Cyan', value: '#06b6d4' },
  { label: 'Green', value: '#22c55e' },
  { label: 'Emerald', value: '#10b981' },
  { label: 'Amber', value: '#f59e0b' },
  { label: 'Orange', value: '#f97316' },
  { label: 'Rose', value: '#f43f5e' },
  { label: 'Purple', value: '#a855f7' },
  { label: 'Slate', value: '#64748b' },
]

interface Props {
  categories: FlowCategory[]
  onCategoriesChange: (_categories: FlowCategory[]) => void
}

export function ManageCategoriesDialog({ categories, onCategoriesChange }: Props) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  // ── Create form state ──
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(COLOR_OPTIONS[0].value)

  // ── Edit state ──
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('')

  // ── Delete confirm ──
  const [deleteTarget, setDeleteTarget] = useState<FlowCategory | null>(null)

  // ── Create ────────────────────────────────────────────────────────────────
  function handleCreate() {
    if (!newName.trim()) return
    startTransition(async () => {
      const result = await createCategory(newName.trim(), newColor)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success(`Category "${result.category!.name}" created`)
      setNewName('')
      setNewColor(COLOR_OPTIONS[0].value)
      onCategoriesChange([...categories, result.category!])
    })
  }

  // ── Start editing ─────────────────────────────────────────────────────────
  function startEdit(cat: FlowCategory) {
    setEditingId(cat.id)
    setEditName(cat.name)
    setEditColor(cat.color)
  }

  // ── Save edit ─────────────────────────────────────────────────────────────
  function handleSaveEdit(cat: FlowCategory) {
    if (!editName.trim()) return
    startTransition(async () => {
      const result = await updateCategory(cat.id, editName.trim(), editColor)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Category updated')
      setEditingId(null)
      onCategoriesChange(
        categories.map((c) =>
          c.id === cat.id ? { ...c, name: editName.trim(), color: editColor } : c
        )
      )
    })
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  function handleDelete() {
    if (!deleteTarget) return
    startTransition(async () => {
      const result = await deleteCategory(deleteTarget.id)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success(`Category "${deleteTarget.name}" deleted`)
      setDeleteTarget(null)
      onCategoriesChange(categories.filter((c) => c.id !== deleteTarget.id))
    })
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <TagsIcon className="mr-1.5 h-4 w-4" />
            Manage Categories
          </Button>
        </DialogTrigger>

        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Categories</DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            {/* ── Existing categories ── */}
            {categories.length === 0 ? (
              <p className="text-sm text-muted-foreground">No categories yet. Create one below.</p>
            ) : (
              <ul className="space-y-2">
                {categories.map((cat) =>
                  editingId === cat.id ? (
                    /* ── Inline edit row ── */
                    <li key={cat.id} className="space-y-2 rounded-md border p-3">
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        maxLength={60}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveEdit(cat)
                          if (e.key === 'Escape') setEditingId(null)
                        }}
                      />
                      <ColorPicker value={editColor} onChange={setEditColor} />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleSaveEdit(cat)}
                          disabled={isPending || !editName.trim()}
                        >
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingId(null)}
                          disabled={isPending}
                        >
                          Cancel
                        </Button>
                      </div>
                    </li>
                  ) : (
                    /* ── Display row ── */
                    <li
                      key={cat.id}
                      className="flex items-center gap-3 rounded-md border px-3 py-2"
                    >
                      <span
                        className="h-3 w-3 shrink-0 rounded-full"
                        style={{ backgroundColor: cat.color }}
                      />
                      <span className="flex-1 truncate text-sm font-medium">{cat.name}</span>
                      <button
                        onClick={() => startEdit(cat)}
                        className="text-muted-foreground hover:text-foreground"
                        title="Rename"
                        disabled={isPending}
                      >
                        <PencilIcon className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(cat)}
                        className="text-muted-foreground hover:text-destructive"
                        title="Delete"
                        disabled={isPending}
                      >
                        <Trash2Icon className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  )
                )}
              </ul>
            )}

            {/* ── Create new ── */}
            <div className="space-y-2 border-t pt-4">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                New category
              </Label>
              <Input
                placeholder="e.g. Human Resources"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                maxLength={60}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreate()
                }}
              />
              <ColorPicker value={newColor} onChange={setNewColor} />
              <Button
                size="sm"
                onClick={handleCreate}
                disabled={isPending || !newName.trim()}
                className="w-full"
              >
                <PlusIcon className="mr-1.5 h-4 w-4" />
                Add Category
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirm ── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &ldquo;{deleteTarget?.name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              Flows in this category will become Uncategorized. This cannot be undone.
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
    </>
  )
}

// ─── Colour picker swatch grid ────────────────────────────────────────────────
function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {COLOR_OPTIONS.map(
        (
          opt // _c is unused parameter
        ) => (
          <button
            key={opt.value}
            type="button"
            title={opt.label}
            onClick={() => onChange(opt.value)}
            className="h-6 w-6 rounded-full ring-offset-background transition-all focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            style={{
              backgroundColor: opt.value,
              outline: value === opt.value ? `2px solid ${opt.value}` : undefined,
              outlineOffset: value === opt.value ? '2px' : undefined,
            }}
          />
        )
      )}
    </div>
  )
}
