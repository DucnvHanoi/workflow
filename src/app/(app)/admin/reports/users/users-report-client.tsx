'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Lock } from 'lucide-react'
import type { UserStat } from './page'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(hours: number): string {
  if (hours < 1 / 60) return '<1m'
  if (hours < 1) return `${Math.round(hours * 60)}m`
  if (hours < 24) {
    const h = Math.floor(hours)
    const m = Math.round((hours - h) * 60)
    return m > 0 ? `${h}h ${m}m` : `${h}h`
  }
  const d = Math.floor(hours / 24)
  const h = Math.round(hours % 24)
  return h > 0 ? `${d}d ${h}h` : `${d}d`
}

function pct(part: number, total: number): string {
  if (total === 0) return '—'
  return `${Math.round((part / total) * 100)}%`
}

function relativeDate(iso: string | null): string {
  if (!iso) return '—'
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  if (diff < 30) return `${diff}d ago`
  const m = Math.floor(diff / 30)
  return m === 1 ? '1 month ago' : `${m} months ago`
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string
  value: string
  sub?: string
  accent?: 'green' | 'amber' | 'red'
}) {
  const accentClass = {
    green: 'text-green-600 dark:text-green-400',
    amber: 'text-yellow-600 dark:text-yellow-400',
    red: 'text-destructive',
  }
  return (
    <div className="rounded-xl border bg-card p-5 space-y-1">
      <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">{label}</p>
      <p
        className={`text-2xl font-bold tabular-nums ${accent ? accentClass[accent] : 'text-foreground'}`}
      >
        {value}
      </p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}

// ─── Period tabs ──────────────────────────────────────────────────────────────

const PERIODS = [
  { label: '7 days', value: '7' },
  { label: '30 days', value: '30' },
  { label: '90 days', value: '90' },
  { label: 'All time', value: 'all' },
]

type SortKey = 'completed' | 'avgTime' | 'lateRate'

// ─── Main component ───────────────────────────────────────────────────────────

export default function UsersReportClient({
  users,
  period,
  maxDays,
}: {
  users: UserStat[]
  period: string
  maxDays: number | null
}) {
  const [sortBy, setSortBy] = useState<SortKey>('completed')

  const sorted = [...users].sort((a, b) => {
    if (sortBy === 'avgTime') {
      if (a.avgCompletionHours === null) return 1
      if (b.avgCompletionHours === null) return -1
      return a.avgCompletionHours - b.avgCompletionHours
    }
    if (sortBy === 'lateRate') return b.lateRate - a.lateRate
    return b.completed - a.completed
  })

  const totalActive = users.filter((u) => u.totalAssigned > 0).length
  const totalCompleted = users.reduce((s, u) => s + u.completed, 0)
  const avgTimes = users
    .filter((u) => u.avgCompletionHours !== null)
    .map((u) => u.avgCompletionHours!)
  const overallAvgTime =
    avgTimes.length > 0 ? avgTimes.reduce((a, b) => a + b, 0) / avgTimes.length : null
  const totalLate = users.reduce((s, u) => s + u.lateCount, 0)
  const totalDue = users.reduce((s, u) => s + u.lateCount + u.onTimeCount, 0)
  const overallOnTimeRate =
    totalDue > 0 ? Math.round(((totalDue - totalLate) / totalDue) * 100) : null

  const SORT_OPTIONS: { key: SortKey; label: string }[] = [
    { key: 'completed', label: 'Most done' },
    { key: 'avgTime', label: 'Fastest' },
    { key: 'lateRate', label: 'Late rate' },
  ]

  return (
    <div className="space-y-6">
      {/* ── Period selector ── */}
      <div className="space-y-2">
        <div className="flex gap-1 rounded-lg border bg-muted/40 p-1 w-fit">
          {PERIODS.map((p) => {
            const locked =
              maxDays !== null && (p.value === 'all' || parseInt(p.value, 10) > maxDays)
            if (locked) {
              return (
                <span
                  key={p.value}
                  title="Upgrade to Pro to unlock"
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium text-muted-foreground/50 cursor-not-allowed select-none"
                >
                  <Lock className="h-3 w-3" />
                  {p.label}
                </span>
              )
            }
            return (
              <Link
                key={p.value}
                href={`?period=${p.value}`}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  period === p.value
                    ? 'bg-background shadow-sm text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {p.label}
              </Link>
            )
          })}
        </div>
        {maxDays !== null && (
          <p className="text-xs text-muted-foreground">
            30-day, 90-day, and all-time reports are available on Pro.{' '}
            <Link
              href="/settings?tab=billing"
              className="text-indigo-600 hover:text-indigo-700 font-medium"
            >
              Upgrade →
            </Link>
          </p>
        )}
      </div>

      {/* ── Summary stat cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Active Users"
          value={String(totalActive)}
          sub={`of ${users.length} member${users.length !== 1 ? 's' : ''} with tasks`}
        />
        <StatCard
          label="Tasks Completed"
          value={totalCompleted.toLocaleString()}
          sub="in selected period"
          accent="green"
        />
        <StatCard
          label="Avg Completion Time"
          value={overallAvgTime !== null ? formatDuration(overallAvgTime) : '—'}
          sub="assignment to done"
        />
        <StatCard
          label="On-time Rate"
          value={overallOnTimeRate !== null ? `${overallOnTimeRate}%` : '—'}
          sub="tasks done by due date"
          accent={
            overallOnTimeRate === null
              ? undefined
              : overallOnTimeRate >= 80
                ? 'green'
                : overallOnTimeRate >= 60
                  ? 'amber'
                  : 'red'
          }
        />
      </div>

      {/* ── Empty state ── */}
      {users.length === 0 && (
        <div className="rounded-xl border bg-card px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">No task activity found for this period.</p>
        </div>
      )}

      {/* ── Per-user table ── */}
      {users.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Per-User Breakdown
            </h2>
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-muted-foreground">Sort:</span>
              {SORT_OPTIONS.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setSortBy(key)}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    sortBy === key
                      ? 'bg-foreground text-background font-medium'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">User</th>
                  <th className="px-4 py-3 text-right font-medium">Assigned</th>
                  <th className="px-4 py-3 text-right font-medium">Completed</th>
                  <th className="px-4 py-3 text-right font-medium">Pending</th>
                  <th className="px-4 py-3 text-right font-medium">Avg Time</th>
                  <th className="px-4 py-3 text-right font-medium">On-time</th>
                  <th className="px-4 py-3 text-right font-medium">Last Active</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sorted.map((u) => {
                  const dueTotal = u.lateCount + u.onTimeCount
                  const onTimeRate =
                    dueTotal > 0 ? Math.round((u.onTimeCount / dueTotal) * 100) : null
                  return (
                    <tr key={u.userId} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{u.userName}</div>
                        <div className="text-xs text-muted-foreground">{u.email}</div>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                        {u.totalAssigned}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        <span className="font-medium text-foreground">{u.completed}</span>
                        <span className="text-muted-foreground ml-1 text-xs">
                          ({pct(u.completed, u.totalAssigned)})
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {u.pending > 0 ? (
                          <span
                            className={
                              u.pending >= 5
                                ? 'font-bold text-red-500'
                                : u.pending >= 3
                                  ? 'font-medium text-amber-600'
                                  : 'text-foreground'
                            }
                          >
                            {u.pending}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                        {u.avgCompletionHours !== null ? formatDuration(u.avgCompletionHours) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {onTimeRate !== null ? (
                          <span
                            className={
                              onTimeRate < 60
                                ? 'font-semibold text-red-500'
                                : onTimeRate < 80
                                  ? 'font-medium text-amber-600'
                                  : 'font-medium text-emerald-600'
                            }
                          >
                            {onTimeRate}%
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                        {relativeDate(u.lastActiveAt)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
