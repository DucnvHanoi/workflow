'use client'

// FILE PATH: src/app/(app)/tasks/tasks-client.tsx
//
// Client component — renders the task list and owns StepFormModal open/close state.
// On submit, router.refresh() re-fetches from the server so completed tasks
// disappear without a full page reload.

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ClipboardListIcon, ExternalLinkIcon } from 'lucide-react'
import { StepFormModal } from '@/components/canvas/StepFormModal'
import type { TaskListItem } from '@/lib/flows/actions'
import type { FormField } from '@/store/canvas-store'

// ─── Modal state ──────────────────────────────────────────────────────────────

interface ModalState {
  open: boolean
  stepInstanceId: string
  stepLabel: string
  formSchema: FormField[]
  initialData: Record<string, unknown>
}

const CLOSED: ModalState = {
  open: false,
  stepInstanceId: '',
  stepLabel: '',
  formSchema: [],
  initialData: {},
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface TasksClientProps {
  tasks: TaskListItem[]
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TasksClient({ tasks }: TasksClientProps) {
  const router = useRouter()
  const [modal, setModal] = useState<ModalState>(CLOSED)

  const openTask = useCallback((task: TaskListItem) => {
    setModal({
      open: true,
      stepInstanceId: task.stepInstanceId,
      stepLabel: task.stepLabel,
      formSchema: task.formSchema,
      initialData: {},
    })
  }, [])

  const closeModal = useCallback(() => setModal(CLOSED), [])

  const handleSubmitted = useCallback(() => {
    // Close modal first, then refresh — task disappears from list
    setModal(CLOSED)
    router.refresh()
  }, [router])

  // ── Empty state ────────────────────────────────────────────────────────────
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

  // ── Task list ──────────────────────────────────────────────────────────────
  return (
    <>
      <div className="space-y-3">
        {tasks.map((task) => (
          <TaskCard key={task.stepInstanceId} task={task} onOpen={() => openTask(task)} />
        ))}
      </div>

      {/* Modal — only mounted when a task is selected */}
      {modal.stepInstanceId && (
        <StepFormModal
          open={modal.open}
          onClose={closeModal}
          onSubmitted={handleSubmitted}
          stepInstanceId={modal.stepInstanceId}
          stepLabel={modal.stepLabel}
          formSchema={modal.formSchema}
          initialData={modal.initialData}
          isReadOnly={false}
        />
      )}
    </>
  )
}

// ─── TaskCard ─────────────────────────────────────────────────────────────────

function TaskCard({ task, onOpen }: { task: TaskListItem; onOpen: () => void }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border bg-card px-4 py-3 shadow-sm">
      {/* Left — task info */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{task.stepLabel}</span>
          <Badge variant="secondary" className="border-blue-200 bg-blue-100 text-xs text-blue-800">
            Pending
          </Badge>
        </div>

        {/* Flow name */}
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

        {/* Triggered by */}
        {task.triggeredByName && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            Started by <span className="font-medium">{task.triggeredByName}</span>
          </p>
        )}

        {/* Age */}
        <p className="mt-1 text-xs text-muted-foreground">{formatRelative(task.createdAt)}</p>
      </div>

      {/* Right — action */}
      <div className="shrink-0">
        {task.formSchema.length > 0 ? (
          <Button size="sm" onClick={onOpen}>
            Open
          </Button>
        ) : (
          // No form fields — link straight to the flow detail page
          <Button asChild size="sm" variant="outline">
            <Link href={`/my-flows/${task.instanceId}`}>View flow</Link>
          </Button>
        )}
      </div>
    </div>
  )
}

// ─── Date helper ──────────────────────────────────────────────────────────────

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
