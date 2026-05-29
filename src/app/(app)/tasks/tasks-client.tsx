'use client'

// FILE PATH: src/app/(app)/tasks/tasks-client.tsx
//
// Changes from previous version:
//   - Added "My Flows" tab between "Pending Tasks" and "History".
//   - "View" links in both My Flows and History tabs now open a right-side
//     slide-in panel (half the screen) instead of navigating to /my-flows/[id].
//   - Panel fetches full instance detail via getInstanceDetailForPanel() server
//     action, shows a skeleton loader while loading, then renders
//     InstanceDetailClient in panelMode.
//   - Panel has no backdrop — background stays scrollable.
//   - Escape key and an X button close the panel.
//   - Props extended: myFlowInstances, currentUserId, tenantId, isAdmin added.

import { useState, useCallback, useEffect } from 'react'
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
  InboxIcon,
  ArrowRightIcon,
  XIcon,
} from 'lucide-react'
import { getInstanceDetailForPanel } from '@/lib/flows/actions'
import type {
  TaskListItem,
  CompletedTaskListItem,
  FlowInstanceListItem,
  InstanceDetailForPanel,
} from '@/lib/flows/actions'
import { InstanceDetailClient } from '@/app/(app)/my-flows/[id]/instance-detail-client'
import { AdminChecklist } from '@/components/onboarding/AdminChecklist'
import type { AdminChecklistState } from '@/lib/onboarding/actions'

// ─── Tab type ─────────────────────────────────────────────────────────────────

type Tab = 'pending' | 'my-flows' | 'history'

// ─── Panel state ──────────────────────────────────────────────────────────────

type PanelState =
  | { status: 'closed' }
  | { status: 'loading'; instanceId: string }
  | { status: 'ready'; instanceId: string; data: InstanceDetailForPanel }
  | { status: 'error'; instanceId: string; message: string }

// ─── Props ────────────────────────────────────────────────────────────────────

