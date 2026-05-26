'use client'

import { Fragment, useState } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronRight, Download, Lock } from 'lucide-react'
import type { FlowSLAStat, StepSLAStat } from './page'

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

function pctStr(rate: number): string {
  return `${Math.round(rate * 100)}%`
}

function breachClass(rate: number): string {
  const p = rate * 100
  if (p > 20) return 'text-destructive font-semibold'
  if (p > 10) return 'text-yellow-600 dark:text-yellow-400 font-medium'
  return 'text-green-600 dark:text-green-400'
}

// ─── CSV export ───────────────────────────────────────────────────────────────

function escapeCsv(v: string): string {
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

function handleExport(flows: FlowSLAStat[], period: string) {
  const headers = [
    'Flow',
    'Step',
    'On-time',
    'Breached (late)',
    'Currently Overdue',
    'Not Yet Due',
    'Breach Rate %',
    'Escalated',
  ]
  const rows: string[][] = []

  for (const flow of flows) {
    for (const step of flow.steps) {
      const resolved = step.onTime + step.breached
      rows.push([
        flow.flowName,
        step.stepLabel,
        String(step.onTime),
        String(step.breached),
        String(step.currentlyOverdue),
        String(step.notYetDue),
        resolved > 0 ? pctStr(step.breachRate) : '—',
        String(flow.escalation.escalatedCount > 0 ? flow.escalation.escalatedCount : 0),
      ])
    }
  }

  const label = period === 'all' ? 'all-time' : `last-${period}d`
  const date = new Date().toISOString().split('T')[0]
  const csv = '﻿' + [headers, ...rows].map((r) => r.map(escapeCsv).join(',')).join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `sla-adherence-${label}-${date}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
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

function StepRow({ step }: { step: StepSLAStat }) {
  const resolved = step.onTime + step.breached
  return (
    <tr>
      <td className="py-1.5 text-foreground">{step.stepLabel}</td>
      <td className="py-1.5 text-right tabular-nums text-green-600 dark:text-green-400">
        {step.onTime}
      </td>
      <td className="py-1.5 text-right tabular-nums text-destructive">{step.breached}</td>
      <td className="py-1.5 text-right tabular-nums text-yellow-600 dark:text-yellow-400">
        {step.currentlyOverdue > 0 ? step.currentlyOverdue : '—'}
      </td>
      <td
        className={`py-1.5 text-right tabular-nums font-medium ${resolved > 0 ? breachClass(step.breachRate) : 'text-muted-foreground'}`}
      >
        {resolved > 0 ? pctStr(step.breachRate) : '—'}
      </td>
    </tr>
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

export default function SLAReportClient({
  flows,
  period,
  maxDays,
}: {
  flows: FlowSLAStat[]
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

  const totalOnTime = flows.reduce((s, f) => s + f.onTime, 0)
  const totalBreached = flows.reduce((s, f) => s + f.breached, 0)
  const totalOverdue = flows.reduce((s, f) => s + f.currentlyOverdue, 0)
  const totalResolved = totalOnTime + totalBreached
  const overallBreachRate = totalResolved > 0 ? totalBreached / totalResolved : null
  const totalEscalated = flows.reduce((s, f) => s + f.escalation.escalatedCount, 0)

  return (
    <div className="space-y-6">
      {/* ── Period selector + Export ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4">
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

        {flows.length > 0 && (
          <button
            onClick={() => handleExport(flows, period)}
            className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
        )}
      </div>

      {/* ── Stat cards ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="On-time Rate"
          value={overallBreachRate !== null ? pctStr(1 - overallBreachRate) : '—'}
          sub={`${totalOnTime.toLocaleString()} of ${totalResolved.toLocaleString()} resolved`}
          accent={
            overallBreachRate === null
              ? undefined
              : overallBreachRate > 0.2
                ? 'red'
                : overallBreachRate > 0.1
                  ? 'amber'
                  : 'green'
          }
        />
        <StatCard
          label="Breached (late)"
          value={totalBreached.toLocaleString()}
          sub="completed after deadline"
          accent={totalBreached > 0 ? 'red' : undefined}
        />
        <StatCard
          label="Currently Overdue"
          value={totalOverdue.toLocaleString()}
          sub="pending and past due"
          accent={totalOverdue > 0 ? 'amber' : undefined}
        />
        <StatCard
          label="Escalated"
          value={totalEscalated.toLocaleString()}
          sub={`across ${flows.length} flow${flows.length !== 1 ? 's' : ''}`}
        />
      </div>

      {/* ── No data state ────────────────────────────────────────────────────── */}
      {flows.length === 0 && (
        <div className="rounded-xl border bg-card px-6 py-12 text-center space-y-2">
          <p className="text-sm text-muted-foreground">
            No SLA-configured steps found for the selected period.
          </p>
          <p className="text-xs text-muted-foreground">
            Set &ldquo;Due within&rdquo; deadlines on steps in the Flow Builder to track SLA
            adherence.
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
                  <th className="px-4 py-3 text-right font-medium">On-time</th>
                  <th className="px-4 py-3 text-right font-medium">Breached</th>
                  <th className="px-4 py-3 text-right font-medium">Overdue</th>
                  <th className="px-4 py-3 text-right font-medium">Breach Rate</th>
                  <th className="px-4 py-3 text-right font-medium">Escalated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {flows.map((flow) => {
                  const isExpanded = expanded.has(flow.flowId)
                  const resolved = flow.onTime + flow.breached

                  return (
                    <Fragment key={flow.flowId}>
                      <tr
                        className="hover:bg-muted/20 transition-colors cursor-pointer"
                        onClick={() => toggle(flow.flowId)}
                      >
                        <td className="px-4 py-3 text-muted-foreground">
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </td>
                        <td className="px-4 py-3 font-medium">{flow.flowName}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-green-600 dark:text-green-400">
                          {flow.onTime}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-destructive">
                          {flow.breached}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-yellow-600 dark:text-yellow-400">
                          {flow.currentlyOverdue > 0 ? flow.currentlyOverdue : '—'}
                        </td>
                        <td
                          className={`px-4 py-3 text-right tabular-nums ${resolved > 0 ? breachClass(flow.breachRate) : 'text-muted-foreground'}`}
                        >
                          {resolved > 0 ? pctStr(flow.breachRate) : '—'}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                          {flow.escalation.escalatedCount > 0
                            ? flow.escalation.escalatedCount
                            : '—'}
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr>
                          <td colSpan={7} className="bg-muted/10 p-0">
                            <div className="px-14 py-4 space-y-5">
                              {/* Step breakdown */}
                              {flow.steps.length > 0 ? (
                                <div className="space-y-2">
                                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                    Per-step SLA — sorted by breach rate
                                  </p>
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="text-muted-foreground border-b border-border/50">
                                        <th className="text-left pb-1.5 font-medium">Step</th>
                                        <th className="text-right pb-1.5 font-medium">On-time</th>
                                        <th className="text-right pb-1.5 font-medium">Breached</th>
                                        <th className="text-right pb-1.5 font-medium">Overdue</th>
                                        <th className="text-right pb-1.5 font-medium">
                                          Breach Rate
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/30">
                                      {flow.steps.map((s) => (
                                        <StepRow key={s.stepId} step={s} />
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                <p className="text-xs text-muted-foreground">
                                  No resolved step data yet.
                                </p>
                              )}

                              {/* Escalation effectiveness */}
                              <div className="space-y-1.5">
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                  Escalation Effectiveness
                                </p>
                                {flow.escalation.escalatedCount === 0 ? (
                                  <p className="text-xs text-muted-foreground">
                                    No escalations in this period.
                                  </p>
                                ) : (
                                  <div className="text-xs space-y-0.5">
                                    <p className="text-muted-foreground">
                                      <span className="font-medium text-foreground">
                                        {flow.escalation.escalatedCount}
                                      </span>{' '}
                                      step{flow.escalation.escalatedCount !== 1 ? 's' : ''} received
                                      an escalation.
                                    </p>
                                    {flow.escalation.escalatedAvgCompletionHours !== null && (
                                      <p className="text-muted-foreground">
                                        Escalated avg completion:{' '}
                                        <span className="font-medium text-foreground">
                                          {formatDuration(
                                            flow.escalation.escalatedAvgCompletionHours
                                          )}
                                        </span>
                                      </p>
                                    )}
                                    {flow.escalation.nonEscalatedBreachedAvgCompletionHours !==
                                      null && (
                                      <p className="text-muted-foreground">
                                        Non-escalated (breached) avg completion:{' '}
                                        <span className="font-medium text-foreground">
                                          {formatDuration(
                                            flow.escalation.nonEscalatedBreachedAvgCompletionHours
                                          )}
                                        </span>
                                      </p>
                                    )}
                                    {flow.escalation.escalatedAvgCompletionHours !== null &&
                                      flow.escalation.nonEscalatedBreachedAvgCompletionHours !==
                                        null && (
                                        <p
                                          className={`font-medium ${
                                            flow.escalation.escalatedAvgCompletionHours <
                                            flow.escalation.nonEscalatedBreachedAvgCompletionHours
                                              ? 'text-green-600 dark:text-green-400'
                                              : 'text-yellow-600 dark:text-yellow-400'
                                          }`}
                                        >
                                          {flow.escalation.escalatedAvgCompletionHours <
                                          flow.escalation.nonEscalatedBreachedAvgCompletionHours
                                            ? 'Escalation appears effective — escalated steps resolve faster.'
                                            : 'Escalation may not be shortening resolution time.'}
                                        </p>
                                      )}
                                  </div>
                                )}
                              </div>
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
