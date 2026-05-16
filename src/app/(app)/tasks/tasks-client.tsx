'use client'

// FILE PATH: src/app/(app)/tasks/tasks-client.tsx
//
// Changes from previous version:
//   1. DRAFT FIX: openTask() now calls getStepInstance() to load any saved
//      form_data before opening the modal — so drafts are always pre-populated.
//   2. HISTORY TAB: two tabs — "Pending" (unchanged UX) and "History"
//      (all completed steps assigned to this user, with submitted values).
//   3. Props changed: pendingTasks + completedTasks instead of just tasks.

import { useState, useCallback, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ClipboardListIcon,
  ExternalLinkIcon,
  CheckCircleIcon,
  ClockIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  Loader2Icon,
} from 'lucide-react'
import { TaskDetailModal } from '@/components/canvas/TaskDetailModal'
import { getStepInstance } from '@/lib/flows/actions'
import type { TaskListItem, CompletedTaskListItem } from '@/lib/flows/actions'
import type { FormField } from '@/store/canvas-store'

// ─── Modal state ──────────────────────────────────────────────────────────────

interface ModalState {
  open: boolean
  stepInstanceId: string
  stepNodeId: string
  instanceId: string
  tenantId: string
  stepLabel: string
  formSchema: FormField[]
  initialData: Record<string, unknown>
  flowName: string
  triggeredByName: string | null
}

const CLOSED: ModalState = {
  open: false,
  stepInstanceId: '',
  stepNodeId: '',
  instanceId: '',
  tenantId: '',
  stepLabel: '',
  formSchema: [],
  initialData: {},
  flowName: '',
  triggeredByName: null,
}

// ─── Tab type ─────────────────────────────────────────────────────────────────

type Tab = 'pending' | 'history'

// ─── Props ────────────────────────────────────────────────────────────────────

