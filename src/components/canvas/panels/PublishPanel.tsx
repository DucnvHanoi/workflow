'use client'

// FILE PATH: src/components/canvas/panels/PublishPanel.tsx

import { useTransition } from 'react'
import { CheckCircle2, AlertTriangle, Globe, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { serializeGraph, validateGraph, type ValidationError } from '@/lib/flows/graph'
import { publishFlow, unpublishFlow } from '@/lib/flows/actions'
import { useCanvasStore, type NodeData } from '@/store/canvas-store'
import type { Node } from '@xyflow/react'

// ─── Props ────────────────────────────────────────────────────────────────────

interface PublishPanelProps {
  flowId: string
  flowStatus: 'draft' | 'published'
  onStatusChange: (status: 'draft' | 'published') => void // Removed unused 'status' property
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PublishPanel({ flowId, flowStatus, onStatusChange }: PublishPanelProps) {
  const nodes = useCanvasStore((s) => s.nodes)
  const edges = useCanvasStore((s) => s.edges)
  const [isPending, startTransition] = useTransition()

  // The Zustand store types nodes as Node[] (React Flow base type) but our
  // serializeGraph expects Node<NodeData>[]. The data shape is always NodeData
  // at runtime — we just need to tell TypeScript that explicitly.
  const { nodes: sNodes, edges: sEdges } = serializeGraph(nodes as Node<NodeData>[], edges)
  const errors: ValidationError[] = validateGraph(sNodes, sEdges)
  const isValid = errors.length === 0

  // ── Publish ───────────────────────────────────────────────────────────────

  function handlePublish() {
    if (!isValid) return
    startTransition(async () => {
      const result = await publishFlow(flowId)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Flow published — users can now trigger it.')
      onStatusChange('published')
    })
  }

  // ── Unpublish ─────────────────────────────────────────────────────────────

  function handleUnpublish() {
    startTransition(async () => {
      const result = await unpublishFlow(flowId)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Flow unpublished and set back to draft.')
      onStatusChange('draft')
    })
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 space-y-4">
      {/* ── Current status ───────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        {flowStatus === 'published' ? (
          <Globe className="h-4 w-4 text-emerald-600 shrink-0" />
        ) : (
          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
        <div>
          <p className="text-sm font-semibold text-foreground">
            {flowStatus === 'published' ? 'Published' : 'Draft'}
          </p>
          <p className="text-xs text-muted-foreground">
            {flowStatus === 'published'
              ? 'This flow is live. Users can trigger it.'
              : 'This flow is not yet visible to users.'}
          </p>
        </div>
      </div>

      <div className="border-t border-border" />

      {/* ── Validation result ─────────────────────────────────────────── */}
      {isValid ? (
        <div className="flex items-start gap-2 rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2.5">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
          <p className="text-xs text-emerald-700">
            All checks passed. This flow is ready to publish.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <p className="text-xs font-medium">
              {errors.length} issue{errors.length !== 1 ? 's' : ''} to fix before publishing
            </p>
          </div>
          <ul className="space-y-1">
            {errors.map((err, i) => (
              <li key={i} className="rounded-md bg-muted px-2.5 py-2 text-xs text-muted-foreground">
                {err.nodeId ? (
                  <>
                    <span className="font-medium text-foreground">{err.nodeName}: </span>
                    {err.message}
                  </>
                ) : (
                  <span className="text-foreground">{err.message}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Action buttons ────────────────────────────────────────────── */}
      {flowStatus === 'draft' ? (
        <Button className="w-full" disabled={!isValid || isPending} onClick={handlePublish}>
          {isPending ? 'Publishing…' : 'Publish Flow'}
        </Button>
      ) : (
        <Button variant="outline" className="w-full" disabled={isPending} onClick={handleUnpublish}>
          {isPending ? 'Unpublishing…' : 'Unpublish (back to draft)'}
        </Button>
      )}
    </div>
  )
}
