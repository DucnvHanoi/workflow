'use client'

// FILE PATH: src/components/flows/flows-client.tsx
// Handles search + category tab filtering entirely in client state.
// No DB round-trips on filter — all flows are loaded once on the server.

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FlowRowActions } from '@/components/flows/flow-row-actions'
import { ManageCategoriesDialog } from '@/components/flows/manage-categories-dialog'
import { PlusIcon, SearchIcon, XIcon } from 'lucide-react'
import type { FlowListItem } from '@/lib/flows/actions'
import type { FlowCategory } from '@/lib/flows/category-actions'

interface Props {
  initialFlows: FlowListItem[]
  categories: FlowCategory[]
  isAdmin: boolean
  // The server action passed from the server page — keeps 'use server' off a client file
  createFlowAction: () => Promise<void>
}

// ─── Sentinel value for the "All" tab ────────────────────────────────────────
const ALL_TAB = '__all__'
const UNCATEGORIZED_TAB = '__none__'

export function FlowsClient({
  initialFlows,
  categories: initialCategories,
  isAdmin,
  createFlowAction,
}: Props) {
  // ── Local state ──────────────────────────────────────────────────────────
  const [flows, setFlows] = useState<FlowListItem[]>(initialFlows)
  const [categories, setCategories] = useState<FlowCategory[]>(initialCategories)
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<string>(ALL_TAB)

  // ── Patch a single flow's category without full reload ───────────────────
  function handleCategoryUpdated(
    flowId: string,
    categoryId: string | null,
    categoryName: string | null,
    categoryColor: string | null
  ) {
    setFlows((prev) =>
      prev.map((f) => (f.id === flowId ? { ...f, categoryId, categoryName, categoryColor } : f))
    )
  }

  // ── Filtered flows (search + tab) ────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()

    return flows.filter((f) => {
      // Search filter: match name or category name
      if (
        q &&
        !f.name.toLowerCase().includes(q) &&
        !(f.categoryName ?? '').toLowerCase().includes(q)
      ) {
        return false
      }
      // Tab filter
      if (activeTab === ALL_TAB) return true
      if (activeTab === UNCATEGORIZED_TAB) return f.categoryId === null
      return f.categoryId === activeTab
    })
  }, [flows, search, activeTab])

  // ── Group by category for display ────────────────────────────────────────
  // When "All" tab is active we show a grouped layout.
  // When a specific category tab is active we show a flat table (already filtered).
  const groups = useMemo<{ label: string; color: string | null; items: FlowListItem[] }[]>(() => {
    if (activeTab !== ALL_TAB) {
      return [{ label: '', color: null, items: filtered }]
    }

    // Build ordered groups: categorised first (alpha by category name), then Uncategorized
    const catMap = new Map<string, FlowListItem[]>()
    const uncategorized: FlowListItem[] = []

    for (const flow of filtered) {
      if (flow.categoryId === null) {
        uncategorized.push(flow)
      } else {
        const key = flow.categoryId
        if (!catMap.has(key)) catMap.set(key, [])
        catMap.get(key)!.push(flow)
      }
    }

    const result: { label: string; color: string | null; items: FlowListItem[] }[] = []

    // Sort category groups alphabetically
    const sortedCatIds = Array.from(catMap.keys()).sort((a, b) => {
      const na = flows.find((f) => f.categoryId === a)?.categoryName ?? ''
      const nb = flows.find((f) => f.categoryId === b)?.categoryName ?? ''
      return na.localeCompare(nb)
    })

    for (const catId of sortedCatIds) {
      const items = catMap.get(catId)!
      result.push({
        label: items[0].categoryName ?? '',
        color: items[0].categoryColor ?? null,
        items,
      })
    }

    if (uncategorized.length > 0) {
      result.push({ label: 'Uncategorized', color: null, items: uncategorized })
    }

    return result
  }, [activeTab, filtered, flows])

  // ── Tab list ──────────────────────────────────────────────────────────────
  // Tabs = All + each category that has at least one flow + Uncategorized (if any)
  const tabs = useMemo(() => {
    const usedCatIds = new Set(flows.map((f) => f.categoryId).filter(Boolean))
    const hasUncategorized = flows.some((f) => f.categoryId === null)
    const catTabs = categories
      .filter((c) => usedCatIds.has(c.id))
      .map((c) => ({ id: c.id, label: c.name, color: c.color }))

    return [
      { id: ALL_TAB, label: 'All', color: null },
      ...catTabs,
      ...(hasUncategorized ? [{ id: UNCATEGORIZED_TAB, label: 'Uncategorized', color: null }] : []),
    ]
  }, [flows, categories])

  // ── Empty state ──────────────────────────────────────────────────────────
  if (flows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border bg-muted/20 py-20 text-center">
        <div className="mb-3 text-4xl">🔁</div>
        <h2 className="text-lg font-medium">No flows yet</h2>
        <p className="mb-4 mt-1 text-sm text-muted-foreground">
          Create your first workflow to get started.
        </p>
        {isAdmin && (
          <form action={createFlowAction}>
            <Button type="submit" size="sm">
              <PlusIcon className="mr-1.5 h-4 w-4" />
              New Flow
            </Button>
          </form>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* ── Toolbar: search + manage categories ── */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <SearchIcon className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search flows…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-8"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <XIcon className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Manage categories (admin only) */}
        {isAdmin && (
          <ManageCategoriesDialog categories={categories} onCategoriesChange={setCategories} />
        )}
      </div>

      {/* ── Category tabs ── */}
      {tabs.length > 1 && (
        <div className="flex flex-wrap gap-1.5 border-b pb-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex items-center gap-1.5 rounded-t-md border border-b-0 px-3 py-1.5 text-sm transition-colors ${
                activeTab === tab.id
                  ? 'border-border bg-background font-medium text-foreground'
                  : 'border-transparent bg-muted/40 text-muted-foreground hover:bg-muted/70 hover:text-foreground'
              }`}
            >
              {tab.color && (
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: tab.color }}
                />
              )}
              {tab.label}
              {/* Count badge */}
              <span
                className={`ml-0.5 text-xs tabular-nums ${activeTab === tab.id ? 'text-muted-foreground' : 'text-muted-foreground/70'}`}
              >
                {
                  flows.filter((f) => {
                    if (tab.id === ALL_TAB) return true
                    if (tab.id === UNCATEGORIZED_TAB) return f.categoryId === null
                    return f.categoryId === tab.id
                  }).length
                }
              </span>
            </button>
          ))}
        </div>
      )}

      {/* ── No search results ── */}
      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border bg-muted/20 py-16 text-center">
          <p className="text-sm text-muted-foreground">
            No flows match <span className="font-medium">&ldquo;{search}&rdquo;</span>
          </p>
          <button
            onClick={() => setSearch('')}
            className="mt-2 text-sm text-primary hover:underline"
          >
            Clear search
          </button>
        </div>
      )}

      {/* ── Flow groups / tables ── */}
      {filtered.length > 0 && (
        <div className="space-y-6">
          {groups.map((group, gi) => (
            <div key={gi}>
              {/* Group header (only shown in All tab) */}
              {activeTab === ALL_TAB && group.label && (
                <div className="mb-2 flex items-center gap-2">
                  {group.color && (
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: group.color }}
                    />
                  )}
                  <span className="text-sm font-semibold text-foreground">{group.label}</span>
                  <span className="text-xs text-muted-foreground">({group.items.length})</span>
                </div>
              )}
              {activeTab === ALL_TAB && !group.color && group.label === 'Uncategorized' && (
                <div className="mb-2 flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full border border-dashed border-muted-foreground/40" />
                  <span className="text-sm font-semibold text-muted-foreground">Uncategorized</span>
                  <span className="text-xs text-muted-foreground">({group.items.length})</span>
                </div>
              )}

              {/* Table */}
              <div className="overflow-hidden rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/50">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                        Name
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden sm:table-cell">
                        Version
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">
                        Last Published
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">
                        Updated
                      </th>
                      <th className="w-10 px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {group.items.map((flow) => (
                      <FlowTableRow
                        key={flow.id}
                        flow={flow}
                        isAdmin={isAdmin}
                        categories={categories}
                        onCategoryUpdated={handleCategoryUpdated}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Single table row ─────────────────────────────────────────────────────────
function FlowTableRow({
  flow,
  isAdmin,
  categories,
  onCategoryUpdated,
}: {
  flow: FlowListItem
  isAdmin: boolean
  categories: FlowCategory[]
  onCategoryUpdated: (
    flowId: string,
    categoryId: string | null,
    categoryName: string | null,
    categoryColor: string | null
  ) => void
}) {
  return (
    <tr className="transition-colors hover:bg-muted/30">
      {/* Name */}
      <td className="px-4 py-3 font-medium">
        <div className="flex items-center gap-2">
          {/* Category colour dot (subtle indicator inside the row) */}
          {flow.categoryColor && (
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: flow.categoryColor }}
              title={flow.categoryName ?? ''}
            />
          )}
          <Link href={`/flows/${flow.id}/edit`} className="text-foreground hover:underline">
            {flow.name}
          </Link>
        </div>
      </td>

      {/* Status */}
      <td className="px-4 py-3">
        <Badge
          variant={flow.status === 'published' ? 'default' : 'secondary'}
          className={
            flow.status === 'published'
              ? 'border-emerald-200 bg-emerald-100 text-emerald-800 hover:bg-emerald-100'
              : ''
          }
        >
          {flow.status === 'published' ? 'Published' : 'Draft'}
        </Badge>
      </td>

      {/* Version */}
      <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
        {flow.versionNumber != null ? `v${flow.versionNumber}` : '—'}
      </td>

      {/* Last Published */}
      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
        {flow.publishedAt ? formatDate(flow.publishedAt) : '—'}
      </td>

      {/* Updated */}
      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
        {formatRelative(flow.updatedAt)}
      </td>

      {/* Actions */}
      <td className="px-4 py-3">
        {isAdmin && (
          <FlowRowActions
            flowId={flow.id}
            flowName={flow.name}
            status={flow.status}
            currentCategoryId={flow.categoryId}
            categories={categories}
            onCategoryUpdated={onCategoryUpdated}
          />
        )}
      </td>
    </tr>
  )
}

// ─── Date helpers ─────────────────────────────────────────────────────────────
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return formatDate(iso)
}
