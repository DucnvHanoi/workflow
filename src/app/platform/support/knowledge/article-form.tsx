'use client'

import { useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { marked } from 'marked'
import { slugify } from './utils'

const CATEGORIES = ['general', 'billing', 'account', 'how-to', 'technical'] as const

interface Props {
  mode: 'create' | 'edit'
  defaultValues?: {
    id: string
    title: string
    slug: string
    category: string
    content_markdown: string
  }
  action: (formData: FormData) => Promise<void>
}

export function ArticleForm({ mode, defaultValues, action }: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState(false)
  const [previewHtml, setPreviewHtml] = useState('')
  const [slugValue, setSlugValue] = useState(defaultValues?.slug ?? '')
  const [slugTouched, setSlugTouched] = useState(mode === 'edit')
  // Track markdown content in state so it persists across preview toggle
  const [markdownValue, setMarkdownValue] = useState(defaultValues?.content_markdown ?? '')

  function handleTitleChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!slugTouched) setSlugValue(slugify(e.target.value))
  }

  function handleSlugChange(e: React.ChangeEvent<HTMLInputElement>) {
    setSlugTouched(true)
    setSlugValue(slugify(e.target.value))
  }

  function togglePreview() {
    if (!preview) {
      setPreviewHtml(marked(markdownValue, { gfm: true, breaks: true }) as string)
    }
    setPreview((p) => !p)
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      try {
        await action(fd)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Title */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Title</label>
        <input
          name="title"
          type="text"
          required
          defaultValue={defaultValues?.title}
          onChange={handleTitleChange}
          placeholder="e.g. How to create a workflow"
          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* Slug + Category row */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Slug</label>
          <input
            name="slug"
            type="text"
            required
            value={slugValue}
            onChange={handleSlugChange}
            placeholder="e.g. how-to-create-workflow"
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 font-mono placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <p className="text-xs text-slate-400">URL: /help/{slugValue || '…'}</p>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Category</label>
          <select
            name="category"
            defaultValue={defaultValues?.category ?? 'general'}
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Content — always in DOM as hidden input so FormData always has it */}
      <input type="hidden" name="content_markdown" value={markdownValue} />

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Content (Markdown)
          </label>
          <button
            type="button"
            onClick={togglePreview}
            className="text-xs text-indigo-600 hover:text-indigo-700 font-medium transition-colors"
          >
            {preview ? 'Edit' : 'Preview'}
          </button>
        </div>

        {preview ? (
          <div
            className="min-h-[400px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 overflow-auto
              prose prose-slate prose-sm max-w-none
              prose-headings:font-semibold prose-headings:text-slate-800
              prose-p:text-slate-600 prose-li:text-slate-600
              prose-strong:text-slate-800 prose-code:bg-slate-100 prose-code:text-slate-800
              prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-xs"
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        ) : (
          <textarea
            rows={20}
            value={markdownValue}
            onChange={(e) => setMarkdownValue(e.target.value)}
            placeholder="Write your article content in Markdown..."
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 font-mono placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
          />
        )}
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
        <Link
          href="/platform/support/knowledge"
          className="text-sm text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={isPending}
          className="px-5 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50"
        >
          {isPending ? 'Saving…' : mode === 'create' ? 'Create Article' : 'Save Changes'}
        </button>
      </div>
    </form>
  )
}
