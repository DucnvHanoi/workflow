'use client'

import { Fragment, useState } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronRight, Lock } from 'lucide-react'
import type { FlowStat } from './page'

function LastTriggeredCell({ iso }: { iso: string | null }) {
  if (!iso) {
    return <span className="text-xs font-medium text-red-500">Never</span>
  }
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  let label: string
  if (days === 0) label = 'Today'
  else if (days === 1) label = '1d ago'
  else if (days < 30) label = `${days}d ago`
  else if (days < 365) label = `${Math.floor(days / 30)}mo ago`
  else label = `${Math.floor(days / 365)}y ago`

  const cls =
    days >= 30
      ? 'text-xs font-medium text-red-500'
      : days >= 7
        ? 'text-xs font-medium text-amber-600'
        : 'text-xs text-muted-foreground'

  return <span className={cls}>{label}</span>
}

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

function pct(part: number, total: number): number {
  return total === 0 ? 0 : Math.round((part / total) * 100)
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

function RateCell({
  rate,
  count,
  warnAt,
  dangerAt,
}: {
  rate: number
  count: number
  warnAt?: number
  dangerAt?: number
}) {
  const p = Math.round(rate * 100)
  const cls =
    dangerAt !== undefined && p >= dangerAt
      ? 'text-destructive font-semibold'
      : warnAt !== undefined && p >= warnAt
        ? 'text-yellow-600 dark:text-yellow-400 font-medium'
        : 'text-foreground'
  return (
    <span>
      <span className={`tabular-nums ${cls}`}>{p}%</span>
      <span className="text-muted-foreground ml-1.5 text-xs">({count})</span>
    </span>
  )
}

// ─── Period tabs ──────────────────────────────────────────────────────────────

const PERIODS = [
  { label: '7 days', value: '7' },
  { label: '30 days', value: '30' },
  { label: '90 days', value: '90' },
  { label: 'All time', value: 'all' },
]

// ─── Main component ───────────────────────────────────────────────────────────

export default function FlowsReportClient({
  flows,
  period,
  maxDays,
}: {
  flows: FlowStat[]
  period: string
  maxDays: number | null
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  function toggle(flowId: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(flowId)) next.delete(flowId)
      else next.add(flowId)
      return next
    })
  }

  const totalRuns = flows.reduce((s, f) => s + f.total, 0)
  const totalCompleted = flows.reduce((s, f) => s + f.completed, 0)
  const flowsWithStepData = flows.filter((f) => f.steps.length > 0).length

  const completedWithCycle = flows.filter((f) => f.avgCycleTimeHours !== null)
  const overallAvgCycle =
    completedWithCycle.length > 0
      ? completedWithCycle.reduce((s, f) => s + (f.avgCycleTimeHours ?? 0), 0) /
        completedWithCycle.length
      : null

  return (
    <div className="space-y-6">
      {/* ── Period selector ─────────────────────────────────────────────────── */}
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

      {/* ── Summary stat cards ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Runs"
          value={totalRuns.toLocaleString()}
          sub={`across ${flows.length} flow${flows.length !== 1 ? 's' : ''}`}
        />
        <StatCard
          label="Completed"
          value={totalCompleted.toLocaleString()}
          sub={`${pct(totalCompleted, totalRuns)}% completion rate`}
          accent="green"
        />
        <StatCard
          label="Avg Cycle Time"
          value={overallAvgCycle !== null ? formatDuration(overallAvgCycle) : '—'}
          sub="across all completed runs"
        />
        <StatCard
          label="Bottleneck Data"
          value={String(flowsWithStepData)}
          sub={`flow${flowsWithStepData !== 1 ? 's' : ''} with step timing`}
        />
      </div>

      {/* ── No data state ────────────────────────────────────────────────────── */}
      {flows.length === 0 && (
        <div className="rounded-xl border bg-card px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            No flow instances found for the selected period.
          </p>
        </div>
      )}

      {/* ── Per-flow table ───────────────────────────────────────────────────── */}
      {flows.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Per-Flow Breakdown
          </h2>
          <div className="rounded-xl border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 w-8" />
                  <th className="px-4 py-3 text-left font-medium">Flow</th>
                  <th className="px-4 py-3 text-right font-medium">Runs</th>
                  <th className="px-4 py-3 text-right font-medium">Completed</th>
                  <th className="px-4 py-3 text-right font-medium">Cancelled</th>
                  <th className="px-4 py-3 text-right font-medium">Errors</th>
                  <th className="px-4 py-3 text-right font-medium">Avg Cycle</th>
                  <th className="px-4 py-3 text-right font-medium">Last Triggered</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {flows.map((flow) => {
                  const isExpanded = expanded.has(flow.flowId)
                  const hasSteps = flow.steps.length > 0
                  return (
                    <Fragment key={flow.flowId}>
                      <tr
                        className={`hover:bg-muted/20 transition-colors ${hasSteps ? 'cursor-pointer' : ''}`}
                        onClick={() => hasSteps && toggle(flow.flowId)}
                      >
                        <td className="px-4 py-3 text-muted-foreground">
                          {hasSteps ? (
                            isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )
                          ) : (
                            <span className="block h-4 w-4" />
                          )}
                        </td>
                        <td className="px-4 py-3 font-medium">{flow.flowName}</td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {flow.total.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <RateCell rate={flow.completionRate} count={flow.completed} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <RateCell
                            rate={flow.cancellationRate}
                            count={flow.cancelled}
                            warnAt={20}
                            dangerAt={40}
                          />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <RateCell
                            rate={flow.errorRate}
                            count={flow.error}
                            warnAt={5}
                            dangerAt={15}
                          />
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                          {flow.avgCycleTimeHours !== null
                            ? formatDuration(flow.avgCycleTimeHours)
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <LastTriggeredCell iso={flow.lastTriggeredAt} />
                        </td>
                      </tr>

                      {isExpanded && hasSteps && (
                        <tr>
                          <td colSpan={8} className="bg-muted/10 p-0">
                            <div className="px-14 py-3 space-y-2">
                              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                Step bottleneck — median wait time per step (sorted slowest first)
                              </p>
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="text-muted-foreground border-b border-border/50">
                                    <th className="text-left pb-1.5 font-medium">Step</th>
                                    <th className="text-right pb-1.5 font-medium">Completions</th>
                                    <th className="text-right pb-1.5 font-medium">Median Wait</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-border/30">
                                  {flow.steps.map((s) => (
                                    <tr key={s.stepId}>
                                      <td className="py-1.5 text-foreground">{s.stepLabel}</td>
                                      <td className="py-1.5 text-right tabular-nums text-muted-foreground">
                                        {s.totalCompletions}
                                      </td>
                                      <td
                                        className={`py-1.5 text-right tabular-nums font-medium ${
                                          s.medianWaitHours > 24
                                            ? 'text-destructive'
                                            : s.medianWaitHours > 8
                                              ? 'text-yellow-600 dark:text-yellow-400'
                                              : 'text-foreground'
                                        }`}
                                      >
                                        {formatDuration(s.medianWaitHours)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
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
