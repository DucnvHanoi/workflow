// FILE PATH: src/app/(app)/my-flows/[id]/page.tsx
// Server component — shows the detail of a single flow instance.
// Displays a step timeline: completed steps (read-only), the current pending step,
// and future steps (locked).
// Accessible by the user who triggered the instance OR any admin in the same tenant.

import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionClaims } from '@/lib/supabase/auth-helpers'
import { redirect, notFound } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CheckIcon, CircleDotIcon, LockIcon, ArrowLeftIcon } from 'lucide-react'
import Link from 'next/link'
import type { SerializedGraph, SerializedNode } from '@/lib/flows/graph'

// ─── Types ────────────────────────────────────────────────────────────────────

type StepInstanceRow = {
  id: string
  step_id: string
  assigned_to: string | null
  form_data: Record<string, unknown>
  status: 'pending' | 'completed' | 'skipped'
  completed_at: string | null
  created_at: string
  // joined
  assignee_name: string | null
}

type InstanceDetail = {
  id: string
  status: 'pending' | 'completed' | 'cancelled'
  triggered_by: string
  triggered_by_name: string | null
  current_step_id: string | null
  created_at: string
  updated_at: string
  flow_name: string
  graph: SerializedGraph
  steps: StepInstanceRow[]
}

// ─── Data fetching ────────────────────────────────────────────────────────────

