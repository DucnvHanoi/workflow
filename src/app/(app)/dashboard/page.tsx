// FILE PATH: src/app/(app)/dashboard/page.tsx
// Admin dashboard — stat cards + per-flow breakdown + pending-at-who table.
// Pure server component: all queries run server-side via adminClient.
// Access: admin only (middleware already guards /dashboard).

import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionClaims } from '@/lib/supabase/auth-helpers'
import { Badge } from '@/components/ui/badge'
import {
  CheckCircle2,
  XCircle,
  GitBranch,
  Clock,
  AlertCircle,
  TrendingUp,
  PlayCircle,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type PeriodCounts = { triggered: number; completed: number; cancelled: number }

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
  oldestPendingDate: string | null
  overdueCount: number
  dueSoonCount: number
  sparkline: number[] // 7 values: index 0 = 6 days ago, index 6 = today
}

// ─── Period helpers ───────────────────────────────────────────────────────────

function getPeriodBounds(now: Date, period: string) {
  if (period === '7d') {
    const start = new Date(now.getTime() - 7 * 86_400_000)
    return {
      periodStart: start,
      prevStart: new Date(now.getTime() - 14 * 86_400_000),
      prevEnd: start,
      label: 'Last 7 days',
    }
  }
  if (period === '30d') {
    const start = new Date(now.getTime() - 30 * 86_400_000)
    return {
      periodStart: start,
      prevStart: new Date(now.getTime() - 60 * 86_400_000),
      prevEnd: start,
      label: 'Last 30 days',
    }
  }
  if (period === '90d') {
    const start = new Date(now.getTime() - 90 * 86_400_000)
    return {
      periodStart: start,
      prevStart: new Date(now.getTime() - 180 * 86_400_000),
      prevEnd: start,
      label: 'Last 90 days',
    }
  }
  // 'month' (default) — current calendar month
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  return {
    periodStart: start,
    prevStart,
    prevEnd: start,
    label: now.toLocaleString('en-GB', { month: 'long', year: 'numeric' }),
  }
}

// ─── Data fetching ────────────────────────────────────────────────────────────

