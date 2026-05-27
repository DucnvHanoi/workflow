'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Loader2, Pencil } from 'lucide-react'
import { updateTemplateMeta, toggleTemplatePublished } from '@/app/platform/templates/actions'

const CATEGORY_OPTIONS = [
  { value: 'hr', label: 'HR' },
  { value: 'finance', label: 'Finance' },
  { value: 'it', label: 'IT' },
  { value: 'operations', label: 'Operations' },
  { value: 'other', label: 'Other' },
]

interface Props {
  templateId: string
  initialName: string
  initialDescription: string
  initialCategory: string
  initialPublished: boolean
}

export function TemplateTopBar({
  templateId,
  initialName,
  initialDescription: _initialDescription,
  initialCategory,
  initialPublished,
}: Props) {
  const [name, setName] = useState(initialName)
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState(initialName)
  const [category, setCategory] = useState(initialCategory)
  const [isPublished, setIsPublished] = useState(initialPublished)
  const [isPending, startTransition] = useTransition()

  function commitName() {
    const trimmed = nameDraft.trim()
    if (!trimmed || trimmed === name) {
      setEditingName(false)
      setNameDraft(name)
      return
    }
    startTransition(async () => {
      const res = await updateTemplateMeta(templateId, { name: trimmed })
      if (res.error) {
        toast.error(res.error)
        setNameDraft(name)
      } else {
        setName(trimmed)
        toast.success('Template renamed')
      }
      setEditingName(false)
    })
  }

  function handleCategoryChange(val: string) {
    setCategory(val)
    startTransition(async () => {
      const res = await updateTemplateMeta(templateId, { category: val })
      if (res.error) toast.error(res.error)
    })
  }

  function handlePublishToggle() {
    const next = !isPublished
    setIsPublished(next)
    startTransition(async () => {
      const res = await toggleTemplatePublished(templateId, next)
      if (res.error) {
        toast.error(res.error)
        setIsPublished(!next)
      } else {
        toast.success(next ? 'Template published' : 'Template unpublished')
      }
    })
  }

  return (
    <div className="flex items-center gap-3 flex-1 min-w-0">
      {/* Inline name editor */}
      {editingName ? (
        <input
          autoFocus
          value={nameDraft}
          onChange={(e) => setNameDraft(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitName()
            if (e.key === 'Escape') {
              setEditingName(false)
              setNameDraft(name)
            }
          }}
          disabled={isPending}
          maxLength={100}
          className="h-7 w-56 rounded-md border border-input bg-background px-2 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
        />
      ) : (
        <button
          onClick={() => {
            setNameDraft(name)
            setEditingName(true)
          }}
          disabled={isPending}
          className="group flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-sm font-medium text-foreground hover:bg-muted transition-colors max-w-xs"
        >
          {isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />
          ) : (
            <Pencil className="h-3.5 w-3.5 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
          )}
          <span className="truncate">{name}</span>
        </button>
      )}

      {/* Category select */}
      <select
        value={category}
        onChange={(e) => handleCategoryChange(e.target.value)}
        disabled={isPending}
        className="h-7 rounded-md border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
      >
        {CATEGORY_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      {/* Publish toggle */}
      <button
        onClick={handlePublishToggle}
        disabled={isPending}
        className={`flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
          isPublished
            ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
        } disabled:opacity-50`}
      >
        {isPublished ? 'Published' : 'Draft — click to publish'}
      </button>
    </div>
  )
}
