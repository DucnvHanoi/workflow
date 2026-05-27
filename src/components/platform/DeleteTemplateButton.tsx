'use client'

import { useTransition } from 'react'
import { deleteTemplate } from '@/app/platform/templates/actions'

interface Props {
  templateId: string
  templateName: string
}

export function DeleteTemplateButton({ templateId, templateName }: Props) {
  const [isPending, startTransition] = useTransition()

  function handleClick() {
    if (!confirm(`Delete "${templateName}"? This cannot be undone.`)) return
    startTransition(async () => {
      await deleteTemplate(templateId)
    })
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className="rounded-md px-2 py-1 text-xs text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
    >
      {isPending ? 'Deleting…' : 'Delete'}
    </button>
  )
}
