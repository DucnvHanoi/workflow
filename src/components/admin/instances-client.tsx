'use client'

// FILE PATH: src/components/admin/instances-client.tsx
// Client component — handles all filtering, pagination, and slide-in detail panel.
// Receives fully-loaded data from the server page (no extra fetches for filtering).
// Slide-in panel reuses getInstanceDetailForPanel + InstanceDetailClient — same
// pattern as tasks-client.tsx.

import { useState, useMemo, useEffect, useCallback, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  ExternalLink,
  Loader2,
  Download,
  Paperclip,
  FileSpreadsheet,
} from 'lucide-react'
import type { AdminInstance } from '@/app/(app)/admin/instances/page'
import { getInstanceDetailForPanel } from '@/lib/flows/actions'
import type { InstanceDetailForPanel } from '@/lib/flows/actions'
import { InstanceDetailClient } from '@/app/(app)/my-flows/[id]/instance-detail-client'

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'error', label: 'Error' },
]

// ─── Types ────────────────────────────────────────────────────────────────────

type PanelState =
  | { status: 'closed' }
  | { status: 'loading'; instanceId: string }
  | { status: 'ready'; instanceId: string; data: InstanceDetailForPanel }
  | { status: 'error'; instanceId: string; message: string }

type Props = {
  currentUserId: string
  isAdmin: boolean
  tenantId: string
  instances: AdminInstance[]
  flows: { id: string; name: string }[]
  triggerers: { id: string; name: string; email: string }[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function relativeAge(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return '1d ago'
  if (diffDays < 30) return `${diffDays}d ago`
  const months = Math.floor(diffDays / 30)
  return `${months}mo ago`
}

function StatusBadge({ status }: { status: AdminInstance['status'] }) {
  const map: Record<AdminInstance['status'], { label: string; className: string }> = {
    pending: { label: 'Pending', className: 'bg-amber-100 text-amber-700 border-amber-200' },
    completed: {
      label: 'Completed',
      className: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    },
    cancelled: { label: 'Cancelled', className: 'bg-slate-100 text-slate-600 border-slate-200' },
    error: { label: 'Error', className: 'bg-red-100 text-red-600 border-red-200' },
  }
  const cfg = map[status] ?? map.pending
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${cfg.className}`}
    >
      {cfg.label}
    </span>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function InstancesClient({
  instances,
  flows,
  triggerers,
  currentUserId,
  isAdmin,
  tenantId,
}: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  // ── Filter state ──────────────────────────────────────────────────────────
  const [search, setSearch] = useState('')
  const [flowId, setFlowId] = useState('all')
  const [status, setStatus] = useState('all')
  const [userId, setUserId] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)

  // ── Panel state ───────────────────────────────────────────────────────────
  const [panel, setPanel] = useState<PanelState>({ status: 'closed' })

  // ── Escape key closes panel ───────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPanel({ status: 'closed' })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // ── Reset page when filters change ────────────────────────────────────────
  useEffect(() => {
    setPage(1)
  }, [search, flowId, status, userId, dateFrom, dateTo])

  // ── Open panel ────────────────────────────────────────────────────────────
  const openPanel = useCallback(async (instanceId: string) => {
    setPanel({ status: 'loading', instanceId })
    const { data, error } = await getInstanceDetailForPanel(instanceId)
    if (error || !data) {
      setPanel({ status: 'error', instanceId, message: error ?? 'Failed to load.' })
    } else {
      setPanel({ status: 'ready', instanceId, data })
    }
  }, [])

  // ── Refresh panel ─────────────────────────────────────────────────────────
  const refreshPanel = useCallback(async () => {
    if (panel.status === 'closed') return
    const id = panel.instanceId
    setPanel({ status: 'loading', instanceId: id })
    const { data, error } = await getInstanceDetailForPanel(id)
    if (error || !data) {
      setPanel({ status: 'error', instanceId: id, message: error ?? 'Failed to load.' })
    } else {
      setPanel({ status: 'ready', instanceId: id, data })
      startTransition(() => router.refresh())
    }
  }, [panel, router, startTransition])

  // ── Filtering ─────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return instances.filter((inst) => {
      if (flowId !== 'all' && inst.flowId !== flowId) return false
      if (status !== 'all' && inst.status !== status) return false
      if (userId !== 'all' && inst.triggeredById !== userId) return false
      if (dateFrom && inst.createdAt < dateFrom) return false
      if (dateTo) {
        const endOfDay = dateTo + 'T23:59:59.999Z'
        if (inst.createdAt > endOfDay) return false
      }
      if (q) {
        const haystack =
          `${inst.flowName} ${inst.triggeredByName} ${inst.triggeredByEmail}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [instances, search, flowId, status, userId, dateFrom, dateTo])

  // ── Pagination ────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  // ── Active filter count (for badge) ──────────────────────────────────────
  const activeFilterCount = [
    flowId !== 'all' ? flowId : '',
    status !== 'all' ? status : '',
    userId !== 'all' ? userId : '',
    dateFrom,
    dateTo,
  ].filter(Boolean).length

  const clearFilters = () => {
    setSearch('')
    setFlowId('all')
    setStatus('all')
    setUserId('all')
    setDateFrom('')
    setDateTo('')
  }

  // ── Export: build a download URL from the active filters ──────────────────
  const handleExport = (type: 'instances' | 'attachments') => {
    const params = new URLSearchParams({ type })
    if (flowId !== 'all') params.set('flowId', flowId)
    if (status !== 'all') params.set('status', status)
    if (userId !== 'all') params.set('userId', userId)
    if (dateFrom) params.set('dateFrom', dateFrom)
    if (dateTo) params.set('dateTo', dateTo)
    if (search.trim()) params.set('search', search.trim())

    const a = document.createElement('a')
    a.href = `/api/admin/export?${params.toString()}`
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  const panelOpen = panel.status !== 'closed'

  return (
    <div className="flex gap-0">
      {/* ── Main content (shrinks when panel is open) ── */}
      <div
        className={`flex-1 min-w-0 transition-all duration-300 ${panelOpen ? 'lg:mr-[50vw]' : ''}`}
      >
        {/* ── Filter bar ── */}
        <div className="mb-4 space-y-3">
          {/* Search + filter count */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search flow or user…"
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

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="ml-auto h-8 gap-1.5">
                  <Download className="h-3.5 w-3.5" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExport('instances')} className="gap-2">
                  <FileSpreadsheet className="h-4 w-4" />
                  Instances (CSV)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('attachments')} className="gap-2">
                  <Paperclip className="h-4 w-4" />
                  Attachments (CSV)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Filter row */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Flow filter */}
            <Select value={flowId} onValueChange={setFlowId}>
              <SelectTrigger className="h-8 w-[180px] text-xs">
                <SelectValue placeholder="All flows" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All flows</SelectItem>
                {flows.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Status filter */}
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-8 w-[150px] text-xs">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Triggered-by user filter */}
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger className="h-8 w-[180px] text-xs">
                <SelectValue placeholder="All users" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All users</SelectItem>
                {triggerers.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Date from */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">From</span>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-8 w-[140px] text-xs"
              />
            </div>

            {/* Date to */}
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

          {/* Result count */}
          <p className="text-xs text-muted-foreground">
            {filtered.length === instances.length
              ? `${instances.length} instances total`
              : `${filtered.length} of ${instances.length} instances`}
          </p>
        </div>

        {/* ── Table ── */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card px-6 py-16 text-center">
            <p className="text-sm font-medium text-foreground">No instances found</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Try adjusting your filters or search query.
            </p>
            {(activeFilterCount > 0 || search) && (
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
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Flow</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Triggered by
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Steps</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    Started
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    Updated
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pageRows.map((inst) => {
                  const isActive = panel.status !== 'closed' && panel.instanceId === inst.id
                  return (
                    <tr
                      key={inst.id}
                      className={`transition-colors hover:bg-muted/30 cursor-pointer ${
                        isActive ? 'bg-muted/50' : ''
                      }`}
                      onClick={() => openPanel(inst.id)}
                    >
                      <td className="px-4 py-3 font-medium text-foreground max-w-[200px] truncate">
                        {inst.flowName}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-foreground">{inst.triggeredByName}</div>
                        <div className="text-xs text-muted-foreground">{inst.triggeredByEmail}</div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={inst.status} />
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        <span className="text-foreground">{inst.stepCount}</span>
                        {inst.pendingStepCount > 0 && (
                          <span className="ml-1 text-xs text-amber-600">
                            ({inst.pendingStepCount} pending)
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground whitespace-nowrap">
                        {formatDate(inst.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground whitespace-nowrap">
                        {relativeAge(inst.updatedAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            openPanel(inst.id)
                          }}
                          className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
                        >
                          View
                          <ExternalLink className="h-3 w-3" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {/* ── Pagination ── */}
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
                        <span
                          key={`ellipsis-${idx}`}
                          className="px-1 text-xs text-muted-foreground"
                        >
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

      {/* ── Slide-in detail panel ── */}
      {panelOpen && (
        <div className="fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l border-border bg-background shadow-xl sm:w-[60vw] lg:w-[50vw]">
          {/* Panel header */}
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="text-sm font-semibold text-foreground">Instance Detail</h2>
            <button
              onClick={() => setPanel({ status: 'closed' })}
              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              aria-label="Close panel"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Panel body */}
          <div className="flex-1 overflow-y-auto">
            {panel.status === 'loading' && (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}

            {panel.status === 'error' && (
              <div className="p-6">
                <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {panel.message}
                </div>
              </div>
            )}

            {panel.status === 'ready' && (
              <InstanceDetailClient
                detail={panel.data.detail}
                orderedNodeIds={panel.data.orderedNodeIds}
                timeline={panel.data.timeline}
                currentUserId={currentUserId}
                isAdmin={isAdmin}
                tenantId={tenantId}
                panelMode
                onPanelClose={() => setPanel({ status: 'closed' })}
                onPanelRefresh={refreshPanel}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
