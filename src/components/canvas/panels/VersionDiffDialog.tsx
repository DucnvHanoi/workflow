'use client'

// FILE PATH: src/components/canvas/panels/VersionDiffDialog.tsx
// Modal that compares two flow versions and shows a structural diff:
// steps added / removed / modified (with field, assignee and branch detail)
// and connections added / removed. Fetches both versions' graphs on open via
// the lightweight /api/flows/versions/[versionId] route, then diffs them
// client-side with diffGraphs().

import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, Minus, Pencil, Loader2 } from 'lucide-react'
import type { SerializedGraph } from '@/lib/flows/graph'
import { diffGraphs, type GraphDiff } from '@/lib/flows/diff'

interface VersionRef {
  id: string
  version_number: number
}

interface VersionDiffDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  base: VersionRef | null // older version
  compare: VersionRef | null // newer version
}

async function fetchVersionGraph(versionId: string): Promise<SerializedGraph | null> {
  const res = await fetch(`/api/flows/versions/${versionId}`)
  if (!res.ok) return null
  const json = await res.json()
  return json.graph ?? null
}

export default function VersionDiffDialog({
  open,
  onOpenChange,
  base,
  compare,
}: VersionDiffDialogProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [diff, setDiff] = useState<GraphDiff | null>(null)

  useEffect(() => {
    if (!open || !base || !compare) return
    let cancelled = false

    setLoading(true)
    setError(null)
    setDiff(null)

    Promise.all([fetchVersionGraph(base.id), fetchVersionGraph(compare.id)])
      .then(([baseGraph, compareGraph]) => {
        if (cancelled) return
        if (!baseGraph || !compareGraph) {
          setError('Could not load one or both versions.')
          return
        }
        setDiff(diffGraphs(baseGraph, compareGraph))
      })
      .catch(() => {
        if (!cancelled) setError('Failed to compare versions.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [open, base, compare])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {base && compare
              ? `Compare v${base.version_number} → v${compare.version_number}`
              : 'Compare versions'}
          </DialogTitle>
          <DialogDescription>
            Structural changes from the older version (left) to the newer version (right).
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 -mx-1 px-1">
          {loading && (
            <div className="space-y-2 py-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading versions…
              </div>
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-md" />
              ))}
            </div>
          )}

          {!loading && error && (
            <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {!loading && !error && diff && <DiffBody diff={diff} />}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Diff rendering ───────────────────────────────────────────────────────────

function DiffBody({ diff }: { diff: GraphDiff }) {
  if (!diff.hasChanges) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        No structural differences between these versions.
      </p>
    )
  }

  const added = diff.nodes.filter((n) => n.kind === 'added')
  const removed = diff.nodes.filter((n) => n.kind === 'removed')
  const modified = diff.nodes.filter((n) => n.kind === 'modified')

  return (
    <div className="space-y-4 py-1">
      {/* Summary */}
      <div className="flex flex-wrap gap-2 text-xs">
        <SummaryPill className="bg-emerald-100 text-emerald-700">
          {diff.counts.added} added
        </SummaryPill>
        <SummaryPill className="bg-red-100 text-red-700">{diff.counts.removed} removed</SummaryPill>
        <SummaryPill className="bg-amber-100 text-amber-700">
          {diff.counts.modified} modified
        </SummaryPill>
        <SummaryPill className="bg-slate-100 text-slate-600">
          {diff.edges.length} connection {diff.edges.length === 1 ? 'change' : 'changes'}
        </SummaryPill>
      </div>

      {/* Steps */}
      {diff.nodes.length > 0 && (
        <section className="space-y-1.5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Steps
          </h3>

          {added.map((n) => (
            <Row key={`a-${n.id}`} icon={<Plus className="h-3.5 w-3.5 text-emerald-600" />}>
              <span className="font-medium text-foreground">{n.label}</span>{' '}
              <span className="text-muted-foreground">added ({n.type})</span>
            </Row>
          ))}

          {removed.map((n) => (
            <Row key={`r-${n.id}`} icon={<Minus className="h-3.5 w-3.5 text-red-600" />}>
              <span className="font-medium text-foreground line-through">{n.label}</span>{' '}
              <span className="text-muted-foreground">removed ({n.type})</span>
            </Row>
          ))}

          {modified.map((n) =>
            n.kind === 'modified' ? (
              <Row key={`m-${n.id}`} icon={<Pencil className="h-3.5 w-3.5 text-amber-600" />}>
                <span className="font-medium text-foreground">{n.label}</span>{' '}
                <span className="text-muted-foreground">modified</span>
                <ul className="mt-1 ml-1 list-disc list-inside space-y-0.5 text-xs text-muted-foreground">
                  {n.changes.map((c, i) => (
                    <li key={`c-${i}`}>{c}</li>
                  ))}
                  {n.fieldChanges.map((fc, i) => (
                    <li key={`f-${i}`}>
                      {fc.kind === 'added' && (
                        <>
                          field <span className="text-foreground">{fc.label}</span> added
                        </>
                      )}
                      {fc.kind === 'removed' && (
                        <>
                          field <span className="text-foreground">{fc.label}</span> removed
                        </>
                      )}
                      {fc.kind === 'modified' && (
                        <>
                          field <span className="text-foreground">{fc.label}</span>:{' '}
                          {fc.changes.join(', ')}
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              </Row>
            ) : null
          )}
        </section>
      )}

      {/* Connections */}
      {diff.edges.length > 0 && (
        <section className="space-y-1.5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Connections
          </h3>
          {diff.edges.map((e, i) => (
            <Row
              key={`e-${i}`}
              icon={
                e.kind === 'added' ? (
                  <Plus className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <Minus className="h-3.5 w-3.5 text-red-600" />
                )
              }
            >
              <span
                className={
                  e.kind === 'removed' ? 'text-muted-foreground line-through' : 'text-foreground'
                }
              >
                {e.label}
              </span>{' '}
              <span className="text-muted-foreground">{e.kind}</span>
            </Row>
          ))}
        </section>
      )}
    </div>
  )
}

function SummaryPill({ children, className }: { children: React.ReactNode; className: string }) {
  return <span className={`rounded-full px-2 py-0.5 font-medium ${className}`}>{children}</span>
}

function Row({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm">
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div className="min-w-0">{children}</div>
    </div>
  )
}
