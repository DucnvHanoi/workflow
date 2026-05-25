// FILE PATH: src/app/(app)/departments/workload/page.tsx
// Admin-only. Shows pending workflow steps aggregated by department.
// Middleware already guards /departments/* for admin; page also guards explicitly.

import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionClaims } from '@/lib/supabase/auth-helpers'
import { buildDepartmentTree, flattenTree, type FlatDepartment } from '@/lib/departments/tree'
import { AlertCircle, Building2 } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type WorkloadMetrics = {
  pendingCount: number
  overdueCount: number
  dueSoonCount: number
  oldestPendingDate: string | null
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

const INDENT = ['', 'pl-0', 'pl-6', 'pl-12'] as const

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

export default async function DepartmentWorkloadPage() {
  const { user, claims } = await getSessionClaims()
  if (!user) redirect('/login')
  if (claims.role !== 'admin') redirect('/unauthorized')

  const db = createAdminClient()

  // Fetch departments, users, and pending steps in parallel
  const [{ data: deptRows }, { data: userRows }, { data: pendingSteps }] = await Promise.all([
    db
      .from('departments')
      .select('id, name, parent_id, created_at, head_user_id')
      .eq('tenant_id', claims.tenant_id!),

    db
      .from('users')
      .select('id, full_name, email, department_id')
      .eq('tenant_id', claims.tenant_id!),

    db
      .from('step_instances')
      .select(
        `
        id,
        assigned_to,
        created_at,
        due_at,
        flow_instances!instance_id (
          status,
          flow_versions!flow_version_id (
            flows!flow_id ( tenant_id )
          )
        )
      `
      )
      .eq('status', 'pending'),
  ])

  // Build lookup maps
  const userMap = new Map((userRows ?? []).map((u) => [u.id, u]))

  const memberCountMap: Record<string, number> = {}
  for (const u of userRows ?? []) {
    if (u.department_id) {
      memberCountMap[u.department_id] = (memberCountMap[u.department_id] ?? 0) + 1
    }
  }

  // FlatDepartment array for tree builder
  const flat: FlatDepartment[] = (deptRows ?? []).map((d) => {
    const head = d.head_user_id ? (userMap.get(d.head_user_id) ?? null) : null
    return {
      id: d.id,
      name: d.name,
      parent_id: d.parent_id,
      created_at: d.created_at,
      userCount: memberCountMap[d.id] ?? 0,
      head_user_id: d.head_user_id ?? null,
      head_name: head ? (head.full_name ?? head.email) : null,
    }
  })

  // Aggregate pending steps by department
  const nowMs = Date.now()
  const dueSoonThreshold = 24 * 60 * 60 * 1000
  const workloadMap = new Map<string, WorkloadMetrics>()

  for (const step of (pendingSteps ?? []) as RawPendingStep[]) {
    // Tenant + active-instance filter
    const fi = Array.isArray(step.flow_instances) ? step.flow_instances[0] : step.flow_instances
    if (!fi || fi.status !== 'pending') continue
    const fv = Array.isArray(fi.flow_versions) ? fi.flow_versions[0] : fi.flow_versions
    if (!fv) continue
    const flow = Array.isArray(fv.flows) ? fv.flows[0] : fv.flows
    if (flow?.tenant_id !== claims.tenant_id) continue

    if (!step.assigned_to) continue
    const assignee = userMap.get(step.assigned_to)
    if (!assignee?.department_id) continue

    const deptId = assignee.department_id
    const dueAt = step.due_at ? new Date(step.due_at).getTime() : null
    const isOverdue = dueAt !== null && dueAt < nowMs
    const isDueSoon = dueAt !== null && !isOverdue && dueAt - nowMs < dueSoonThreshold

    const entry = workloadMap.get(deptId)
    if (!entry) {
      workloadMap.set(deptId, {
        pendingCount: 1,
        overdueCount: isOverdue ? 1 : 0,
        dueSoonCount: isDueSoon ? 1 : 0,
        oldestPendingDate: step.created_at,
      })
    } else {
      entry.pendingCount++
      if (isOverdue) entry.overdueCount++
      if (isDueSoon) entry.dueSoonCount++
      if (!entry.oldestPendingDate || step.created_at < entry.oldestPendingDate) {
        entry.oldestPendingDate = step.created_at
      }
    }
  }

  const rows = flattenTree(buildDepartmentTree(flat))

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Department Workload</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Pending workflow steps aggregated by department.
        </p>
      </div>

      {rows.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Department
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Head</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Members</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Pending</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Overdue</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Due Soon</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                  Oldest Pending
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => {
                const metrics = workloadMap.get(row.id)
                const pending = metrics?.pendingCount ?? 0
                const overdue = metrics?.overdueCount ?? 0
                const dueSoon = metrics?.dueSoonCount ?? 0
                const oldest = metrics?.oldestPendingDate ?? null
                const isOld =
                  oldest !== null &&
                  Date.now() - new Date(oldest).getTime() > 7 * 24 * 60 * 60 * 1000

                return (
                  <tr key={row.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">
                      <span className={INDENT[row.depth - 1]}>
                        {row.depth > 1 && <span className="mr-1 text-muted-foreground">└</span>}
                        {row.name}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{row.head_name ?? '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-foreground">
                      {row.userCount}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <span
                        className={
                          pending >= 5
                            ? 'font-bold text-red-500'
                            : pending >= 3
                              ? 'font-medium text-amber-600'
                              : pending > 0
                                ? 'text-foreground'
                                : 'text-muted-foreground'
                        }
                      >
                        {pending > 0 ? pending : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {overdue > 0 ? (
                        <span className="font-medium text-red-500">{overdue}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {dueSoon > 0 ? (
                        <span className="font-medium text-amber-600">{dueSoon}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={isOld ? 'font-medium text-red-500' : 'text-muted-foreground'}
                      >
                        {isOld && <AlertCircle className="mr-1 inline h-3.5 w-3.5" />}
                        {relativeAge(oldest)}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card px-6 py-12 text-center">
      <div className="rounded-full bg-muted p-3">
        <Building2 className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="mt-3 text-sm font-medium text-foreground">No departments yet</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Create departments and assign users to see workload data here.
      </p>
    </div>
  )
}
