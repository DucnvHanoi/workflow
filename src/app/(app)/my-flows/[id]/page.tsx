// FILE PATH: src/app/(app)/my-flows/[id]/page.tsx
// Server component — fetches instance detail + activity log and passes
// both to the client component.
//
// IMPORTANT: This file must only export the default page component.
// Any other named export causes Next.js type errors.

import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionClaims } from '@/lib/supabase/auth-helpers'
import { redirect, notFound } from 'next/navigation'
import type { SerializedGraph } from '@/lib/flows/graph'
import { walkGraphOrder } from '@/lib/flows/graph-utils'
import { InstanceDetailClient } from './instance-detail-client'
import type { InstanceDetail, StepInstanceRow } from './types'
// ── NEW: import getFlowTimeline to fetch the activity log server-side
import { getFlowTimeline, type FlowEventLog } from '@/lib/flows/actions'

// ─── Data fetching ────────────────────────────────────────────────────────────

async function getInstanceDetail(
  instanceId: string,
  userId: string,
  tenantId: string,
  isAdmin: boolean
): Promise<InstanceDetail | null> {
  const db = createAdminClient()

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
        flows!flow_id ( name, description, tenant_id )
      )
    `
    )
    .eq('id', instanceId)
    .maybeSingle()

  if (error || !instance) return null

  const version = Array.isArray(instance.flow_versions)
    ? instance.flow_versions[0]
    : instance.flow_versions
  if (!version) return null

  const flow = Array.isArray(version.flows) ? version.flows[0] : version.flows
  if (!flow) return null

  if (flow.tenant_id !== tenantId) return null
  if (!isAdmin && instance.triggered_by !== userId) return null

  const graph = version.graph as SerializedGraph

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
    flow_description: flow.description,
    flow_name: flow.name,
    graph,
    steps,
  }
}

// ─── Page (default export only) ───────────────────────────────────────────────

export default async function InstanceDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params

  const { user, claims } = await getSessionClaims()
  if (!user) redirect('/login')

  const isAdmin = claims.role === 'admin'
  const detail = await getInstanceDetail(params.id, user.id, claims.tenant_id!, isAdmin)

  if (!detail) notFound()

  // Build a lookup of node id → node
  const nodeMap = new Map(detail.graph.nodes.map((n) => [n.id, n]))

  // Get the ordered step node ids (excluding trigger + complete)
  const orderedNodeIds = walkGraphOrder(detail.graph).filter((id) => {
    const node = nodeMap.get(id)
    return node && node.type !== 'trigger' && node.type !== 'complete'
  })

  // ── NEW: fetch activity log server-side (no client-side waterfall)
  // getFlowTimeline does its own access check internally — safe to call here.
  const { events: timeline } = await getFlowTimeline(params.id)

  return (
    <InstanceDetailClient
      detail={detail}
      orderedNodeIds={orderedNodeIds}
      currentUserId={user.id}
      // ── NEW prop
      timeline={timeline}
    />
  )
}