async function getInstanceDetail(
  instanceId: string,
  userId: string,
  tenantId: string,
  isAdmin: boolean
): Promise<InstanceDetail | null> {
  const db = createAdminClient()

  // Fetch the instance with its version + flow name + graph
  const { data: instance, error } = await db
    .from('flow_instances')
    .select(
      `
      id,
      status,
      triggered_by,
      current_step_id,
      created_at,
      updated_at,
      flow_versions!flow_version_id (
        graph,
        flows!flow_id ( name, tenant_id )
      )
    `
    )
    .eq('id', instanceId)
    .maybeSingle()

  if (error || !instance) return null

  // Unwrap PostgREST FK embedding
  const version = Array.isArray(instance.flow_versions)
    ? instance.flow_versions[0]
    : instance.flow_versions

  if (!version) return null

  const flow = Array.isArray(version.flows) ? version.flows[0] : version.flows
  if (!flow) return null

  // Tenant isolation: verify this flow belongs to the current tenant
  if (flow.tenant_id !== tenantId) return null

  // Access control: only the triggering user or an admin can view
  if (!isAdmin && instance.triggered_by !== userId) return null

  const graph = version.graph as SerializedGraph

  // Fetch all step_instances for this flow instance, with assignee name
  const { data: stepRows } = await db
    .from('step_instances')
    .select(
      `
      id,
      step_id,
      assigned_to,
      form_data,
      status,
      completed_at,
      created_at
    `
    )
    .eq('instance_id', instanceId)
    .order('created_at', { ascending: true })

  // Fetch assignee names in one query
  const assigneeIds = (stepRows ?? [])
    .map((s: { assigned_to: string | null }) => s.assigned_to)
    .filter(Boolean) as string[]

  let assigneeMap: Record<string, string> = {}
  if (assigneeIds.length > 0) {
    const { data: assignees } = await db.from('users').select('id, full_name').in('id', assigneeIds)
    assigneeMap = Object.fromEntries(
      (assignees ?? []).map((u: { id: string; full_name: string | null }) => [
        u.id,
        u.full_name ?? 'Unknown',
      ])
    )
  }

  // Fetch triggered_by user name
  const { data: triggerer } = await db
    .from('users')
    .select('full_name')
    .eq('id', instance.triggered_by)
    .maybeSingle()

  const steps: StepInstanceRow[] = (stepRows ?? []).map(
    (s: {
      id: string
      step_id: string
      assigned_to: string | null
      form_data: Record<string, unknown>
      status: string
      completed_at: string | null
      created_at: string
    }) => ({
      ...s,
      status: s.status as StepInstanceRow['status'],
      assignee_name: s.assigned_to ? (assigneeMap[s.assigned_to] ?? null) : null,
    })
  )

  return {
    id: instance.id,
    status: instance.status as InstanceDetail['status'],
    triggered_by: instance.triggered_by,
    triggered_by_name: triggerer?.full_name ?? null,
    current_step_id: instance.current_step_id,
    created_at: instance.created_at,
    updated_at: instance.updated_at,
    flow_name: flow.name,
    graph,
    steps,
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function InstanceDetailPage({ params }: { params: { id: string } }) {
  const { user, claims } = await getSessionClaims()
  if (!user) redirect('/login')

  const isAdmin = claims.role === 'admin'
  const detail = await getInstanceDetail(params.id, user.id, claims.tenant_id!, isAdmin)

  if (!detail) notFound()

  // Build a lookup of node id → node for quick access
  const nodeMap = new Map<string, SerializedNode>(detail.graph.nodes.map((n) => [n.id, n]))

  // Build ordered step timeline from graph edges, starting at trigger
  // We walk the graph to produce the canonical step order (not just DB insert order)
  const orderedNodeIds = walkGraphOrder(detail.graph)

  // Exclude the trigger and complete nodes — only action/branch nodes are steps
  const stepNodeIds = orderedNodeIds.filter((id) => {
    const node = nodeMap.get(id)
    return node && node.type !== 'trigger' && node.type !== 'complete'
  })

  // Map step_instances by step_id for quick lookup
  const stepByNodeId = new Map<string, StepInstanceRow>()
  for (const s of detail.steps) {
    stepByNodeId.set(s.step_id, s)
  }

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
        {stepNodeIds.length === 0 && (
          <p className="text-sm text-muted-foreground">No steps found in this flow.</p>
        )}

        {stepNodeIds.map((nodeId, idx) => {
          const node = nodeMap.get(nodeId)
          if (!node) return null

          const stepInstance = stepByNodeId.get(nodeId)
          const stepLabel = node.data?.label ?? `Step ${idx + 1}`
          const nodeType = node.type ?? 'action'

          // Determine display state
          // completed/skipped = done; pending = current; no instance = future (locked)
          const state: 'done' | 'current' | 'locked' = stepInstance
            ? stepInstance.status === 'pending'
              ? 'current'
              : 'done'
            : 'locked'

          return (
            <StepCard
              key={nodeId}
              label={stepLabel}
              nodeType={nodeType}
              state={state}
              stepInstance={stepInstance ?? null}
              isCurrent={!!stepInstance && detail.current_step_id === stepInstance.id}
            />
          )
        })}
      </div>

      {/* ── Actions ── */}
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
    </div>
  )
}

// ─── Step card ────────────────────────────────────────────────────────────────

function StepCard({
  label,
  nodeType,
  state,
  stepInstance,
  isCurrent,
}: {
  label: string
  nodeType: string
  state: 'done' | 'current' | 'locked'
  stepInstance: StepInstanceRow | null
  isCurrent: boolean
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
        {/* Icon */}
        <div className="mt-0.5">
          {state === 'done' && <CheckIcon className={`${iconClass} text-emerald-600`} />}
          {state === 'current' && <CircleDotIcon className={`${iconClass} text-blue-600`} />}
          {state === 'locked' && <LockIcon className={`${iconClass} text-muted-foreground/40`} />}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`font-medium ${state === 'locked' ? 'text-muted-foreground' : 'text-foreground'}`}
            >
              {label}
            </span>
            <NodeTypePill type={nodeType} />
            {isCurrent && (
              <Badge
                variant="secondary"
                className="border-blue-200 bg-blue-100 text-blue-800 text-xs"
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
      </div>
    </div>
  )
}

// ─── Node type pill ───────────────────────────────────────────────────────────

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

// ─── Instance status badge ────────────────────────────────────────────────────

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

// ─── Graph walk: BFS from trigger to get canonical node order ─────────────────
// Returns node ids in traversal order (trigger first, complete last).

function walkGraphOrder(graph: SerializedGraph): string[] {
  const triggerNode = graph.nodes.find((n) => n.type === 'trigger')
  if (!triggerNode) return graph.nodes.map((n) => n.id)

  const edgeMap = new Map<string, string[]>()
  for (const e of graph.edges) {
    if (!edgeMap.has(e.source)) edgeMap.set(e.source, [])
    edgeMap.get(e.source)!.push(e.target)
  }

  const visited = new Set<string>()
  const order: string[] = []
  const queue: string[] = [triggerNode.id]

  while (queue.length > 0) {
    const id = queue.shift()!
    if (visited.has(id)) continue
    visited.add(id)
    order.push(id)
    const children = edgeMap.get(id) ?? []
    queue.push(...children)
  }

  return order
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
