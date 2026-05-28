'use client'

// FILE PATH: src/components/canvas/panels/PublishPanel.tsx

import { useState, useTransition } from 'react'
import { CheckCircle2, AlertTriangle, Globe, FileText, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { serializeGraph, validateGraph, type ValidationError } from '@/lib/flows/graph'
import {
  publishFlow,
  unpublishFlow,
  updateFlowDepartmentRestrictions,
  updateFlowCommentHistory,
} from '@/lib/flows/actions'
import { useCanvasStore, type NodeData, type TenantDepartment } from '@/store/canvas-store'
import type { Node } from '@xyflow/react'

// ─── Props ────────────────────────────────────────────────────────────────────

interface PublishPanelProps {
  flowId: string
  flowStatus: 'draft' | 'published'
  departments: TenantDepartment[]
  initialAllowedDeptIds: string[]
  initialShowFullHistory: boolean
  onStatusChange: (status: 'draft' | 'published') => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PublishPanel({
  flowId,
  flowStatus,
  departments,
  initialAllowedDeptIds,
  initialShowFullHistory,
  onStatusChange,
}: PublishPanelProps) {
  const nodes = useCanvasStore((s) => s.nodes)
  const edges = useCanvasStore((s) => s.edges)
  const [isPending, startTransition] = useTransition()
  const [isRestrictionPending, startRestrictionTransition] = useTransition()
  const [isHistoryPending, startHistoryTransition] = useTransition()
  const [showFullHistory, setShowFullHistory] = useState(initialShowFullHistory)

  // Local restriction state — initialised from server, auto-saved on change
  const [restricted, setRestricted] = useState(initialAllowedDeptIds.length > 0)
  const [allowedDeptIds, setAllowedDeptIds] = useState<string[]>(initialAllowedDeptIds)

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

  // ── Restriction toggle ────────────────────────────────────────────────────

  function handleRestrictedToggle(checked: boolean) {
    setRestricted(checked)
    const nextIds = checked ? allowedDeptIds : []
    startRestrictionTransition(async () => {
      const result = await updateFlowDepartmentRestrictions(flowId, nextIds)
      if (result.error) toast.error(result.error)
    })
  }

  function handleDeptToggle(deptId: string, checked: boolean) {
    const next = checked
      ? [...allowedDeptIds, deptId]
      : allowedDeptIds.filter((id) => id !== deptId)
    setAllowedDeptIds(next)
    startRestrictionTransition(async () => {
      const result = await updateFlowDepartmentRestrictions(flowId, next)
      if (result.error) toast.error(result.error)
    })
  }

  // ── Comment history toggle ────────────────────────────────────────────────

  function handleHistoryToggle(checked: boolean) {
    setShowFullHistory(checked)
    startHistoryTransition(async () => {
      const result = await updateFlowCommentHistory(flowId, checked)
      if (result.error) toast.error(result.error)
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

      <div className="border-t border-border" />

      {/* ── Trigger restrictions ──────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-muted-foreground shrink-0" />
          <p className="text-sm font-semibold text-foreground">Trigger Restrictions</p>
        </div>

        <div className="flex items-start gap-2">
          <input
            id="restrict-toggle"
            type="checkbox"
            checked={restricted}
            onChange={(e) => handleRestrictedToggle(e.target.checked)}
            disabled={isRestrictionPending}
            className="mt-0.5 h-4 w-4 rounded border-input accent-primary cursor-pointer"
          />
          <label htmlFor="restrict-toggle" className="text-xs leading-snug cursor-pointer">
            Restrict to specific departments
            <span className="block text-muted-foreground">
              When enabled, only users in selected departments can trigger this flow.
            </span>
          </label>
        </div>

        {restricted && (
          <div className="space-y-1.5 pl-1">
            {departments.length === 0 ? (
              <p className="text-xs text-muted-foreground">No departments found.</p>
            ) : (
              departments.map((dept) => (
                <div key={dept.id} className="flex items-center gap-2">
                  <input
                    id={`dept-${dept.id}`}
                    type="checkbox"
                    checked={allowedDeptIds.includes(dept.id)}
                    onChange={(e) => handleDeptToggle(dept.id, e.target.checked)}
                    disabled={isRestrictionPending}
                    className="h-3.5 w-3.5 rounded border-input accent-primary cursor-pointer"
                  />
                  <label
                    htmlFor={`dept-${dept.id}`}
                    className="text-xs text-foreground cursor-pointer truncate"
                  >
                    {dept.name}
                  </label>
                </div>
              ))
            )}
            {restricted && allowedDeptIds.length === 0 && (
              <p className="text-xs text-amber-600">
                No departments selected — all users can still trigger this flow.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-border" />

      {/* ── Comment history ───────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-muted-foreground shrink-0" />
          <p className="text-sm font-semibold text-foreground">Comment History</p>
        </div>
        <div className="flex items-start gap-2">
          <input
            id="history-toggle"
            type="checkbox"
            checked={showFullHistory}
            onChange={(e) => handleHistoryToggle(e.target.checked)}
            disabled={isHistoryPending}
            className="mt-0.5 h-4 w-4 rounded border-input accent-primary cursor-pointer"
          />
          <label htmlFor="history-toggle" className="text-xs leading-snug cursor-pointer">
            Show full comment history to all participants
            <span className="block text-muted-foreground">
              When off, assignees who join later can only see comments posted after their step was
              assigned. Triggerer and admins always see everything.
            </span>
          </label>
        </div>
      </div>
    </div>
  )
}
