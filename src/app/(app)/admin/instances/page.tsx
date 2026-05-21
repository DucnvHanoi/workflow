// FILE PATH: src/app/(app)/admin/instances/page.tsx
// Server component — fetches all flow instances + metadata for this tenant.
// Passes data to InstancesClient which handles filtering, pagination, and
// the slide-in detail panel entirely client-side.

import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionClaims } from '@/lib/supabase/auth-helpers'
import { InstancesClient } from '@/components/admin/instances-client'

// ─── Types (exported so InstancesClient can import them) ──────────────────────

export type AdminInstance = {
  id: string
  status: 'pending' | 'completed' | 'cancelled' | 'error'
  createdAt: string // ISO
  updatedAt: string // ISO
  flowId: string
  flowName: string
  triggeredById: string
  triggeredByName: string
  triggeredByEmail: string
  stepCount: number // total step_instances for this flow instance
  pendingStepCount: number
}

export type AdminInstanceFilter = {
  flowId: string // '' = all
  status: string // '' = all
  userId: string // '' = all (triggered-by user id)
  dateFrom: string // '' = no lower bound  (YYYY-MM-DD)
  dateTo: string // '' = no upper bound  (YYYY-MM-DD)
  search: string // '' = no search (matches flow name or user name)
}

// ─── Data fetch ───────────────────────────────────────────────────────────────

async function getAdminInstancesData(tenantId: string) {
  const db = createAdminClient()

  // ── 1. All flow instances joined to flow_versions → flows ─────────────────
  const { data: rawInstances, error: instError } = await db
    .from('flow_instances')
    .select(
      `
      id,
      status,
      triggered_by,
      created_at,
      updated_at,
      flow_versions!flow_version_id (
        flows!flow_id ( id, name, tenant_id )
      )
    `
    )
    .order('created_at', { ascending: false })

  if (instError) throw new Error(instError.message)

  // ── 2. Filter to this tenant via nested join ───────────────────────────────
  type RawInst = {
    id: string
    status: string
    triggered_by: string
    created_at: string
    updated_at: string
    flow_versions:
      | {
          flows:
            | { id: string; name: string; tenant_id: string }
            | { id: string; name: string; tenant_id: string }[]
            | null
        }
      | {
          flows:
            | { id: string; name: string; tenant_id: string }
            | { id: string; name: string; tenant_id: string }[]
            | null
        }[]
      | null
  }

  const tenantInstances = ((rawInstances ?? []) as RawInst[]).filter((inst) => {
    const fv = Array.isArray(inst.flow_versions) ? inst.flow_versions[0] : inst.flow_versions
    if (!fv) return false
    const flow = Array.isArray(fv.flows) ? fv.flows[0] : fv.flows
    return flow?.tenant_id === tenantId
  })

  // ── 3. Collect unique user IDs (triggered_by) ─────────────────────────────
  const userIds = Array.from(new Set(tenantInstances.map((i) => i.triggered_by).filter(Boolean)))

  let userMap: Record<string, { name: string; email: string }> = {}
  if (userIds.length > 0) {
    const { data: users } = await db.from('users').select('id, full_name, email').in('id', userIds)
    userMap = Object.fromEntries(
      (users ?? []).map((u: { id: string; full_name: string | null; email: string }) => [
        u.id,
        { name: u.full_name ?? u.email, email: u.email },
      ])
    )
  }

  // ── 4. Step counts per instance ───────────────────────────────────────────
  // Fetch all step_instances for the relevant instance IDs in one query
  const instanceIds = tenantInstances.map((i) => i.id)
  let stepCountMap: Record<string, { total: number; pending: number }> = {}

  if (instanceIds.length > 0) {
    const { data: stepRows } = await db
      .from('step_instances')
      .select('instance_id, status')
      .in('instance_id', instanceIds)

    for (const step of stepRows ?? []) {
      const s = step as { instance_id: string; status: string }
      if (!stepCountMap[s.instance_id]) stepCountMap[s.instance_id] = { total: 0, pending: 0 }
      stepCountMap[s.instance_id].total++
      if (s.status === 'pending') stepCountMap[s.instance_id].pending++
    }
  }

  // ── 5. Assemble AdminInstance list ────────────────────────────────────────
  const instances: AdminInstance[] = tenantInstances.map((inst) => {
    const fv = Array.isArray(inst.flow_versions) ? inst.flow_versions[0] : inst.flow_versions
    const flow = fv ? (Array.isArray(fv.flows) ? fv.flows[0] : fv.flows) : null
    const user = userMap[inst.triggered_by] ?? { name: 'Unknown', email: '' }
    const counts = stepCountMap[inst.id] ?? { total: 0, pending: 0 }

    return {
      id: inst.id,
      status: inst.status as AdminInstance['status'],
      createdAt: inst.created_at,
      updatedAt: inst.updated_at,
      flowId: flow?.id ?? '',
      flowName: flow?.name ?? 'Unknown Flow',
      triggeredById: inst.triggered_by,
      triggeredByName: user.name,
      triggeredByEmail: user.email,
      stepCount: counts.total,
      pendingStepCount: counts.pending,
    }
  })

  // ── 6. Flow list for the filter dropdown (all flows in tenant) ────────────
  const { data: flowRows } = await db
    .from('flows')
    .select('id, name')
    .eq('tenant_id', tenantId)
    .order('name', { ascending: true })

  const flows = (flowRows ?? []).map((f: { id: string; name: string }) => ({
    id: f.id,
    name: f.name,
  }))

  // ── 7. User list for the triggered-by filter dropdown ────────────────────
  const triggererIds = Array.from(new Set(instances.map((i) => i.triggeredById)))
  const triggerers = triggererIds
    .map((id) => ({
      id,
      name: userMap[id]?.name ?? 'Unknown',
      email: userMap[id]?.email ?? '',
    }))
    .sort((a, b) => a.name.localeCompare(b.name))

  return { instances, flows, triggerers }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AdminInstancesPage() {
  const { user, claims } = await getSessionClaims()
  if (!user) redirect('/login')
  if (claims.role !== 'admin') redirect('/unauthorized')
  if (!claims.tenant_id) redirect('/login')

  const { instances, flows, triggerers } = await getAdminInstancesData(claims.tenant_id)

  return (
    <div className="flex-1 space-y-6 p-6 md:p-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">All Instances</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every flow instance in your workspace — filter, search, and inspect.
        </p>
      </div>

      <InstancesClient
        instances={instances}
        currentUserId={user.id}
        isAdmin={claims.role === 'admin'}
        tenantId={claims.tenant_id ?? ''}
        flows={flows}
        triggerers={triggerers}
      />
    </div>
  )
}
