'use client'

import { useState, useTransition } from 'react'
import { X, LayoutTemplate, Loader2 } from 'lucide-react'
import { createFlowFromTemplate } from '@/lib/flows/template-actions'
import type { PublishedTemplate } from '@/lib/flows/template-actions'

// ─── Category config ──────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  hr: 'HR',
  finance: 'Finance',
  it: 'IT',
  operations: 'Operations',
  other: 'Other',
}

const CATEGORY_COLORS: Record<string, string> = {
  hr: 'bg-blue-100 text-blue-700',
  finance: 'bg-green-100 text-green-700',
  it: 'bg-purple-100 text-purple-700',
  operations: 'bg-orange-100 text-orange-700',
  other: 'bg-gray-100 text-gray-600',
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface TemplateGalleryModalProps {
  open: boolean
  onClose: () => void
  templates: PublishedTemplate[]
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TemplateGalleryModal({ open, onClose, templates }: TemplateGalleryModalProps) {
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  if (!open) return null

  const categories = ['all', ...Array.from(new Set(templates.map((t) => t.category))).sort()]

  const filtered =
    activeCategory === 'all' ? templates : templates.filter((t) => t.category === activeCategory)

  function handleUse(templateId: string) {
    setPendingId(templateId)
    startTransition(async () => {
      await createFlowFromTemplate(templateId)
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Dialog */}
      <div className="relative z-10 flex flex-col bg-background rounded-xl shadow-xl w-full max-w-3xl max-h-[80vh] mx-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4 shrink-0">
          <div className="flex items-center gap-2">
            <LayoutTemplate className="h-4 w-4 text-indigo-500" />
            <h2 className="text-sm font-semibold text-foreground">Flow Templates</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Category tabs */}
        <div className="flex gap-1 border-b border-border px-6 py-2 shrink-0 overflow-x-auto">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`whitespace-nowrap rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                activeCategory === cat
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {cat === 'all' ? 'All' : (CATEGORY_LABELS[cat] ?? cat)}
            </button>
          ))}
        </div>

        {/* Template grid */}
        <div className="flex-1 overflow-y-auto p-6">
          {filtered.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-12">
              No templates in this category yet.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((t) => (
                <div
                  key={t.id}
                  className="flex flex-col rounded-lg border border-border bg-card p-4 hover:border-indigo-300 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="text-sm font-medium text-foreground leading-snug">{t.name}</p>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_COLORS[t.category] ?? 'bg-gray-100 text-gray-600'}`}
                    >
                      {CATEGORY_LABELS[t.category] ?? t.category}
                    </span>
                  </div>

                  {t.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                      {t.description}
                    </p>
                  )}

                  <button
                    onClick={() => handleUse(t.id)}
                    disabled={isPending}
                    className="mt-auto flex items-center justify-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-60 transition-colors"
                  >
                    {isPending && pendingId === t.id ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Creating…
                      </>
                    ) : (
                      'Use template'
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
