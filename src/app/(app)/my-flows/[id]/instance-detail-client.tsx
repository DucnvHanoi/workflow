'use client'

// FILE PATH: src/app/(app)/my-flows/[id]/instance-detail-client.tsx
//
// Client component that owns the modal open/close state.
// Receives all data as props from the server component (page.tsx).
// When the user submits a step, router.refresh() re-fetches the server data
// so the timeline updates without a full page reload.

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CheckIcon, CircleDotIcon, LockIcon, ArrowLeftIcon } from 'lucide-react'
import { StepFormModal } from '@/components/canvas/StepFormModal'
import type { InstanceDetail, StepInstanceRow } from './types'
import type { SerializedNode } from '@/lib/flows/graph'
import type { FormField } from '@/store/canvas-store'

// ─── Props ────────────────────────────────────────────────────────────────────

interface InstanceDetailClientProps {
  detail: InstanceDetail
  orderedNodeIds: string[]
  currentUserId: string
}

// ─── Modal state ──────────────────────────────────────────────────────────────

interface ModalState {
  open: boolean
  stepInstanceId: string
  stepLabel: string
  formSchema: FormField[]
  initialData: Record<string, unknown>
  isReadOnly: boolean
}

const CLOSED_MODAL: ModalState = {
  open: false,
  stepInstanceId: '',
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
}: InstanceDetailClientProps) {
  const router = useRouter()
  const [modal, setModal] = useState<ModalState>(CLOSED_MODAL)

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
    router.refresh()
  }, [router])

  return (
    <div className="mx-auto max-w-3xl p-6">
      {/* ── Back link ── */}
      <Link
        href="/my-flows"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="h-3.5 w-3.5" />
        My Flows
      </Link>

      {/* ── Header ── */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{detail.flow_name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Started by {detail.triggered_by_name ?? 'you'} on {formatDate(detail.created_at)}
          </p>
        </div>
        <InstanceStatusBadge status={detail.status} />
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

          // "Open" button logic:
          // - Current pending step: show if current user is the assignee OR the triggerer
          // - Completed step: show for read-only view
          // - Locked (future) step: no button
          const isAssigneeOrTriggerer =
            stepInstance?.assigned_to === currentUserId || detail.triggered_by === currentUserId

          const canOpen = (state === 'current' && isAssigneeOrTriggerer) || state === 'done'

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

      <div className="mt-4">
        <Button asChild variant="outline" size="sm">
          <Link href="/my-flows">
            <ArrowLeftIcon className="mr-1.5 h-3.5 w-3.5" />
            Back to My Flows
          </Link>
        </Button>
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
        />
      )}
    </div>
  )
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
}: {
  label: string
  nodeType: string
  state: 'done' | 'current' | 'locked'
  stepInstance: StepInstanceRow | null
  isCurrent: boolean
  canOpen: boolean
  onOpen: () => void
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

        {/* Open button */}
        {canOpen && (
          <Button
            variant={state === 'current' ? 'default' : 'outline'}
            size="sm"
            className="shrink-0"
            onClick={onOpen}
          >
            {state === 'current' ? 'Open' : 'View'}
          </Button>
        )}
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

function InstanceStatusBadge({ status }: { status: 'pending' | 'completed' | 'cancelled' }) {
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
