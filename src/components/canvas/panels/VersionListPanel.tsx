'use client'

// FILE PATH: src/components/canvas/panels/VersionListPanel.tsx

import { useEffect, useState, useTransition } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { getFlowVersions, restoreVersion } from '@/lib/flows/actions'
import { useCanvasStore } from '@/store/canvas-store'
import type { SerializedGraph } from '@/lib/flows/graph'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Version {
  id: string
  version_number: number
  published_at: string | null
  created_at: string
}

interface VersionListPanelProps {
  flowId: string
  /** Called after a successful restore so FlowCanvas can re-hydrate from DB */
  onRestored: () => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days = Math.floor(diff / 86_400_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

// Fetches the full graph JSONB for a single version via a lightweight API route.
// We don't include graph in the version list query (too large for 20 rows).
async function fetchVersionGraph(versionId: string): Promise<SerializedGraph | null> {
  const res = await fetch(`/api/flows/versions/${versionId}`)
  if (!res.ok) return null
  const json = await res.json()
  return json.graph ?? null
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function VersionListPanel({ flowId, onRestored }: VersionListPanelProps) {
  const [versions, setVersions] = useState<Version[]>([])
  const [loading, setLoading] = useState(true)
  const [previewingId, setPreviewingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const loadVersion = useCanvasStore((s) => s.loadVersion)
  const setReadOnly = useCanvasStore((s) => s.setReadOnly)

  // Fetch version list on mount
  useEffect(() => {
    getFlowVersions(flowId).then(({ versions: v }) => {
      setVersions(v)
      setLoading(false)
    })
  }, [flowId])

  // ── Preview an old version ────────────────────────────────────────────────

  function handlePreview(ver: Version) {
    startTransition(async () => {
      const graph = await fetchVersionGraph(ver.id)
      if (!graph) {
        toast.error('Could not load version.')
        return
      }
      setPreviewingId(ver.id)
      loadVersion(graph) // puts canvas into read-only mode
    })
  }

  // ── Exit preview without restoring ───────────────────────────────────────

  function handleExitPreview() {
    setPreviewingId(null)
    setReadOnly(false)
    onRestored() // re-hydrates canvas from latest DB version
  }

  // ── Restore a version ─────────────────────────────────────────────────────

  function handleRestore(versionId: string) {
    startTransition(async () => {
      const result = await restoreVersion(flowId, versionId)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Version restored as a new draft.')
      setPreviewingId(null)
      setReadOnly(false)
      onRestored() // re-hydrates canvas from the freshly restored version
    })
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="p-3 space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-md" />
        ))}
      </div>
    )
  }

  if (versions.length === 0) {
    return (
      <p className="p-4 text-sm text-muted-foreground">
        No saved versions yet. Make a change to create the first version.
      </p>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* ── Preview banner ───────────────────────────────────────────── */}
      {previewingId && (
        <div className="bg-amber-50 border-b border-amber-200 px-3 py-2 flex items-center justify-between gap-2 shrink-0">
          <span className="text-xs text-amber-700 font-medium leading-tight">
            Previewing old version
          </span>
          <div className="flex gap-1.5 shrink-0">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="sm"
                  variant="default"
                  disabled={isPending}
                  className="h-7 text-xs px-2"
                >
                  Restore
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Restore this version?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This copies the selected version into a new draft. Your current work stays in
                    the version history — nothing is deleted.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => handleRestore(previewingId)}>
                    Restore
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <Button
              size="sm"
              variant="ghost"
              onClick={handleExitPreview}
              disabled={isPending}
              className="h-7 text-xs px-2"
            >
              Exit
            </Button>
          </div>
        </div>
      )}

      {/* ── Version list ─────────────────────────────────────────────── */}
      <div className="overflow-y-auto flex-1 p-2 space-y-1">
        {versions.map((ver) => {
          const isActive = previewingId === ver.id
          return (
            <button
              key={ver.id}
              onClick={() => !isPending && handlePreview(ver)}
              disabled={isPending}
              className={`
                w-full text-left rounded-md px-3 py-2 text-sm
                transition-colors hover:bg-muted
                ${isActive ? 'bg-muted ring-1 ring-primary ring-inset' : ''}
                ${isPending ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-foreground">v{ver.version_number}</span>
                {ver.published_at && <Badge className="text-xs h-4 px-1.5 py-0">Published</Badge>}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {formatRelativeTime(ver.created_at)}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
