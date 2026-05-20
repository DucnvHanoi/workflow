// FILE PATH: src/app/(app)/dashboard/page.tsx
// Admin dashboard — stat cards + per-flow breakdown + pending-at-who table.
// Pure server component: all queries run server-side via adminClient.
// Access: admin only (middleware already guards /dashboard).

import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionClaims } from '@/lib/supabase/auth-helpers'
import { Badge } from '@/components/ui/badge'
import {
  Activity,
  CheckCircle2,
  XCircle,
  GitBranch,
  Clock,
  AlertCircle,
  TrendingUp,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type StatCard = {
  label: string
  value: number
  icon: React.ElementType
  color: string // Tailwind text colour class
  bgColor: string // Tailwind bg colour class
  description: string
}

type FlowRow = {
  id: string
  name: string
  status: 'draft' | 'published'
  total: number
  pending: number
  completed: number
  cancelled: number
  error: number
}

type PendingUserRow = {
  userId: string
  userName: string
  email: string
  pendingCount: number
  oldestPendingDate: string | null // ISO string
}

// ─── Data fetching ────────────────────────────────────────────────────────────

async function getDashboardData(tenantId: string) {
  const db = createAdminClient()

  // ── 1. All flow instances for this tenant (via flow_versions → flows) ──────
  // We join: flow_instances → flow_versions → flows
  // The join goes through flow_versions.flow_id → flows.id
  const { data: instanceRows, error: instanceError } = await db.from('flow_instances').select(
    `
      id,
      status,
      created_at,
      flow_versions!flow_version_id (
        flows!flow_id ( id, name, status, tenant_id )
      )
    `
  )

  if (instanceError) throw new Error(instanceError.message)

  // Filter to this tenant only — tenant isolation via join
  type RawInstance = {
    id: string
    status: string
    created_at: string
    flow_versions:
      | {
          flows:
            | { id: string; name: string; status: string; tenant_id: string }
            | { id: string; name: string; status: string; tenant_id: string }[]
            | null
        }
      | {
          flows:
            | { id: string; name: string; status: string; tenant_id: string }
            | { id: string; name: string; status: string; tenant_id: string }[]
            | null
        }[]
      | null
  }

  const instances = ((instanceRows ?? []) as RawInstance[]).filter((inst) => {
    const fv = Array.isArray(inst.flow_versions) ? inst.flow_versions[0] : inst.flow_versions
    if (!fv) return false
    const flow = Array.isArray(fv.flows) ? fv.flows[0] : fv.flows
    return flow?.tenant_id === tenantId
  })

  // ── 2. Compute stat card totals ───────────────────────────────────────────
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  let totalFlowsSet = new Set<string>()
  let activePending = 0
  let completedThisMonth = 0
  let cancelledTotal = 0

  // Also build per-flow breakdown map
  const flowMap = new Map<
    string,
    {
      name: string
      status: string
      total: number
      pending: number
      completed: number
      cancelled: number
      error: number
    }
  >()

  for (const inst of instances) {
    const fv = Array.isArray(inst.flow_versions) ? inst.flow_versions[0] : inst.flow_versions
    if (!fv) continue
    const flow = Array.isArray(fv.flows) ? fv.flows[0] : fv.flows
    if (!flow) continue

    totalFlowsSet.add(flow.id)

    // Per-flow map
    if (!flowMap.has(flow.id)) {
      flowMap.set(flow.id, {
        name: flow.name,
        status: flow.status,
        total: 0,
        pending: 0,
        completed: 0,
        cancelled: 0,
        error: 0,
      })
    }
    const entry = flowMap.get(flow.id)!
    entry.total++

    switch (inst.status) {
      case 'pending':
        entry.pending++
        activePending++
        break
      case 'completed':
        entry.completed++
        if (inst.created_at >= startOfMonth) completedThisMonth++
        break
      case 'cancelled':
        entry.cancelled++
        cancelledTotal++
        break
      case 'error':
        entry.error++
        break
    }
  }

  // Total distinct published flows for this tenant
  const { data: allFlows } = await db
    .from('flows')
    .select('id, name, status')
    .eq('tenant_id', tenantId)
    .order('name', { ascending: true })

  // Merge: flows that have never been triggered still appear in the table
  for (const f of allFlows ?? []) {
    if (!flowMap.has(f.id)) {
      flowMap.set(f.id, {
        name: f.name,
        status: f.status,
        total: 0,
        pending: 0,
        completed: 0,
        cancelled: 0,
        error: 0,
      })
    }
  }

  const totalFlowCount = (allFlows ?? []).length

  const statCards: StatCard[] = [
    {
      label: 'Total Flows',
      value: totalFlowCount,
      icon: GitBranch,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      description: 'Flows created in your workspace',
    },
    {
      label: 'Active Instances',
      value: activePending,
      icon: Activity,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
      description: 'Instances currently in progress',
    },
    {
      label: 'Completed This Month',
      value: completedThisMonth,
      icon: CheckCircle2,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
      description: `Since ${now.toLocaleString('default', { month: 'long' })} 1`,
    },
    {
      label: 'Cancelled',
      value: cancelledTotal,
      icon: XCircle,
      color: 'text-red-500',
      bgColor: 'bg-red-50',
      description: 'Total cancelled all time',
    },
  ]

  const flowBreakdown: FlowRow[] = Array.from(flowMap.entries()).map(([id, v]) => ({
    id,
    name: v.name,
    status: v.status as 'draft' | 'published',
    total: v.total,
    pending: v.pending,
    completed: v.completed,
    cancelled: v.cancelled,
    error: v.error,
  }))
  // Sort: most instances first
  flowBreakdown.sort((a, b) => b.total - a.total)

  // ── 3. Pending-at-who: step_instances that are pending for this tenant ─────
  // Join: step_instances → flow_instances → flow_versions → flows(tenant_id)
  // We only want pending steps where the flow instance is also still pending.
  const { data: pendingSteps, error: pendingError } = await db
    .from('step_instances')
    .select(
      `
      id,
      assigned_to,
      created_at,
      flow_instances!instance_id (
        status,
        flow_versions!flow_version_id (
          flows!flow_id ( tenant_id )
        )
      )
    `
    )
    .eq('status', 'pending')

  if (pendingError) throw new Error(pendingError.message)

  type RawPendingStep = {
    id: string
    assigned_to: string | null
    created_at: string
    flow_instances:
      | {
          status: string
          flow_versions:
            | { flows: { tenant_id: string } | { tenant_id: string }[] | null }
            | { flows: { tenant_id: string } | { tenant_id: string }[] | null }[]
            | null
        }
      | {
          status: string
          flow_versions:
            | { flows: { tenant_id: string } | { tenant_id: string }[] | null }
            | { flows: { tenant_id: string } | { tenant_id: string }[] | null }[]
            | null
        }[]
      | null
  }

  // Filter to this tenant + only instances still pending
  const tenantPendingSteps = ((pendingSteps ?? []) as RawPendingStep[]).filter((step) => {
    const fi = Array.isArray(step.flow_instances) ? step.flow_instances[0] : step.flow_instances
    if (!fi || fi.status !== 'pending') return false
    const fv = Array.isArray(fi.flow_versions) ? fi.flow_versions[0] : fi.flow_versions
    if (!fv) return false
    const flow = Array.isArray(fv.flows) ? fv.flows[0] : fv.flows
    return flow?.tenant_id === tenantId
  })

  // Aggregate by assigned_to
  const userPendingMap = new Map<string, { count: number; oldest: string }>()
  for (const step of tenantPendingSteps) {
    if (!step.assigned_to) continue
    const existing = userPendingMap.get(step.assigned_to)
    if (!existing) {
      userPendingMap.set(step.assigned_to, { count: 1, oldest: step.created_at })
    } else {
      existing.count++
      if (step.created_at < existing.oldest) existing.oldest = step.created_at
    }
  }

  // Resolve user names
  const assigneeIds = Array.from(userPendingMap.keys())
  let userNameMap: Record<string, { name: string; email: string }> = {}
  if (assigneeIds.length > 0) {
    const { data: users } = await db
      .from('users')
      .select('id, full_name, email')
      .in('id', assigneeIds)
    userNameMap = Object.fromEntries(
      (users ?? []).map((u: { id: string; full_name: string | null; email: string }) => [
        u.id,
        { name: u.full_name ?? u.email, email: u.email },
      ])
    )
  }

  const pendingByUser: PendingUserRow[] = Array.from(userPendingMap.entries())
    .map(([userId, { count, oldest }]) => ({
      userId,
      userName: userNameMap[userId]?.name ?? 'Unknown',
      email: userNameMap[userId]?.email ?? '',
      pendingCount: count,
      oldestPendingDate: oldest,
    }))
    .sort((a, b) => b.pendingCount - a.pendingCount)

  return { statCards, flowBreakdown, pendingByUser }
}

// ─── Helper: format relative time ────────────────────────────────────────────

function relativeAge(isoDate: string | null): string {
  if (!isoDate) return '—'
  const diffMs = Date.now() - new Date(isoDate).getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return '1 day ago'
  if (diffDays < 30) return `${diffDays} days ago`
  const diffMonths = Math.floor(diffDays / 30)
  return diffMonths === 1 ? '1 month ago' : `${diffMonths} months ago`
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const { user, claims } = await getSessionClaims()
  if (!user) redirect('/login')
  if (claims.role !== 'admin') redirect('/unauthorized')
  if (!claims.tenant_id) redirect('/login')

  const { statCards, flowBreakdown, pendingByUser } = await getDashboardData(claims.tenant_id)

  return (
    <div className="flex-1 space-y-8 p-6 md:p-8">
      {/* ── Page header ── */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Overview of flows and activity in your workspace.
        </p>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card) => {
          const Icon = card.icon
          return (
            <div key={card.label} className="rounded-lg border border-border bg-card p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{card.label}</p>
                  <p className="mt-1 text-3xl font-bold tracking-tight text-foreground">
                    {card.value.toLocaleString()}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{card.description}</p>
                </div>
                <div className={`rounded-lg p-2.5 ${card.bgColor}`}>
                  <Icon className={`h-5 w-5 ${card.color}`} />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Per-flow breakdown table ── */}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-base font-semibold text-foreground">Flow Breakdown</h2>
          <span className="text-sm text-muted-foreground">— all instances by flow</span>
        </div>

        {flowBreakdown.length === 0 ? (
          <EmptyState
            icon={GitBranch}
            title="No flows yet"
            description="Create your first flow in the Flow Builder to see data here."
          />
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Flow Name
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Total</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    Pending
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    Completed
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    Cancelled
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {flowBreakdown.map((row) => (
                  <tr key={row.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">
                      <a
                        href={`/flows/${row.id}/edit`}
                        className="hover:underline hover:text-primary"
                      >
                        {row.name}
                      </a>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={row.status === 'published' ? 'default' : 'secondary'}
                        className="capitalize text-xs"
                      >
                        {row.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-foreground">
                      {row.total}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {row.pending > 0 ? (
                        <span className="font-medium text-amber-600">{row.pending}</span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {row.completed > 0 ? (
                        <span className="text-emerald-600">{row.completed}</span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {row.cancelled > 0 ? (
                        <span className="text-muted-foreground">{row.cancelled}</span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {row.error > 0 ? (
                        <span className="font-medium text-red-500">{row.error}</span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Pending at who table ── */}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-base font-semibold text-foreground">Pending at Who</h2>
          <span className="text-sm text-muted-foreground">— steps waiting on each person</span>
        </div>

        {pendingByUser.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title="No pending steps"
            description="All steps are either completed or no flows have been triggered yet."
          />
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Assignee
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Email</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    Pending Steps
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    Oldest Pending
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pendingByUser.map((row) => {
                  const age = relativeAge(row.oldestPendingDate)
                  const isOld =
                    row.oldestPendingDate !== null &&
                    Date.now() - new Date(row.oldestPendingDate).getTime() > 7 * 24 * 60 * 60 * 1000 // > 7 days
                  return (
                    <tr key={row.userId} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground">{row.userName}</td>
                      <td className="px-4 py-3 text-muted-foreground">{row.email}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        <span
                          className={
                            row.pendingCount >= 5
                              ? 'font-bold text-red-500'
                              : row.pendingCount >= 3
                                ? 'font-medium text-amber-600'
                                : 'text-foreground'
                          }
                        >
                          {row.pendingCount}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={isOld ? 'font-medium text-red-500' : 'text-muted-foreground'}
                        >
                          {isOld && <AlertCircle className="mr-1 inline h-3.5 w-3.5" />}
                          {age}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

// ─── Empty state component ────────────────────────────────────────────────────

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType
  title: string
  description: string
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card px-6 py-12 text-center">
      <div className="rounded-full bg-muted p-3">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="mt-3 text-sm font-medium text-foreground">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    </div>
  )
}