interface TasksClientProps {
  pendingTasks: TaskListItem[]
  completedTasks: CompletedTaskListItem[]
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TasksClient({ pendingTasks, completedTasks }: TasksClientProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<Tab>('pending')
  const [modal, setModal] = useState<ModalState>(CLOSED)
  const [loadingTaskId, setLoadingTaskId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  // DRAFT FIX: fetch saved form_data before opening modal so drafts pre-populate
  const openTask = useCallback((task: TaskListItem) => {
    setLoadingTaskId(task.stepInstanceId)
    startTransition(async () => {
      let initialData: Record<string, unknown> = {}
      try {
        const { stepInstance } = await getStepInstance(task.stepInstanceId)
        if (stepInstance?.form_data && Object.keys(stepInstance.form_data).length > 0) {
          initialData = stepInstance.form_data as Record<string, unknown>
        }
      } catch {
        // Non-fatal — open with empty data if fetch fails
      }
      setLoadingTaskId(null)
      setModal({
        open: true,
        stepInstanceId: task.stepInstanceId,
        stepNodeId: task.stepId,
        instanceId: task.instanceId,
        tenantId: task.tenantId,
        stepLabel: task.stepLabel,
        formSchema: task.formSchema,
        initialData,
        flowName: task.flowName,
        triggeredByName: task.triggeredByName,
      })
    })
  }, [])

  const closeModal = useCallback(() => setModal(CLOSED), [])

  const handleSubmitted = useCallback(() => {
    setModal(CLOSED)
    router.refresh()
  }, [router])

  return (
    <>
      {/* ── Tab bar ── */}
      <div className="mb-5 flex border-b">
        <TabButton
          active={activeTab === 'pending'}
          onClick={() => setActiveTab('pending')}
          label="Pending"
          count={pendingTasks.length}
        />
        <TabButton
          active={activeTab === 'history'}
          onClick={() => setActiveTab('history')}
          label="History"
          count={completedTasks.length}
        />
      </div>

      {/* ── Pending tab ── */}
      {activeTab === 'pending' && (
        <PendingTab tasks={pendingTasks} loadingTaskId={loadingTaskId} onOpen={openTask} />
      )}

      {/* ── History tab ── */}
      {activeTab === 'history' && <HistoryTab tasks={completedTasks} />}

      {/* ── Modal ── */}
      {modal.stepInstanceId && (
        <TaskDetailModal
          open={modal.open}
          onClose={closeModal}
          onSubmitted={handleSubmitted}
          stepInstanceId={modal.stepInstanceId}
          stepLabel={modal.stepLabel}
          formSchema={modal.formSchema}
          initialData={modal.initialData}
          flowName={modal.flowName}
          triggeredByName={modal.triggeredByName}
          tenantId={modal.tenantId}
          instanceId={modal.instanceId}
          stepNodeId={modal.stepNodeId}
        />
      )}
    </>
  )
}

// ─── TabButton ────────────────────────────────────────────────────────────────

function TabButton({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean
  onClick: () => void
  label: string
  count: number
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 border-b-2 px-5 py-2.5 text-sm font-medium transition-colors ${
        active
          ? 'border-primary text-primary'
          : 'border-transparent text-muted-foreground hover:text-foreground'
      }`}
    >
      {label}
      {count > 0 && (
        <span
          className={`rounded-full px-1.5 py-0.5 text-xs font-semibold ${
            active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
          }`}
        >
          {count}
        </span>
      )}
    </button>
  )
}

// ─── PendingTab ───────────────────────────────────────────────────────────────

function PendingTab({
  tasks,
  loadingTaskId,
  onOpen,
}: {
  tasks: TaskListItem[]
  loadingTaskId: string | null
  onOpen: (task: TaskListItem) => void
}) {
  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
        <ClipboardListIcon className="mb-3 h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm font-medium text-muted-foreground">No pending tasks</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Steps assigned to you will appear here.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {tasks.map((task) => (
        <PendingTaskCard
          key={task.stepInstanceId}
          task={task}
          isLoading={loadingTaskId === task.stepInstanceId}
          onOpen={() => onOpen(task)}
        />
      ))}
    </div>
  )
}

// ─── PendingTaskCard ──────────────────────────────────────────────────────────

function PendingTaskCard({
  task,
  isLoading,
  onOpen,
}: {
  task: TaskListItem
  isLoading: boolean
  onOpen: () => void
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border bg-card px-4 py-3 shadow-sm">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <ClockIcon className="h-4 w-4 shrink-0 text-blue-500" />
          <span className="font-medium">{task.stepLabel}</span>
          <Badge variant="secondary" className="border-blue-200 bg-blue-100 text-xs text-blue-800">
            Pending
          </Badge>
        </div>

        <p className="mt-0.5 text-sm text-muted-foreground">
          Flow:{' '}
          <Link
            href={`/my-flows/${task.instanceId}`}
            className="inline-flex items-center gap-0.5 hover:underline"
          >
            {task.flowName}
            <ExternalLinkIcon className="h-3 w-3" />
          </Link>
        </p>

        {task.triggeredByName && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            Started by <span className="font-medium">{task.triggeredByName}</span>
          </p>
        )}

        <p className="mt-1 text-xs text-muted-foreground">{formatRelative(task.createdAt)}</p>
      </div>

      <div className="shrink-0">
        {task.formSchema.length > 0 ? (
          <Button size="sm" onClick={onOpen} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2Icon className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Loading…
              </>
            ) : (
              'Open'
            )}
          </Button>
        ) : (
          <Button asChild size="sm" variant="outline">
            <Link href={`/my-flows/${task.instanceId}`}>View flow</Link>
          </Button>
        )}
      </div>
    </div>
  )
}

// ─── HistoryTab ───────────────────────────────────────────────────────────────

function HistoryTab({ tasks }: { tasks: CompletedTaskListItem[] }) {
  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
        <CheckCircleIcon className="mb-3 h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm font-medium text-muted-foreground">No completed tasks yet</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Steps you complete will appear here for your reference.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {tasks.map((task) => (
        <CompletedTaskCard key={task.stepInstanceId} task={task} />
      ))}
    </div>
  )
}

// ─── CompletedTaskCard ────────────────────────────────────────────────────────

function CompletedTaskCard({ task }: { task: CompletedTaskListItem }) {
  const [expanded, setExpanded] = useState(false)
  const hasFields = task.submittedFields.length > 0

  return (
    <div className="rounded-lg border bg-card shadow-sm">
      <div className="flex items-start justify-between gap-4 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <CheckCircleIcon className="h-4 w-4 shrink-0 text-emerald-600" />
            <span className="font-medium">{task.stepLabel}</span>
            <FlowStatusPill status={task.flowInstanceStatus} />
          </div>

          <p className="mt-0.5 text-sm text-muted-foreground">
            Flow:{' '}
            <Link
              href={`/my-flows/${task.instanceId}`}
              className="inline-flex items-center gap-0.5 hover:underline"
            >
              {task.flowName}
              <ExternalLinkIcon className="h-3 w-3" />
            </Link>
          </p>

          {task.triggeredByName && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Started by <span className="font-medium">{task.triggeredByName}</span>
            </p>
          )}

          {task.completedAt && (
            <p className="mt-1 text-xs text-muted-foreground">
              Completed <span className="font-medium">{formatExact(task.completedAt)}</span>
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {hasFields && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="rounded-md border px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
              title={expanded ? 'Hide submitted values' : 'Show submitted values'}
            >
              {expanded ? (
                <ChevronUpIcon className="h-3.5 w-3.5" />
              ) : (
                <ChevronDownIcon className="h-3.5 w-3.5" />
              )}
            </button>
          )}
          <Button asChild size="sm" variant="outline">
            <Link href={`/my-flows/${task.instanceId}`}>View flow</Link>
          </Button>
        </div>
      </div>

      {expanded && hasFields && (
        <div className="border-t bg-muted/30 px-4 py-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            What you submitted
          </p>
          <dl className="space-y-1.5">
            {task.submittedFields.map((f) => (
              <div key={f.fieldLabel} className="flex gap-3 text-sm">
                <dt className="w-36 shrink-0 truncate font-medium text-muted-foreground">
                  {f.fieldLabel}
                </dt>
                <dd className="flex-1 break-words text-foreground">{f.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  )
}

// ─── FlowStatusPill ───────────────────────────────────────────────────────────

function FlowStatusPill({ status }: { status: 'pending' | 'completed' | 'cancelled' | 'error' }) {
  const map = {
    pending: { label: 'Flow in progress', cls: 'bg-blue-100 text-blue-700' },
    completed: { label: 'Flow completed', cls: 'bg-emerald-100 text-emerald-700' },
    cancelled: { label: 'Flow cancelled', cls: 'bg-zinc-100 text-zinc-500' },
    error: { label: 'Flow error', cls: 'bg-red-100 text-red-700' },
  }
  const entry = map[status]
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${entry.cls}`}>
      {entry.label}
    </span>
  )
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatExact(iso: string): string {
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
