'use client'

// FILE PATH: src/app/(app)/my-flows/[id]/instance-detail-client.tsx

import React, { useState, useCallback, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  CheckIcon,
  CircleDotIcon,
  LockIcon,
  ArrowLeftIcon,
  RocketIcon,
  UserIcon,
  SaveIcon,
  CheckCircleIcon,
  GitBranchIcon,
  FlagIcon,
  XCircleIcon,
  BanIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  XIcon,
  UserPenIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { StepFormModal } from '@/components/canvas/StepFormModal'
import type { InstanceDetail, StepInstanceRow } from './types'
import type { SerializedNode } from '@/lib/flows/graph'
import type { FormField } from '@/store/canvas-store'
import type { FlowEventLog } from '@/lib/flows/actions'
import { cancelInstance, reassignStep, getTenantUsers } from '@/lib/flows/actions'
import { FileDownloadLink, isFilePaths } from '@/components/canvas/FileDownloadLink'

// ─── Props ────────────────────────────────────────────────────────────────────

interface InstanceDetailClientProps {
  detail: InstanceDetail
  orderedNodeIds: string[]
  currentUserId: string
  isAdmin: boolean
  timeline: FlowEventLog[]
  tenantId: string
  panelMode?: boolean
  onPanelClose?: () => void
  onPanelRefresh?: () => void
}

// ─── Modal state ──────────────────────────────────────────────────────────────

interface ModalState {
  open: boolean
  stepInstanceId: string
  stepNodeId: string
  stepLabel: string
  formSchema: FormField[]
  initialData: Record<string, unknown>
  isReadOnly: boolean
}

const CLOSED_MODAL: ModalState = {
  open: false,
  stepInstanceId: '',
  stepNodeId: '',
  stepLabel: '',
  formSchema: [],
  initialData: {},
  isReadOnly: false,
}

// ─── StepProgressBar ──────────────────────────────────────────────────────────
// Layout: three stacked rows share the same column grid so dots & lines align.
//   Row 1 (top labels)  — step names, fixed height
//   Row 2 (dot + line)  — perfectly centred; line is a flex sibling of dots
//   Row 3 (sub labels)  — step description, fixed height
//
// Start and Complete bookend dots are always shown.
// Branch nodes → amber; action nodes → blue.

interface StepProgressBarProps {
  orderedNodeIds: string[]
  nodeMap: Map<string, SerializedNode>
  stepByNodeId: Map<string, StepInstanceRow>
  currentStepId: string | null
}

// Column width for each step (px). Bookends are the same width.
const COL_W = 88
// Connector line width between any two columns (px).
const LINE_W = 32
// Dot diameter (px) — ~2/3 of the original h-9 (36px).
const DOT_SIZE = 24

function StepProgressBar({
  orderedNodeIds,
  nodeMap,
  stepByNodeId,
  currentStepId,
}: StepProgressBarProps) {
  if (orderedNodeIds.length === 0) return null

  // Build a unified list including Start and Complete bookends
  type BarItem =
    | { kind: 'bookend'; id: string; label: string; isDone: boolean }
    | {
        kind: 'step'
        id: string
        label: string
        description: string
        isBranch: boolean
        isDone: boolean
        isCurrent: boolean
      }

  const allDone = orderedNodeIds.every((nid) => {
    const si = stepByNodeId.get(nid)
    return si && (si.status === 'completed' || si.status === 'skipped')
  })

  const items: BarItem[] = [
    { kind: 'bookend', id: '__start__', label: 'Start', isDone: true },
    ...orderedNodeIds.map((nodeId): BarItem => {
      const node = nodeMap.get(nodeId)!
      const si = stepByNodeId.get(nodeId) ?? null
      const isDone = si !== null && (si.status === 'completed' || si.status === 'skipped')
      const isCurrent = si !== null && si.status === 'pending' && currentStepId === si.id
      return {
        kind: 'step',
        id: nodeId,
        label: node.data?.label ?? 'Step',
        description: (node.data?.description as string | undefined) ?? '',
        isBranch: node.type === 'branch',
        isDone,
        isCurrent,
      }
    }),
    { kind: 'bookend', id: '__complete__', label: 'Complete', isDone: allDone },
  ]

  // ── helpers ──
  function dotClasses(item: BarItem): { bg: string; text: string; line: string } {
    if (item.kind === 'bookend') {
      return item.isDone
        ? {
            bg: 'bg-emerald-600 border-2 border-emerald-600',
            text: 'text-white',
            line: 'bg-emerald-500',
          }
        : { bg: 'bg-white border-2 border-zinc-300', text: 'text-zinc-400', line: 'bg-zinc-200' }
    }
    const s = item as Extract<BarItem, { kind: 'step' }>
    if (s.isDone) {
      return s.isBranch
        ? { bg: 'bg-amber-500 border-2 border-amber-500', text: 'text-white', line: 'bg-amber-400' }
        : { bg: 'bg-blue-600 border-2 border-blue-600', text: 'text-white', line: 'bg-blue-500' }
    }
    if (s.isCurrent) {
      return s.isBranch
        ? {
            bg: 'bg-amber-100 border-2 border-amber-500 ring-2 ring-amber-200',
            text: 'text-amber-700',
            line: 'bg-zinc-200',
          }
        : {
            bg: 'bg-blue-100 border-2 border-blue-600 ring-2 ring-blue-200',
            text: 'text-blue-700',
            line: 'bg-zinc-200',
          }
    }
    return { bg: 'bg-white border-2 border-zinc-300', text: 'text-zinc-400', line: 'bg-zinc-200' }
  }

  function topLabelColor(item: BarItem): string {
    if (item.kind === 'bookend') return item.isDone ? 'text-emerald-700' : 'text-muted-foreground'
    const s = item as Extract<BarItem, { kind: 'step' }>
    if (s.isCurrent) return s.isBranch ? 'text-amber-700' : 'text-blue-700'
    if (s.isDone) return 'text-foreground'
    return 'text-muted-foreground'
  }

  const totalWidth = items.length * COL_W + (items.length - 1) * LINE_W

  return (
    <div className="mb-6 overflow-x-auto pb-1">
      <div style={{ width: totalWidth, minWidth: totalWidth }}>
        {/* ── Row 1: top labels ── */}
        <div className="flex items-end" style={{ height: 36 }}>
          {items.map((item, idx) => (
            <React.Fragment key={item.id}>
              <div style={{ width: COL_W }} className="flex justify-center">
                <p
                  className={`w-full text-center text-[10px] font-semibold leading-tight ${topLabelColor(item)}`}
                  title={item.label}
                >
                  {item.label.length > 12 ? item.label.slice(0, 11) + '…' : item.label}
                </p>
              </div>
              {idx < items.length - 1 && <div style={{ width: LINE_W }} />}
            </React.Fragment>
          ))}
        </div>

        {/* ── Row 2: dots + connecting lines ── */}
        <div className="flex items-center" style={{ height: DOT_SIZE + 8 }}>
          {items.map((item, idx) => {
            const { bg, text, line } = dotClasses(item)
            const isLast = idx === items.length - 1
            const isDone = item.isDone
            const isCurrent =
              item.kind === 'step' && (item as Extract<BarItem, { kind: 'step' }>).isCurrent

            return (
              <React.Fragment key={item.id}>
                {/* Dot */}
                <div style={{ width: COL_W }} className="flex justify-center">
                  <div
                    style={{ width: DOT_SIZE, height: DOT_SIZE }}
                    className={`flex shrink-0 items-center justify-center rounded-full transition-all ${bg}`}
                  >
                    {isDone ? (
                      <CheckIcon style={{ width: 12, height: 12 }} className={text} />
                    ) : isCurrent ? (
                      <div
                        style={{ width: 8, height: 8 }}
                        className={`rounded-full ${item.kind === 'step' && (item as Extract<BarItem, { kind: 'step' }>).isBranch ? 'bg-amber-500' : 'bg-blue-600'}`}
                      />
                    ) : (
                      <span className={`text-[9px] font-bold ${text}`}>{idx}</span>
                    )}
                  </div>
                </div>

                {/* Connector line */}
                {!isLast && (
                  <div style={{ width: LINE_W }} className="flex items-center">
                    <div style={{ height: 2 }} className={`w-full ${line}`} />
                  </div>
                )}
              </React.Fragment>
            )
          })}
        </div>

        {/* ── Row 3: sub-labels (step description) ── */}
        <div className="flex items-start" style={{ height: 32 }}>
          {items.map((item, idx) => {
            const subLabel =
              item.kind === 'step' ? (item as Extract<BarItem, { kind: 'step' }>).description : ''
            return (
              <React.Fragment key={item.id}>
                <div style={{ width: COL_W }} className="flex justify-center">
                  {subLabel && (
                    <p
                      className="mt-1 w-full text-center text-[10px] leading-tight text-muted-foreground"
                      title={subLabel}
                    >
                      {subLabel.length > 14 ? subLabel.slice(0, 13) + '…' : subLabel}
                    </p>
                  )}
                </div>
                {idx < items.length - 1 && <div style={{ width: LINE_W }} />}
              </React.Fragment>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function InstanceDetailClient({
  detail,
  orderedNodeIds,
  currentUserId,
  isAdmin,
  timeline,
  tenantId,
  panelMode = false,
  onPanelClose,
  onPanelRefresh,
}: InstanceDetailClientProps) {
  const router = useRouter()
  const [modal, setModal] = useState<ModalState>(CLOSED_MODAL)

  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [isCancelling, startCancel] = useTransition()

  const [reassignStepInstanceId, setReassignStepInstanceId] = useState<string | null>(null)
  const [reassignStepLabel, setReassignStepLabel] = useState('')
  const [tenantUsers, setTenantUsers] = useState<
    { id: string; full_name: string | null; email: string; role: string }[]
  >([])
  const [selectedUserId, setSelectedUserId] = useState('')
  const [isReassigning, startReassign] = useTransition()

  // Build node lookup map
  const nodeMap = new Map<string, SerializedNode>(detail.graph.nodes.map((n) => [n.id, n]))

  // Build step_instance lookup by step_id (graph node id)
  const stepByNodeId = new Map<string, StepInstanceRow>()
  for (const s of detail.steps) {
    stepByNodeId.set(s.step_id, s)
  }

  const openModal = useCallback(
    (node: SerializedNode, stepInstance: StepInstanceRow | null, isReadOnly: boolean) => {
      const formSchema = (node.data?.formSchema as FormField[]) ?? []
      setModal({
        open: true,
        stepInstanceId: stepInstance?.id ?? '',
        stepNodeId: node.id,
        stepLabel: node.data?.label ?? 'Step',
        formSchema,
        initialData: (stepInstance?.form_data as Record<string, unknown>) ?? {},
        isReadOnly,
      })
    },
    []
  )

  const closeModal = useCallback(() => setModal(CLOSED_MODAL), [])

  const handleSubmitted = useCallback(() => {
    if (panelMode && onPanelRefresh) {
      onPanelRefresh()
    } else {
      router.refresh()
    }
  }, [router, panelMode, onPanelRefresh])

  function handleCancelInstance() {
    startCancel(async () => {
      try {
        const result = await cancelInstance(detail.id, cancelReason)
        if (result.error) {
          toast.error(result.error)
        } else {
          toast.success('Flow cancelled.')
          setShowCancelConfirm(false)
          setCancelReason('')
          if (panelMode && onPanelRefresh) {
            onPanelRefresh()
          } else {
            router.refresh()
          }
        }
      } catch {
        toast.error('Failed to cancel flow.')
      }
    })
  }

  async function openReassignDialog(stepInstanceId: string, stepLabel: string) {
    setReassignStepInstanceId(stepInstanceId)
    setReassignStepLabel(stepLabel)
    setSelectedUserId('')
    if (tenantUsers.length === 0) {
      const { users } = await getTenantUsers()
      setTenantUsers(users)
    }
  }

  function handleReassign() {
    if (!reassignStepInstanceId || !selectedUserId) return
    startReassign(async () => {
      try {
        const result = await reassignStep(reassignStepInstanceId, selectedUserId)
        if (result.error) {
          toast.error(result.error)
        } else {
          toast.success('Step reassigned.')
          setReassignStepInstanceId(null)
          if (panelMode && onPanelRefresh) {
            onPanelRefresh()
          } else {
            router.refresh()
          }
        }
      } catch {
        toast.error('Failed to reassign step.')
      }
    })
  }

  return (
    <div className={panelMode ? 'p-6' : 'mx-auto max-w-3xl p-6'}>
      {/* ── Back link ── */}
      {!panelMode && (
        <Link
          href={detail.viewer_is_assignee ? '/tasks' : '/my-flows'}
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeftIcon className="h-3.5 w-3.5" />
          {detail.viewer_is_assignee ? 'My Tasks' : 'My Flows'}
        </Link>
      )}

      {/* ── Header ── */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{detail.flow_name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {detail.viewer_is_assignee
              ? `Started by ${detail.triggered_by_name ?? 'someone'} on ${formatDate(detail.created_at)}`
              : `Started by ${detail.triggered_by_name ?? 'you'} on ${formatDate(detail.created_at)}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <InstanceStatusBadge status={detail.status} />
          {(isAdmin || currentUserId === detail.triggered_by) && detail.status === 'pending' && (
            <Button
              variant="outline"
              size="sm"
              className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={() => setShowCancelConfirm(true)}
            >
              <XIcon className="mr-1.5 h-3.5 w-3.5" />
              Cancel Flow
            </Button>
          )}
        </div>
      </div>

      {/* ── NEW: Step Progress Bar ── */}
      <StepProgressBar
        orderedNodeIds={orderedNodeIds}
        nodeMap={nodeMap}
        stepByNodeId={stepByNodeId}
        currentStepId={detail.current_step_id}
      />

      {/* ── Step timeline ── */}
      <div className="space-y-3">
        {orderedNodeIds.length === 0 && (
          <p className="text-sm text-muted-foreground">No steps found in this flow.</p>
        )}

        {orderedNodeIds.map((nodeId, idx) => {
          const node = nodeMap.get(nodeId)
          if (!node) return null

          const stepInstance = stepByNodeId.get(nodeId) ?? null
          const stepLabel = node.data?.label ?? `Step ${idx + 1}`
          const nodeType = node.type ?? 'action'

          const state: 'done' | 'current' | 'locked' = stepInstance
            ? stepInstance.status === 'pending'
              ? 'current'
              : 'done'
            : 'locked'

          const isCurrent =
            !!stepInstance &&
            detail.current_step_id === stepInstance.id &&
            detail.status === 'pending'

          const isAssignee = stepInstance?.assigned_to === currentUserId
          const isInvolvedInFlow =
            detail.triggered_by === currentUserId || detail.viewer_is_assignee

          const canOpen =
            (state === 'current' && isAssignee) || (state === 'done' && isInvolvedInFlow)

          const formSchema = (node.data?.formSchema as FormField[]) ?? []

          return (
            <StepCard
              key={nodeId}
              label={stepLabel}
              nodeType={nodeType}
              state={state}
              stepInstance={stepInstance}
              isCurrent={isCurrent}
              canOpen={canOpen && formSchema.length > 0}
              onOpen={() => openModal(node, stepInstance, state === 'done')}
              isAdmin={isAdmin}
              onReassign={
                isAdmin && state === 'current' && stepInstance
                  ? () => openReassignDialog(stepInstance.id, stepLabel)
                  : undefined
              }
            />
          )
        })}
      </div>

      {/* ── Status banners ── */}
      {detail.status === 'pending' && (
        <div className="mt-6 rounded-lg border bg-blue-50 px-4 py-3 text-sm text-blue-800">
          This flow is in progress. Complete the assigned steps to move it forward.
        </div>
      )}
      {detail.status === 'completed' && (
        <div className="mt-6 rounded-lg border bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          This flow has been completed.
        </div>
      )}
      {detail.status === 'cancelled' && (
        <div className="mt-6 rounded-lg border bg-zinc-100 px-4 py-3 text-sm text-zinc-600">
          This flow was cancelled.
        </div>
      )}
      {detail.status === 'error' && (
        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          This flow encountered an error and has stopped. Check the activity log below for details.
        </div>
      )}

      {/* ── Activity Log ── */}
      <ActivityLog timeline={timeline} graph={detail.graph} />

      {/* ── Bottom back / close button ── */}
      <div className="mt-4">
        {panelMode ? (
          <Button variant="outline" size="sm" onClick={onPanelClose}>
            <ArrowLeftIcon className="mr-1.5 h-3.5 w-3.5" />
            Close
          </Button>
        ) : (
          <Button asChild variant="outline" size="sm">
            <Link href={detail.viewer_is_assignee ? '/tasks' : '/my-flows'}>
              <ArrowLeftIcon className="mr-1.5 h-3.5 w-3.5" />
              {detail.viewer_is_assignee ? 'Back to My Tasks' : 'Back to My Flows'}
            </Link>
          </Button>
        )}
      </div>

      {/* ── Step Form Modal ── */}
      {modal.stepInstanceId && (
        <StepFormModal
          open={modal.open}
          onClose={closeModal}
          onSubmitted={handleSubmitted}
          stepInstanceId={modal.stepInstanceId}
          stepLabel={modal.stepLabel}
          flowName={detail.flow_name}
          formSchema={modal.formSchema}
          initialData={modal.initialData}
          isReadOnly={modal.isReadOnly}
          tenantId={tenantId}
          instanceId={detail.id}
          stepId={modal.stepNodeId}
        />
      )}

      {/* ── Cancel confirmation dialog ── */}
      <Dialog
        open={showCancelConfirm}
        onOpenChange={(open) => {
          setShowCancelConfirm(open)
          if (!open) setCancelReason('')
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel this flow?</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              This will mark the flow as cancelled and skip all pending steps. This cannot be
              undone.
            </p>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Reason <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g. Request withdrawn, no longer needed…"
                rows={3}
                disabled={isCancelling}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowCancelConfirm(false)
                setCancelReason('')
              }}
              disabled={isCancelling}
            >
              Keep flow
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleCancelInstance}
              disabled={isCancelling}
            >
              {isCancelling ? 'Cancelling…' : 'Yes, cancel flow'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Admin: Reassign step dialog ── */}
      <Dialog
        open={!!reassignStepInstanceId}
        onOpenChange={(open) => {
          if (!open) setReassignStepInstanceId(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reassign &ldquo;{reassignStepLabel}&rdquo;</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">Select a user to assign this step to.</p>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">Select a user…</option>
              {tenantUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name ?? u.email} {u.role === 'admin' ? '(admin)' : ''}
                </option>
              ))}
            </select>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setReassignStepInstanceId(null)}
              disabled={isReassigning}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={handleReassign} disabled={!selectedUserId || isReassigning}>
              {isReassigning ? 'Reassigning…' : 'Reassign'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── ActivityLog ──────────────────────────────────────────────────────────────

import type { SerializedGraph } from '@/lib/flows/graph'

interface ActivityLogProps {
  timeline: FlowEventLog[]
  graph: SerializedGraph
}

function ActivityLog({ timeline, graph }: ActivityLogProps) {
  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]))

  return (
    <div className="mt-8">
      <h2 className="mb-3 text-base font-semibold text-foreground">Activity Log</h2>

      {timeline.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
          No activity recorded yet.
        </p>
      ) : (
        <ol className="relative border-l border-border">
          {timeline.map((event, idx) => (
            <ActivityEvent
              key={event.id}
              event={event}
              nodeMap={nodeMap}
              isLast={idx === timeline.length - 1}
            />
          ))}
        </ol>
      )}
    </div>
  )
}

// ─── ActivityEvent ────────────────────────────────────────────────────────────

interface ActivityEventProps {
  event: FlowEventLog
  nodeMap: Map<string, SerializedNode>
  isLast: boolean
}

function ActivityEvent({ event, nodeMap, isLast }: ActivityEventProps) {
  const [expanded, setExpanded] = useState(false)

  const config = EVENT_CONFIG[event.eventType] ?? EVENT_CONFIG.flow_triggered

  let formValues: { label: string; value: string; fieldType: string; rawValue: unknown }[] = []
  if (event.eventType === 'step_submitted') {
    const stepId = event.metadata.stepId as string | undefined
    const node = stepId ? nodeMap.get(stepId) : undefined
    const formSchema = (node?.data?.formSchema ?? []) as FormField[]
    const rawFormData = (event.metadata.formData ?? {}) as Record<string, unknown>

    formValues = formSchema
      .map((field) => {
        const raw = rawFormData[field.id]
        let display = ''
        if (field.type === 'file') {
          display = isFilePaths(raw) ? `${(raw as string[]).length} file(s)` : '(empty)'
        } else if (field.type === 'date') {
          display = raw ? formatFieldDate(String(raw)) : '(empty)'
        } else if (Array.isArray(raw)) {
          display = raw.length > 0 ? raw.join(', ') : '(none selected)'
        } else if (raw === null || raw === undefined || raw === '') {
          display = '(empty)'
        } else {
          display = String(raw)
        }
        return {
          label: field.label || field.id,
          value: display,
          fieldType: field.type,
          rawValue: raw,
        }
      })
      .filter((f) => f.value !== '(empty)')

    const schemaIds = new Set(formSchema.map((f) => f.id))
    for (const [key, val] of Object.entries(rawFormData)) {
      if (!schemaIds.has(key)) {
        if (isFilePaths(val)) {
          formValues.push({
            label: key,
            value: `${(val as string[]).length} file(s)`,
            fieldType: 'file',
            rawValue: val,
          })
        } else {
          formValues.push({
            label: key,
            value: String(val ?? ''),
            fieldType: 'text',
            rawValue: val,
          })
        }
      }
    }
  }

  const branchPath =
    event.eventType === 'branch_evaluated'
      ? ((event.metadata.path as string | undefined) ?? null)
      : null

  return (
    <li className={`ml-4 ${isLast ? 'pb-0' : 'pb-5'}`}>
      <span
        className={`absolute -left-[9px] flex h-4 w-4 items-center justify-center rounded-full border-2 border-background ${config.dotColor}`}
      />

      <div className="rounded-lg border bg-card px-4 py-3 shadow-sm">
        <div className="flex items-start gap-2.5">
          <span className={`mt-0.5 shrink-0 ${config.iconColor}`}>
            <config.Icon className="h-4 w-4" />
          </span>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium leading-snug text-foreground">{event.description}</p>

            {branchPath && (
              <span
                className={`mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                  branchPath.startsWith('yes')
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-rose-100 text-rose-700'
                }`}
              >
                {branchPath.startsWith('yes') ? '✓ Yes path' : '✗ No path'}
                {branchPath.includes('default') && ' (default)'}
              </span>
            )}

            {event.eventType === 'flow_error' && (
              <p className="mt-1 rounded bg-red-50 px-2 py-1 text-xs text-red-700">
                {String(event.metadata.error ?? event.description)}
              </p>
            )}

            {event.eventType === 'step_submitted' && formValues.length > 0 && (
              <button
                onClick={() => setExpanded((v) => !v)}
                className="mt-1.5 inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >
                {expanded ? (
                  <>
                    <ChevronUpIcon className="h-3 w-3" />
                    Hide submitted values
                  </>
                ) : (
                  <>
                    <ChevronDownIcon className="h-3 w-3" />
                    Show submitted values ({formValues.length}{' '}
                    {formValues.length === 1 ? 'field' : 'fields'})
                  </>
                )}
              </button>
            )}
          </div>

          <time
            dateTime={event.createdAt}
            className="shrink-0 whitespace-nowrap text-xs text-muted-foreground"
            title={formatExact(event.createdAt)}
          >
            {formatExact(event.createdAt)}
          </time>
        </div>

        {expanded && formValues.length > 0 && (
          <div className="mt-3 rounded-md border bg-muted/40 px-3 py-2">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Submitted values
            </p>
            <dl className="space-y-1.5">
              {formValues.map((fv) => (
                <div key={fv.label} className="flex gap-2 text-xs">
                  <dt className="w-32 shrink-0 truncate font-medium text-muted-foreground">
                    {fv.label}
                  </dt>
                  <dd className="flex-1 break-words text-foreground">
                    {fv.fieldType === 'file' && isFilePaths(fv.rawValue) ? (
                      <span className="flex flex-col gap-1">
                        {(fv.rawValue as string[]).map((path) => (
                          <FileDownloadLink key={path} storagePath={path} />
                        ))}
                      </span>
                    ) : fv.fieldType === 'textarea' ? (
                      <span className="whitespace-pre-wrap">{fv.value}</span>
                    ) : (
                      fv.value
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </div>
    </li>
  )
}

// ─── Event config ─────────────────────────────────────────────────────────────

type EventConfig = {
  Icon: React.ComponentType<{ className?: string }>
  iconColor: string
  dotColor: string
}

const EVENT_CONFIG: Record<FlowEventLog['eventType'], EventConfig> = {
  flow_triggered: {
    Icon: RocketIcon,
    iconColor: 'text-blue-600',
    dotColor: 'bg-blue-500',
  },
  step_assigned: {
    Icon: UserIcon,
    iconColor: 'text-violet-600',
    dotColor: 'bg-violet-400',
  },
  step_draft_saved: {
    Icon: SaveIcon,
    iconColor: 'text-zinc-500',
    dotColor: 'bg-zinc-400',
  },
  step_submitted: {
    Icon: CheckCircleIcon,
    iconColor: 'text-emerald-600',
    dotColor: 'bg-emerald-500',
  },
  branch_evaluated: {
    Icon: GitBranchIcon,
    iconColor: 'text-amber-600',
    dotColor: 'bg-amber-400',
  },
  flow_completed: {
    Icon: FlagIcon,
    iconColor: 'text-emerald-700',
    dotColor: 'bg-emerald-600',
  },
  flow_error: {
    Icon: XCircleIcon,
    iconColor: 'text-red-600',
    dotColor: 'bg-red-500',
  },
  flow_cancelled: {
    Icon: BanIcon,
    iconColor: 'text-zinc-500',
    dotColor: 'bg-zinc-400',
  },
}

// ─── StepCard ─────────────────────────────────────────────────────────────────

function StepCard({
  label,
  nodeType,
  state,
  stepInstance,
  isCurrent,
  canOpen,
  onOpen,
  isAdmin,
  onReassign,
}: {
  label: string
  nodeType: string
  state: 'done' | 'current' | 'locked'
  stepInstance: StepInstanceRow | null
  isCurrent: boolean
  canOpen: boolean
  onOpen: () => void
  isAdmin?: boolean
  onReassign?: () => void
}) {
  const iconClass = 'h-5 w-5 shrink-0'

  return (
    <div
      className={`rounded-lg border px-4 py-3 ${
        state === 'current'
          ? 'border-blue-300 bg-blue-50'
          : state === 'done'
            ? 'border-emerald-200 bg-emerald-50/40'
            : 'border-dashed bg-muted/20 opacity-60'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5">
          {state === 'done' && <CheckIcon className={`${iconClass} text-emerald-600`} />}
          {state === 'current' && <CircleDotIcon className={`${iconClass} text-blue-600`} />}
          {state === 'locked' && <LockIcon className={`${iconClass} text-muted-foreground/40`} />}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`font-medium ${state === 'locked' ? 'text-muted-foreground' : 'text-foreground'}`}
            >
              {label}
            </span>
            <NodeTypePill type={nodeType} />
            {isCurrent && (
              <Badge
                variant="secondary"
                className="border-blue-200 bg-blue-100 text-xs text-blue-800"
              >
                Current step
              </Badge>
            )}
            {stepInstance?.status === 'skipped' && (
              <Badge variant="secondary" className="text-xs">
                Skipped
              </Badge>
            )}
          </div>

          {stepInstance?.assignee_name && (
            <p className="mt-1 text-xs text-muted-foreground">
              Assigned to <span className="font-medium">{stepInstance.assignee_name}</span>
            </p>
          )}
          {stepInstance && !stepInstance.assignee_name && (
            <p className="mt-1 text-xs text-muted-foreground">Unassigned</p>
          )}

          {stepInstance?.completed_at && (
            <p className="mt-1 text-xs text-muted-foreground">
              Completed {formatRelative(stepInstance.completed_at)}
            </p>
          )}
          {stepInstance?.due_at &&
            stepInstance.status === 'pending' &&
            (() => {
              const { label, className } = formatDue(stepInstance.due_at)
              return <p className={`mt-0.5 text-xs ${className}`}>{label}</p>
            })()}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {isAdmin && onReassign && state === 'current' && (
            <Button
              variant="outline"
              size="sm"
              className="text-muted-foreground hover:text-foreground"
              onClick={onReassign}
            >
              <UserPenIcon className="mr-1.5 h-3.5 w-3.5" />
              Reassign
            </Button>
          )}
          {canOpen && (
            <Button
              variant={state === 'current' ? 'default' : 'outline'}
              size="sm"
              onClick={onOpen}
            >
              {state === 'current' ? 'Open' : 'View'}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── NodeTypePill ─────────────────────────────────────────────────────────────

function NodeTypePill({ type }: { type: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    action: { label: 'Action', cls: 'bg-blue-100 text-blue-700' },
    branch: { label: 'Branch', cls: 'bg-amber-100 text-amber-700' },
  }
  const entry = map[type]
  if (!entry) return null
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${entry.cls}`}>
      {entry.label}
    </span>
  )
}

// ─── InstanceStatusBadge ──────────────────────────────────────────────────────

function InstanceStatusBadge({
  status,
}: {
  status: 'pending' | 'completed' | 'cancelled' | 'error'
}) {
  if (status === 'pending') {
    return (
      <Badge className="border-blue-200 bg-blue-100 text-blue-800 hover:bg-blue-100">
        In progress
      </Badge>
    )
  }
  if (status === 'completed') {
    return (
      <Badge className="border-emerald-200 bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
        Completed
      </Badge>
    )
  }
  if (status === 'error') {
    return <Badge className="border-red-200 bg-red-100 text-red-800 hover:bg-red-100">Error</Badge>
  }
  return (
    <Badge className="border-zinc-200 bg-zinc-100 text-zinc-600 hover:bg-zinc-100">Cancelled</Badge>
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

function formatFieldDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })
  } catch {
    return iso
  }
}

function formatExact(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  })
}

function formatDue(iso: string): { label: string; className: string } {
  const diff = new Date(iso).getTime() - Date.now()
  const absMins = Math.floor(Math.abs(diff) / 60_000)
  const absHrs = Math.floor(absMins / 60)
  const absDays = Math.floor(absHrs / 24)
  if (diff < 0) {
    const label =
      absMins < 60
        ? `${absMins}m overdue`
        : absHrs < 24
          ? `${absHrs}h overdue`
          : `${absDays}d overdue`
    return { label, className: 'text-red-600 font-medium' }
  }
  if (diff < 24 * 60 * 60 * 1000) {
    const label = absHrs < 1 ? `Due in ${absMins}m` : `Due in ${absHrs}h`
    return { label, className: 'text-amber-600 font-medium' }
  }
  return {
    label: `Due ${new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`,
    className: 'text-muted-foreground',
  }
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
