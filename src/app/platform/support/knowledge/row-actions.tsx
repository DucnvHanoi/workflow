'use client'

import { useTransition } from 'react'
import { toggleActive, deleteArticle } from './actions'

interface Props {
  id: string
  isActive: boolean
}

export function RowActions({ id, isActive }: Props) {
  const [isPending, startTransition] = useTransition()

  function handleToggle() {
    startTransition(() => toggleActive(id, !isActive))
  }

  function handleDelete() {
    if (!confirm('Delete this article permanently? This cannot be undone.')) return
    startTransition(() => deleteArticle(id))
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleToggle}
        disabled={isPending}
        className={`text-xs px-2.5 py-1 rounded-full font-semibold transition-colors disabled:opacity-50 ${
          isActive
            ? 'bg-green-100 text-green-700 hover:bg-green-200'
            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
        }`}
      >
        {isActive ? 'Active' : 'Inactive'}
      </button>
      <button
        onClick={handleDelete}
        disabled={isPending}
        className="text-xs text-red-500 hover:text-red-700 transition-colors disabled:opacity-50"
      >
        Delete
      </button>
    </div>
  )
}
