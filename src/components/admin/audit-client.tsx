'use client'

// FILE PATH: src/components/admin/audit-client.tsx
// Client component for the audit trail — filtering (action, actor, date range,
// search), client-side pagination, and a read-only table. Receives a fully
// loaded entry set from the server page; no extra fetches for filtering.

import { useState, useMemo, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Search, X, ChevronLeft, ChevronRight, SlidersHorizontal, ShieldCheck } from 'lucide-react'
import type { AuditAction, AuditEntry } from '@/app/(app)/admin/audit/page'

const PAGE_SIZE = 20

const ACTION_META: Record<AuditAction, { label: string; className: string }> = {
  role_changed: {
    label: 'Role changed',
    className: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  },
  flow_published: {
    label: 'Flow published',
    className: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  },
  flow_unpublished: {
    label: 'Flow unpublished',
    className: 'bg-slate-100 text-slate-600 border-slate-200',
  },
  step_reassigned: {
    label: 'Step reassigned',
    className: 'bg-amber-100 text-amber-700 border-amber-200',
  },
}

const ACTION_OPTIONS = [
  { value: 'all', label: 'All actions' },
  { value: 'role_changed', label: 'Role changed' },
  { value: 'flow_published', label: 'Flow published' },
  { value: 'flow_unpublished', label: 'Flow unpublished' },
  { value: 'step_reassigned', label: 'Step reassigned' },
]

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function ActionBadge({ action }: { action: AuditAction }) {
  const cfg = ACTION_META[action] ?? {
    label: action,
    className: 'bg-muted text-foreground border-border',
  }
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${cfg.className}`}
    >
      {cfg.label}
    </span>
  )
}

type Props = {
  entries: AuditEntry[]
  actors: { id: string; name: string }[]
  atLimit: boolean
  loadLimit: number
}

export function AuditClient({ entries, actors, atLimit, loadLimit }: Props) {
  const [search, setSearch] = useState('')
  const [action, setAction] = useState('all')
  const [actorId, setActorId] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    setPage(1)
  }, [search, action, actorId, dateFrom, dateTo])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return entries.filter((e) => {
      if (action !== 'all' && e.action !== action) return false
      if (actorId !== 'all' && e.actorId !== actorId) return false
      if (dateFrom && e.createdAt < dateFrom) return false
      if (dateTo && e.createdAt > dateTo + 'T23:59:59.999Z') return false
      if (q) {
        const haystack = `${e.description} ${e.targetLabel ?? ''} ${e.actorName}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [entries, search, action, actorId, dateFrom, dateTo])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const activeFilterCount = [
    action !== 'all' ? action : '',
    actorId !== 'all' ? actorId : '',
    dateFrom,
    dateTo,
  ].filter(Boolean).length

  const clearFilters = () => {
    setSearch('')
    setAction('all')
    setActorId('all')
    setDateFrom('')
    setDateTo('')
  }

  return (
    <div>
      {/* ── Filter bar ── */}
      <div className="mb-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search description, target, or actor…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <SlidersHorizontal className="h-4 w-4" />
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span className="rounded-full bg-primary px-1.5 py-0.5 text-xs font-medium text-primary-foreground">
                {activeFilterCount}
              </span>
            )}
          </div>
          {(activeFilterCount > 0 || search) && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 gap-1">
              <X className="h-3.5 w-3.5" />
              Clear
            </Button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={action} onValueChange={setAction}>
            <SelectTrigger className="h-8 w-[180px] text-xs">
              <SelectValue placeholder="All actions" />
            </SelectTrigger>
            <SelectContent>
              {ACTION_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={actorId} onValueChange={setActorId}>
            <SelectTrigger className="h-8 w-[180px] text-xs">
              <SelectValue placeholder="All actors" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actors</SelectItem>
              {actors.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">From</span>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-8 w-[140px] text-xs"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">To</span>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-8 w-[140px] text-xs"
            />
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          {filtered.length === entries.length
            ? `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}`
            : `${filtered.length} of ${entries.length} entries`}
          {atLimit && ` · showing the most recent ${loadLimit}`}
        </p>
      </div>

      {/* ── Table ── */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card px-6 py-16 text-center">
          <div className="rounded-full bg-muted p-3">
            <ShieldCheck className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="mt-3 text-sm font-medium text-foreground">No audit entries</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {entries.length === 0
              ? 'Administrative actions will appear here as they happen.'
              : 'Try adjusting your filters or search query.'}
          </p>
          {(activeFilterCount > 0 || search) && entries.length > 0 && (
            <Button variant="outline" size="sm" onClick={clearFilters} className="mt-3">
              Clear filters
            </Button>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">
                  When
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Action</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actor</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pageRows.map((e) => (
                <tr key={e.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {formatDateTime(e.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <ActionBadge action={e.action} />
                  </td>
                  <td className="px-4 py-3 text-foreground whitespace-nowrap">{e.actorName}</td>
                  <td className="px-4 py-3 text-foreground">{e.description}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border px-4 py-3">
              <p className="text-xs text-muted-foreground">
                Page {safePage} of {totalPages} &middot; {filtered.length} results
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 w-7 p-0"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 2)
                  .reduce<(number | 'ellipsis')[]>((acc, p, idx, arr) => {
                    if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('ellipsis')
                    acc.push(p)
                    return acc
                  }, [])
                  .map((item, idx) =>
                    item === 'ellipsis' ? (
                      <span key={`ellipsis-${idx}`} className="px-1 text-xs text-muted-foreground">
                        …
                      </span>
                    ) : (
                      <Button
                        key={item}
                        variant={item === safePage ? 'default' : 'outline'}
                        size="sm"
                        className="h-7 w-7 p-0 text-xs"
                        onClick={() => setPage(item as number)}
                      >
                        {item}
                      </Button>
                    )
                  )}

                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 w-7 p-0"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