interface TasksClientProps {
  pendingTasks: TaskListItem[]
  completedTasks: CompletedTaskListItem[]
  myFlowInstances: FlowInstanceListItem[]
  currentUserId: string
  tenantId: string
  isAdmin: boolean
  adminChecklist?: AdminChecklistState | null
  initialInstanceId?: string | null
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TasksClient({
  pendingTasks,
  completedTasks,
  myFlowInstances,
  currentUserId,
  tenantId,
  isAdmin,
  adminChecklist,
  initialInstanceId,
}: TasksClientProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<Tab>('pending')
  const [panel, setPanel] = useState<PanelState>({ status: 'closed' })

  // Close panel on Escape key
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setPanel({ status: 'closed' })
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // Open panel — immediately sets loading (shows skeleton), then fetches
  const openPanel = useCallback((instanceId: string) => {
    setPanel({ status: 'loading', instanceId })
    getInstanceDetailForPanel(instanceId).then(({ data, error }) => {
      if (error || !data) {
        setPanel({ status: 'error', instanceId, message: error ?? 'Failed to load.' })
      } else {
        setPanel({ status: 'ready', instanceId, data })
      }
    })
  }, [])

  const closePanel = useCallback(() => setPanel({ status: 'closed' }), [])

  // Auto-open panel when navigating from a notification link (?open=ID)
  useEffect(() => {
    if (initialInstanceId) openPanel(initialInstanceId)
  }, [initialInstanceId, openPanel])

  // Re-fetch panel after submit / cancel / reassign inside the panel
  const refreshPanel = useCallback(
    (instanceId: string) => {
      setPanel({ status: 'loading', instanceId })
      getInstanceDetailForPanel(instanceId).then(({ data, error }) => {
        if (error || !data) {
          setPanel({ status: 'error', instanceId, message: error ?? 'Failed to load.' })
        } else {
          setPanel({ status: 'ready', instanceId, data })
        }
      })
      router.refresh() // refresh page-level data (task counts etc.)
    },
    [router]
  )

  const isPanelOpen = panel.status !== 'closed'
  const panelInstanceId = panel.status !== 'closed' ? panel.instanceId : null

  return (
    <>
      {/* ── Admin onboarding checklist ── */}
      {adminChecklist && !adminChecklist.dismissed && <AdminChecklist state={adminChecklist} />}

      {/* ── Tab bar ── */}
      <div className="mb-5 flex border-b">
        <TabButton
          active={activeTab === 'pending'}
          onClick={() => setActiveTab('pending')}
          label="Pending Tasks"
          count={pendingTasks.length}
          tourKey="task-list"
        />
        <TabButton
          active={activeTab === 'my-flows'}
          onClick={() => setActiveTab('my-flows')}
          label="My Flows"
          count={myFlowInstances.length}
          tourKey="my-flows-tab"
        />
        <TabButton
          active={activeTab === 'history'}
          onClick={() => setActiveTab('history')}
          label="History"
          count={completedTasks.length}
        />
      </div>

      {/* ── Tab content ── */}
      {activeTab === 'pending' && (
        <PendingTab tasks={pendingTasks} activeInstanceId={panelInstanceId} onView={openPanel} />
      )}
      {activeTab === 'my-flows' && (
        <MyFlowsTab
          instances={myFlowInstances}
          activeInstanceId={panelInstanceId}
          onView={openPanel}
        />
      )}
      {activeTab === 'history' && (
        <HistoryTab tasks={completedTasks} activeInstanceId={panelInstanceId} onView={openPanel} />
      )}

      {/* ── Instance Detail Side Panel ─────────────────────────────────────── */}
      {/* Fixed to right edge. No backdrop — page stays scrollable behind it.  */}
      <aside
        className={`fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l bg-background shadow-2xl transition-transform duration-300 ease-in-out sm:w-[60vw] lg:w-1/2 ${
          isPanelOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        aria-label="Flow detail panel"
      >
        {/* Panel header — always visible, contains title + close button */}
        <div className="flex shrink-0 items-center justify-between border-b px-5 py-3">
          <span className="truncate text-sm font-semibold text-foreground">
            {panel.status === 'ready' ? panel.data.detail.flow_name : 'Flow Detail'}
          </span>
          <button
            onClick={closePanel}
            className="ml-4 shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Close panel"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        {/* Panel body — scrollable */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {panel.status === 'loading' && <PanelSkeleton />}

          {panel.status === 'error' && (
            <div className="p-6 text-sm text-destructive">{panel.message}</div>
          )}

          {panel.status === 'ready' && (
            <InstanceDetailClient
              detail={panel.data.detail}
              orderedNodeIds={panel.data.orderedNodeIds}
              timeline={panel.data.timeline}
              initialComments={panel.data.initialComments}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
              tenantId={tenantId}
              panelMode
              onPanelClose={closePanel}
              onPanelRefresh={() => refreshPanel(panel.instanceId)}
            />
          )}
        </div>
      </aside>
    </>
  )
}

// ─── PanelSkeleton ────────────────────────────────────────────────────────────

function PanelSkeleton() {
  return (
    <div className="animate-pulse space-y-5 p-6">
      <div className="space-y-2">
        <div className="h-6 w-2/3 rounded bg-muted" />
        <div className="h-4 w-1/2 rounded bg-muted" />
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} className="space-y-2 rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="h-5 w-5 shrink-0 rounded-full bg-muted" />
            <div className="h-4 w-1/3 rounded bg-muted" />
          </div>
          <div className="ml-8 h-3 w-1/4 rounded bg-muted" />
        </div>
      ))}
      <div className="mt-6 space-y-2">
        <div className="h-4 w-24 rounded bg-muted" />
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="space-y-1.5 rounded-lg border p-3">
            <div className="h-3 w-3/4 rounded bg-muted" />
            <div className="h-3 w-1/3 rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── TabButton ────────────────────────────────────────────────────────────────

function TabButton({
  active,
  onClick,
  label,
  count,
  tourKey,
}: {
  active: boolean
  onClick: () => void
  label: string
  count: number
  tourKey?: string
}) {
  return (
    <button
      onClick={onClick}
      data-tour={tourKey}
      className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors sm:gap-2 sm:px-5 ${
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
  activeInstanceId,
  onView,
}: {
  tasks: TaskListItem[]
  activeInstanceId: string | null
  onView: (instanceId: string) => void
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
          isActive={activeInstanceId === task.instanceId}
          onView={() => onView(task.instanceId)}
        />
      ))}
    </div>
  )
}

// ─── PendingTaskCard ──────────────────────────────────────────────────────────

function PendingTaskCard({
  task,
  isActive,
  onView,
}: {
  task: TaskListItem
  isActive: boolean
  onView: () => void
}) {
  return (
    <div
      className={`flex items-start justify-between gap-4 rounded-lg border bg-card px-4 py-3 shadow-sm transition-colors ${
        isActive ? 'border-primary/40 bg-primary/5' : ''
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <ClockIcon className="h-4 w-4 shrink-0 text-blue-500" />
          <span className="font-medium">{task.stepLabel}</span>
          <Badge variant="secondary" className="border-blue-200 bg-blue-100 text-xs text-blue-800">
            Pending
          </Badge>
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Flow: <span className="text-foreground">{task.flowName}</span>
        </p>
        {task.triggeredByName && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            Started by <span className="font-medium">{task.triggeredByName}</span>
          </p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">{formatRelative(task.createdAt)}</p>
        {task.dueAt &&
          (() => {
            const { label, className } = formatDue(task.dueAt)
            return <p className={`mt-0.5 text-xs ${className}`}>{label}</p>
          })()}
      </div>
      <div className="shrink-0">
        <Button size="sm" onClick={onView}>
          Open
        </Button>
      </div>
    </div>
  )
}

// ─── MyFlowsTab ───────────────────────────────────────────────────────────────

function MyFlowsTab({
  instances,
  activeInstanceId,
  onView,
}: {
  instances: FlowInstanceListItem[]
  activeInstanceId: string | null
  onView: (instanceId: string) => void
}) {
  if (instances.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
        <InboxIcon className="mb-3 h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm font-medium text-muted-foreground">No flows started yet</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Flows you trigger will appear here.{' '}
          <Link href="/flows" className="text-primary hover:underline">
            Browse flows →
          </Link>
        </p>
      </div>
    )
  }
  return (
    <div className="overflow-hidden rounded-lg border">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/50">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Flow</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
            <th className="hidden px-4 py-3 text-left font-medium text-muted-foreground sm:table-cell">
              Started
            </th>
            <th className="hidden px-4 py-3 text-left font-medium text-muted-foreground md:table-cell">
              Last Update
            </th>
            <th className="w-16 px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y">
          {instances.map((instance) => (
            <tr
              key={instance.id}
              className={`transition-colors hover:bg-muted/30 ${
                activeInstanceId === instance.id ? 'bg-muted/40' : ''
              }`}
            >
              <td className="px-4 py-3">
                <span className="font-medium">{instance.flowName}</span>
                {instance.description && (
                  <p className="mt-0.5 line-clamp-1 max-w-xs text-xs text-muted-foreground">
                    {instance.description}
                  </p>
                )}
              </td>
              <td className="px-4 py-3">
                <InstanceStatusBadge status={instance.status} />
              </td>
              <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">
                {formatDate(instance.createdAt)}
              </td>
              <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                {formatRelative(instance.updatedAt)}
              </td>
              <td className="px-4 py-3">
                <button
                  onClick={() => onView(instance.id)}
                  className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                >
                  View
                  <ArrowRightIcon className="h-3.5 w-3.5" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── HistoryTab ───────────────────────────────────────────────────────────────

function HistoryTab({
  tasks,
  activeInstanceId,
  onView,
}: {
  tasks: CompletedTaskListItem[]
  activeInstanceId: string | null
  onView: (instanceId: string) => void
}) {
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
        <CompletedTaskCard
          key={task.stepInstanceId}
          task={task}
          isActive={activeInstanceId === task.instanceId}
          onView={onView}
        />
      ))}
    </div>
  )
}

// ─── CompletedTaskCard ────────────────────────────────────────────────────────

function CompletedTaskCard({
  task,
  isActive,
  onView,
}: {
  task: CompletedTaskListItem
  isActive: boolean
  onView: (instanceId: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const hasFields = task.submittedFields.length > 0

  return (
    <div
      className={`rounded-lg border bg-card shadow-sm transition-colors ${
        isActive ? 'border-primary/40 bg-primary/5' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-4 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <CheckCircleIcon className="h-4 w-4 shrink-0 text-emerald-600" />
            <span className="font-medium">{task.stepLabel}</span>
            <FlowStatusPill status={task.flowInstanceStatus} />
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Flow:{' '}
            <button
              onClick={() => onView(task.instanceId)}
              className="inline-flex items-center gap-0.5 text-foreground hover:underline"
            >
              {task.flowName}
              <ExternalLinkIcon className="h-3 w-3" />
            </button>
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
          <Button size="sm" variant="outline" onClick={() => onView(task.instanceId)}>
            View flow
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

// ─── InstanceStatusBadge ──────────────────────────────────────────────────────

function InstanceStatusBadge({
  status,
}: {
  status: 'pending' | 'completed' | 'cancelled' | 'error'
}) {
  const map: Record<string, { label: string; cls: string }> = {
    pending: {
      label: 'In progress',
      cls: 'border-blue-200 bg-blue-100 text-blue-800 hover:bg-blue-100',
    },
    completed: {
      label: 'Completed',
      cls: 'border-emerald-200 bg-emerald-100 text-emerald-800 hover:bg-emerald-100',
    },
    cancelled: {
      label: 'Cancelled',
      cls: 'border-zinc-200 bg-zinc-100 text-zinc-600 hover:bg-zinc-100',
    },
    error: { label: 'Error', cls: 'border-red-200 bg-red-100 text-red-700 hover:bg-red-100' },
  }
  const entry = map[status] ?? map.cancelled
  return (
    <Badge variant="secondary" className={entry.cls}>
      {entry.label}
    </Badge>
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

function formatDue(iso: string): { label: string; className: string } {
  const diff = new Date(iso).getTime() - Date.now() // positive = future
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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return formatDate(iso)
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
