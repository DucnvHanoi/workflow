'use client'

// FILE PATH: src/app/(app)/my-flows/[id]/instance-detail-client.tsx
//
// Client component that owns the modal open/close state.
// Receives all data as props from the server component (page.tsx).
// When the user submits a step, router.refresh() re-fetches the server data
// so both the step timeline and activity log update without a full page reload.

import { useState, useCallback, useTransition } from 'react'
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
  // When rendered inside the Tasks side panel instead of the standalone page:
  //   - hides the top/bottom back links (panel has its own close button)
  //   - removes max-w-3xl wrapper (panel controls its own width)
  //   - router.refresh() is replaced by onPanelRefresh() so the panel
  //     re-fetches its own data instead of doing a full page refresh
  panelMode?: boolean
  onPanelClose?: () => void
  onPanelRefresh?: () => void
}

// ─── Modal state ──────────────────────────────────────────────────────────────

interface ModalState {
  open: boolean
  stepInstanceId: string
  stepNodeId: string // graph node id — used for storage path
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

  // ── Admin: cancel instance state
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [isCancelling, startCancel] = useTransition()

  // ── Admin: reassign step state
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

  // Open modal for a step card
  const openModal = useCallback(
    (node: SerializedNode, stepInstance: StepInstanceRow | null, isReadOnly: boolean) => {
      const formSchema = (node.data?.formSchema as FormField[]) ?? []
      setModal({
        open: true,
        stepInstanceId: stepInstance?.id ?? '',
        stepNodeId: node.id, // graph node id for storage path
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

  // ── Admin/requester: cancel flow instance
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

  // ── Admin: open reassign dialog, load users lazily
  async function openReassignDialog(stepInstanceId: string, stepLabel: string) {
    setReassignStepInstanceId(stepInstanceId)
    setReassignStepLabel(stepLabel)
    setSelectedUserId('')
    if (tenantUsers.length === 0) {
      const { users } = await getTenantUsers()
      setTenantUsers(users)
    }
  }

  // ── Admin: submit reassignment
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
      {/* ── Back link — hidden in panel mode (panel has its own close button) ── */}
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
          {/* Admin or triggerer: cancel button — only shown when flow is still pending */}
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

          const isCurrent = !!stepInstance && detail.current_step_id === stepInstance.id

          // FIXED: for a PENDING step, only the assignee may open the form to submit.
          // The triggerer can view the step card but cannot submit on behalf of others.
          // For DONE steps, anyone with a role in the flow (triggerer OR assignee)
          // can open completed steps read-only — full picture for everyone involved.
          const isAssignee = stepInstance?.assigned_to === currentUserId
          // viewer_is_assignee: set by server when viewer is an assignee but not triggerer
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
      {/* ── NEW: error banner ── */}
      {detail.status === 'error' && (
        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          This flow encountered an error and has stopped. Check the activity log below for details.
        </div>
      )}

      {/* ── NEW: Activity Log ── */}
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
// Renders the full audit trail for this flow instance.
// Each event gets an icon, a description, a precise timestamp, and —
// for step_submitted events — an expandable panel showing every field value.

import type { SerializedGraph } from '@/lib/flows/graph'

interface ActivityLogProps {
  timeline: FlowEventLog[]
  graph: SerializedGraph
}

function ActivityLog({ timeline, graph }: ActivityLogProps) {
  // Build a map of node id → node so we can look up form schemas for submitted steps
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
  // For step_submitted: show expandable form values
  const [expanded, setExpanded] = useState(false)

  const config = EVENT_CONFIG[event.eventType] ?? EVENT_CONFIG.flow_triggered

  // For step_submitted, look up the form schema to show field labels
  // The stepId is stored in event.metadata.stepId
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
          // File fields: keep rawValue as-is (array of paths) for FileDownloadLink
          display = isFilePaths(raw) ? `${(raw as string[]).length} file(s)` : '(empty)'
        } else if (field.type === 'date') {
          // Date fields: format ISO string to human-readable
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

    // Also add any raw keys not in the schema (extra file fields stored by path)
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

  // For branch_evaluated: extract path from metadata
  const branchPath =
    event.eventType === 'branch_evaluated'
      ? ((event.metadata.path as string | undefined) ?? null)
      : null

  return (
    <li className={`ml-4 ${isLast ? 'pb-0' : 'pb-5'}`}>
      {/* Dot on the timeline line */}
      <span
        className={`absolute -left-[9px] flex h-4 w-4 items-center justify-center rounded-full border-2 border-background ${config.dotColor}`}
      />

      <div className="rounded-lg border bg-card px-4 py-3 shadow-sm">
        {/* ── Top row: icon + description + timestamp ── */}
        <div className="flex items-start gap-2.5">
          {/* Icon */}
          <span className={`mt-0.5 shrink-0 ${config.iconColor}`}>
            <config.Icon className="h-4 w-4" />
          </span>

          {/* Description + metadata */}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium leading-snug text-foreground">{event.description}</p>

            {/* Branch path pill */}
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

            {/* Error detail */}
            {event.eventType === 'flow_error' && (
              <p className="mt-1 rounded bg-red-50 px-2 py-1 text-xs text-red-700">
                {String(event.metadata.error ?? event.description)}
              </p>
            )}

            {/* Form values toggle (step_submitted only) */}
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

          {/* Timestamp — right-aligned, always visible */}
          <time
            dateTime={event.createdAt}
            className="shrink-0 whitespace-nowrap text-xs text-muted-foreground"
            title={formatExact(event.createdAt)}
          >
            {formatExact(event.createdAt)}
          </time>
        </div>

        {/* ── Expanded form values ── */}
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
// Maps each event type to its icon, colors, and dot color on the timeline.

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
        {/* State icon */}
        <div className="mt-0.5">
          {state === 'done' && <CheckIcon className={`${iconClass} text-emerald-600`} />}
          {state === 'current' && <CircleDotIcon className={`${iconClass} text-blue-600`} />}
          {state === 'locked' && <LockIcon className={`${iconClass} text-muted-foreground/40`} />}
        </div>

        {/* Content */}
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

          {/* Assignee */}
          {stepInstance?.assignee_name && (
            <p className="mt-1 text-xs text-muted-foreground">
              Assigned to <span className="font-medium">{stepInstance.assignee_name}</span>
            </p>
          )}
          {stepInstance && !stepInstance.assignee_name && (
            <p className="mt-1 text-xs text-muted-foreground">Unassigned</p>
          )}

          {/* Completed timestamp */}
          {stepInstance?.completed_at && (
            <p className="mt-1 text-xs text-muted-foreground">
              Completed {formatRelative(stepInstance.completed_at)}
            </p>
          )}
        </div>

        {/* Buttons */}
        <div className="flex shrink-0 items-center gap-2">
          {/* Admin: reassign button — only on pending steps */}
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

// ── CHANGED: added 'error' status variant
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

// Formats a stored ISO date string (from a date form field) to a friendly
// human-readable string e.g. "28 May 2026, 4:03 PM"
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
    return iso // fallback to raw if parsing fails
  }
}

// ── NEW: precise timestamp for activity log — "1 Jun 2026, 11:00:02 AM"
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