async function getDashboardData(tenantId: string, period: string) {
  const db = createAdminClient()
  const now = new Date()
  const { periodStart, prevStart, prevEnd, label } = getPeriodBounds(now, period)

  const periodStartIso = periodStart.toISOString()
  const prevStartIso = prevStart.toISOString()
  const prevEndIso = prevEnd.toISOString()

  // ── 1. Flow instances from prevStart → now (covers both periods) ──────────
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

  type RawPendingStep = {
    id: string
    assigned_to: string | null
    created_at: string
    due_at: string | null
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

  const [
    { data: rawInstances, error: instanceError },
    { data: allFlows },
    { data: pendingSteps, error: pendingError },
  ] = await Promise.all([
    db
      .from('flow_instances')
      .select(
        `id, status, created_at,
        flow_versions!flow_version_id (
          flows!flow_id ( id, name, status, tenant_id )
        )`
      )
      .gte('created_at', prevStartIso),

    db.from('flows').select('id, name, status').eq('tenant_id', tenantId).order('name'),

    db
      .from('step_instances')
      .select(
        `id, assigned_to, created_at, due_at,
        flow_instances!instance_id (
          status,
          flow_versions!flow_version_id (
            flows!flow_id ( tenant_id )
          )
        )`
      )
      .eq('status', 'pending'),
  ])

  if (instanceError) throw new Error(instanceError.message)
  if (pendingError) throw new Error(pendingError.message)

  // ── 2. Filter instances to this tenant ───────────────────────────────────
  function getFlow(inst: RawInstance) {
    const fv = Array.isArray(inst.flow_versions) ? inst.flow_versions[0] : inst.flow_versions
    if (!fv) return null
    return Array.isArray(fv.flows) ? fv.flows[0] : fv.flows
  }

  const allTenantInstances = ((rawInstances ?? []) as RawInstance[]).filter(
    (i) => getFlow(i)?.tenant_id === tenantId
  )

  // ── 3. Split into current vs previous period ─────────────────────────────
  const currentInstances = allTenantInstances.filter((i) => i.created_at >= periodStartIso)
  const prevInstances = allTenantInstances.filter(
    (i) => i.created_at >= prevStartIso && i.created_at < prevEndIso
  )

  function countPeriod(insts: RawInstance[]): PeriodCounts {
    let triggered = 0,
      completed = 0,
      cancelled = 0
    for (const i of insts) {
      triggered++
      if (i.status === 'completed') completed++
      else if (i.status === 'cancelled') cancelled++
    }
    return { triggered, completed, cancelled }
  }

  const current = countPeriod(currentInstances)
  const previous = countPeriod(prevInstances)

  // ── 4. Period-filtered flow breakdown ─────────────────────────────────────
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

  for (const inst of currentInstances) {
    const flow = getFlow(inst)
    if (!flow) continue
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
    if (inst.status === 'pending') entry.pending++
    else if (inst.status === 'completed') entry.completed++
    else if (inst.status === 'cancelled') entry.cancelled++
    else if (inst.status === 'error') entry.error++
  }
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
  const flowBreakdown: FlowRow[] = Array.from(flowMap.entries())
    .map(([id, v]) => ({ id, ...v, status: v.status as 'draft' | 'published' }))
    .sort((a, b) => b.total - a.total)

  // ── 5. Pending step stats (live) — computes SLA overdue/due-soon ──────────
  const nowMs = now.getTime()
  const dueSoonMs = 24 * 60 * 60 * 1000
  let totalOverdue = 0
  let totalDueSoon = 0

  function getPendingStepTenantId(step: RawPendingStep): string | null {
    const fi = Array.isArray(step.flow_instances) ? step.flow_instances[0] : step.flow_instances
    if (!fi || fi.status !== 'pending') return null
    const fv = Array.isArray(fi.flow_versions) ? fi.flow_versions[0] : fi.flow_versions
    if (!fv) return null
    const flow = Array.isArray(fv.flows) ? fv.flows[0] : fv.flows
    return flow?.tenant_id ?? null
  }

  const tenantPendingSteps = ((pendingSteps ?? []) as RawPendingStep[]).filter(
    (s) => getPendingStepTenantId(s) === tenantId
  )

  const userPendingMap = new Map<
    string,
    { count: number; oldest: string; overdueCount: number; dueSoonCount: number }
  >()

  for (const step of tenantPendingSteps) {
    if (!step.assigned_to) continue
    const dueMs = step.due_at ? new Date(step.due_at).getTime() : null
    const isOverdue = dueMs !== null && dueMs < nowMs
    const isDueSoon = dueMs !== null && !isOverdue && dueMs - nowMs < dueSoonMs
    if (isOverdue) totalOverdue++
    if (isDueSoon) totalDueSoon++
    const existing = userPendingMap.get(step.assigned_to)
    if (!existing) {
      userPendingMap.set(step.assigned_to, {
        count: 1,
        oldest: step.created_at,
        overdueCount: isOverdue ? 1 : 0,
        dueSoonCount: isDueSoon ? 1 : 0,
      })
    } else {
      existing.count++
      if (step.created_at < existing.oldest) existing.oldest = step.created_at
      if (isOverdue) existing.overdueCount++
      if (isDueSoon) existing.dueSoonCount++
    }
  }

  // ── 6. Sparklines: daily step assignments over last 7 days ───────────────
  const sparklineStart = new Date(nowMs - 6 * 86_400_000).toISOString()
  const allInstanceIds = Array.from(new Set(allTenantInstances.map((i) => i.id)))
  const sparklineMap = new Map<string, number[]>()

  if (allInstanceIds.length > 0) {
    const { data: recentSteps } = await db
      .from('step_instances')
      .select('assigned_to, created_at')
      .in('instance_id', allInstanceIds)
      .gte('created_at', sparklineStart)
      .not('assigned_to', 'is', null)

    for (const step of recentSteps ?? []) {
      if (!step.assigned_to) continue
      const dayDiff = Math.floor((nowMs - new Date(step.created_at).getTime()) / 86_400_000)
      const idx = 6 - dayDiff
      if (idx < 0 || idx > 6) continue
      if (!sparklineMap.has(step.assigned_to))
        sparklineMap.set(step.assigned_to, [0, 0, 0, 0, 0, 0, 0])
      sparklineMap.get(step.assigned_to)![idx]++
    }
  }

  // ── 7. Resolve assignee names + build final bottleneck rows ───────────────
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
    .map(([userId, { count, oldest, overdueCount, dueSoonCount }]) => ({
      userId,
      userName: userNameMap[userId]?.name ?? 'Unknown',
      email: userNameMap[userId]?.email ?? '',
      pendingCount: count,
      oldestPendingDate: oldest,
      overdueCount,
      dueSoonCount,
      sparkline: sparklineMap.get(userId) ?? [0, 0, 0, 0, 0, 0, 0],
    }))
    .sort((a, b) => b.pendingCount - a.pendingCount)

  return {
    totalFlows: (allFlows ?? []).length,
    totalOverdue,
    totalDueSoon,
    current,
    previous,
    periodLabel: label,
    flowBreakdown,
    pendingByUser,
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeAge(isoDate: string | null): string {
  if (!isoDate) return '—'
  const diffDays = Math.floor((Date.now() - new Date(isoDate).getTime()) / 86_400_000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return '1 day ago'
  if (diffDays < 30) return `${diffDays} days ago`
  const months = Math.floor(diffDays / 30)
  return months === 1 ? '1 month ago' : `${months} months ago`
}

function deltaPct(current: number, previous: number): { label: string; positive: boolean } | null {
  if (previous === 0 && current === 0) return null
  if (previous === 0) return { label: `+${current} new`, positive: true }
  const pct = Math.round(((current - previous) / previous) * 100)
  return { label: `${pct >= 0 ? '+' : ''}${pct}%`, positive: pct >= 0 }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Sparkline({ data }: { data: number[] }) {
  const allZero = data.every((v) => v === 0)
  if (allZero) return <span className="text-xs text-muted-foreground/40">—</span>
  const max = Math.max(...data, 1)
  const W = 56
  const H = 18
  const step = W / (data.length - 1)
  const points = data
    .map((v, i) => `${(i * step).toFixed(1)},${(H - 2 - (v / max) * (H - 4)).toFixed(1)}`)
    .join(' ')
  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      className="inline-block align-middle text-muted-foreground"
      aria-hidden
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

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

// ─── Period selector ──────────────────────────────────────────────────────────

const PERIOD_OPTIONS = [
  { label: '7 days', value: '7d' },
  { label: 'This month', value: 'month' },
  { label: '30 days', value: '30d' },
  { label: '90 days', value: '90d' },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { period?: string }
}) {
  const { user, claims } = await getSessionClaims()
  if (!user) redirect('/login')
  if (claims.role !== 'admin') redirect('/unauthorized')
  if (!claims.tenant_id) redirect('/login')

  const raw = searchParams.period
  const period = ['7d', 'month', '30d', '90d'].includes(raw ?? '') ? (raw as string) : 'month'

  const {
    totalFlows,
    totalOverdue,
    totalDueSoon,
    current,
    previous,
    periodLabel,
    flowBreakdown,
    pendingByUser,
  } = await getDashboardData(claims.tenant_id, period)

  return (
    <div className="flex-1 space-y-8 p-6 md:p-8">
      {/* ── Header + period selector ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Overview of flows and activity in your workspace.
          </p>
        </div>
        <div className="flex gap-1 rounded-lg border bg-muted/40 p-1 w-fit shrink-0">
          {PERIOD_OPTIONS.map(({ label, value }) => (
            <a
              key={value}
              href={`?period=${value}`}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                period === value
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {label}
            </a>
          ))}
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {/* Total Flows — workspace total, no period filter */}
        <StatCard
          label="Total Flows"
          value={totalFlows}
          icon={GitBranch}
          color="text-blue-600"
          bgColor="bg-blue-50"
          description="Flows created in your workspace"
        />

        {/* Triggered — period-filtered with delta */}
        <StatCard
          label="Triggered"
          value={current.triggered}
          icon={PlayCircle}
          color="text-amber-600"
          bgColor="bg-amber-50"
          description={`New runs — ${periodLabel}`}
          delta={deltaPct(current.triggered, previous.triggered)}
        />

        {/* Completed — period-filtered with delta */}
        <StatCard
          label="Completed"
          value={current.completed}
          icon={CheckCircle2}
          color="text-emerald-600"
          bgColor="bg-emerald-50"
          description={`Completed runs — ${periodLabel}`}
          delta={deltaPct(current.completed, previous.completed)}
        />

        {/* Cancelled — period-filtered with delta */}
        <StatCard
          label="Cancelled"
          value={current.cancelled}
          icon={XCircle}
          color="text-red-500"
          bgColor="bg-red-50"
          description={`Cancelled runs — ${periodLabel}`}
          delta={deltaPct(current.cancelled, previous.cancelled)}
        />

        {/* SLA Breached — live snapshot */}
        <StatCard
          label="SLA Breached"
          value={totalOverdue}
          icon={AlertCircle}
          color="text-red-500"
          bgColor="bg-red-50"
          description="Pending steps past their due date"
        />

        {/* Due Soon — live snapshot */}
        <StatCard
          label="Due Soon"
          value={totalDueSoon}
          icon={Clock}
          color="text-amber-600"
          bgColor="bg-amber-50"
          description="Pending steps due within 24 hours"
        />
      </div>

      {/* ── Per-flow breakdown table ── */}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-base font-semibold text-foreground">Flow Breakdown</h2>
          <span className="text-sm text-muted-foreground">— {periodLabel}</span>
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
                      <span className="text-muted-foreground">{row.cancelled || 0}</span>
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
                    Pending
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    Overdue
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    Due Soon
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Oldest</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    7-day trend
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pendingByUser.map((row) => {
                  const age = relativeAge(row.oldestPendingDate)
                  const isOld =
                    row.oldestPendingDate !== null &&
                    Date.now() - new Date(row.oldestPendingDate).getTime() > 7 * 86_400_000
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
                      <td className="px-4 py-3 text-right tabular-nums">
                        {row.overdueCount > 0 ? (
                          <span className="font-medium text-red-500">{row.overdueCount}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {row.dueSoonCount > 0 ? (
                          <span className="font-medium text-amber-600">{row.dueSoonCount}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={isOld ? 'font-medium text-red-500' : 'text-muted-foreground'}
                        >
                          {isOld && <AlertCircle className="mr-1 inline h-3.5 w-3.5" />}
                          {age}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Sparkline data={row.sparkline} />
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

// ─── Stat card component ──────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  bgColor,
  description,
  delta,
}: {
  label: string
  value: number
  icon: React.ElementType
  color: string
  bgColor: string
  description: string
  delta?: { label: string; positive: boolean } | null
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="mt-1 text-3xl font-bold tracking-tight text-foreground">
            {value.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          {delta && (
            <p
              className={`mt-1.5 text-xs font-medium ${delta.positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}
            >
              {delta.label} vs prev period
            </p>
          )}
        </div>
        <div className={`rounded-lg p-2.5 ${bgColor} shrink-0 ml-3`}>
          <Icon className={`h-5 w-5 ${color}`} />
        </div>
      </div>
    </div>
  )
}
