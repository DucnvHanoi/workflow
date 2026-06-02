import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionClaims } from '@/lib/supabase/auth-helpers'
import { getTenantLimits } from '@/lib/billing/limits'
import UsersReportClient from './users-report-client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UserStat {
  userId: string
  userName: string
  email: string
  totalAssigned: number
  completed: number
  pending: number
  completionRate: number
  avgCompletionHours: number | null
  lateCount: number
  onTimeCount: number
  lateRate: number
  lastActiveAt: string | null
}

// ─── Data fetching ────────────────────────────────────────────────────────────

async function getUserPerformanceData(tenantId: string, period: string): Promise<UserStat[]> {
  const db = createAdminClient()

  let periodStart: string | null = null
  if (period !== 'all') {
    const days = parseInt(period, 10)
    if (!isNaN(days) && days > 0) {
      const d = new Date()
      d.setDate(d.getDate() - days)
      periodStart = d.toISOString()
    }
  }

  // 1. Get tenant flow instance IDs (1-year lookback for tenant isolation)
  const oneYearAgoIso = new Date(Date.now() - 365 * 86_400_000).toISOString()

  type RawInst = {
    id: string
    flow_versions:
      | { flows: { tenant_id: string } | null }
      | { flows: { tenant_id: string } | null }[]
      | null
  }

  const { data: rawInstances } = await db
    .from('flow_instances')
    .select('id, flow_versions!flow_version_id(flows!flow_id(tenant_id))')
    .gte('created_at', oneYearAgoIso)

  const tenantInstanceIds = ((rawInstances ?? []) as unknown as RawInst[])
    .filter((i) => {
      const fv = Array.isArray(i.flow_versions) ? i.flow_versions[0] : i.flow_versions
      const flow = Array.isArray(fv?.flows) ? fv?.flows[0] : fv?.flows
      return flow?.tenant_id === tenantId
    })
    .map((i) => i.id)

  if (tenantInstanceIds.length === 0) return []

  // 2. Fetch step instances for tenant (period-filtered on step creation = when assigned)
  let q = db
    .from('step_instances')
    .select('assigned_to, status, created_at, completed_at, due_at')
    .in('instance_id', tenantInstanceIds)
    .not('assigned_to', 'is', null)

  if (periodStart) q = q.gte('created_at', periodStart)

  const { data: stepRows } = await q
  if (!stepRows || stepRows.length === 0) return []

  // 3. Aggregate per user
  type Accum = {
    totalAssigned: number
    completed: number
    pending: number
    cycleTimes: number[]
    lateCount: number
    onTimeCount: number
    lastActiveAt: string | null
  }

  const userMap = new Map<string, Accum>()

  for (const step of stepRows) {
    const uid = step.assigned_to as string
    if (!userMap.has(uid)) {
      userMap.set(uid, {
        totalAssigned: 0,
        completed: 0,
        pending: 0,
        cycleTimes: [],
        lateCount: 0,
        onTimeCount: 0,
        lastActiveAt: null,
      })
    }
    const acc = userMap.get(uid)!
    acc.totalAssigned++

    if (step.status === 'completed') {
      acc.completed++
      if (step.completed_at) {
        const hours =
          (new Date(step.completed_at).getTime() - new Date(step.created_at).getTime()) / 3_600_000
        if (hours >= 0) acc.cycleTimes.push(hours)
        if (!acc.lastActiveAt || step.completed_at > acc.lastActiveAt) {
          acc.lastActiveAt = step.completed_at
        }
        if (step.due_at) {
          if (step.completed_at > step.due_at) acc.lateCount++
          else acc.onTimeCount++
        }
      }
    } else if (step.status === 'pending') {
      acc.pending++
    }
  }

  // 4. Resolve user info
  const userIds = Array.from(userMap.keys())
  const { data: users } = await db.from('users').select('id, full_name, email').in('id', userIds)

  const userInfoMap = Object.fromEntries(
    (users ?? []).map((u: { id: string; full_name: string | null; email: string }) => [
      u.id,
      { name: u.full_name ?? u.email, email: u.email },
    ])
  )

  return Array.from(userMap.entries())
    .map(([userId, acc]) => {
      const dueTotal = acc.lateCount + acc.onTimeCount
      return {
        userId,
        userName: userInfoMap[userId]?.name ?? 'Unknown',
        email: userInfoMap[userId]?.email ?? '',
        totalAssigned: acc.totalAssigned,
        completed: acc.completed,
        pending: acc.pending,
        completionRate: acc.totalAssigned > 0 ? acc.completed / acc.totalAssigned : 0,
        avgCompletionHours:
          acc.cycleTimes.length > 0
            ? acc.cycleTimes.reduce((a, b) => a + b, 0) / acc.cycleTimes.length
            : null,
        lateCount: acc.lateCount,
        onTimeCount: acc.onTimeCount,
        lateRate: dueTotal > 0 ? acc.lateCount / dueTotal : 0,
        lastActiveAt: acc.lastActiveAt,
      }
    })
    .sort((a, b) => b.completed - a.completed)
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function UsersReportPage({
  searchParams,
}: {
  searchParams: { period?: string }
}) {
  const { user, claims } = await getSessionClaims()
  if (!user) redirect('/login')
  if (claims?.role !== 'admin') redirect('/tasks')
  if (!claims?.tenant_id) redirect('/tasks')

  const tenantId = claims.tenant_id as string
  const limits = await getTenantLimits(tenantId)
  const maxDays = limits.reportWindowDays

  function isAllowed(p: string) {
    if (maxDays === null) return true
    if (p === 'all') return false
    return parseInt(p, 10) <= maxDays
  }
  const raw = searchParams.period
  const period =
    ['7', '30', '90', 'all'].includes(raw ?? '') && isAllowed(raw ?? '') ? (raw as string) : '7'

  const users = await getUserPerformanceData(tenantId, period)

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 space-y-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">User Performance</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Task completion rates, response times, and on-time performance per team member.
        </p>
      </div>
      <UsersReportClient users={users} period={period} maxDays={maxDays} />
    </main>
  )
}
