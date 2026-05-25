import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionClaims } from '@/lib/supabase/auth-helpers'

// ─── Types ────────────────────────────────────────────────────────────────────

interface TenantRow {
  id: string
  name: string
  plan: string
}
interface ConfigRow {
  tenant_id: string
  ai_enabled: boolean
  provider: string
  use_own_key: boolean
  credit_limit_usd: number
  credit_used_usd: number
}
interface LogRow {
  tenant_id: string
  feature: string
  provider: string
  model: string
  cost_usd: number
  using_own_key: boolean
  created_at: string
}

interface TenantSummary {
  tenantId: string
  tenantName: string
  plan: string
  aiEnabled: boolean
  provider: string
  useOwnKey: boolean
  creditLimitUsd: number
  creditUsedUsd: number
  totalCalls: number
  totalCostUsd: number
  platformCostUsd: number
  thisMonthCostUsd: number
}

interface FeatureSummary {
  feature: string
  calls: number
  costUsd: number
}
interface ModelSummary {
  provider: string
  model: string
  calls: number
  costUsd: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const FEATURE_LABELS: Record<string, string> = {
  flow_builder: 'Flow Builder',
  form_suggestions: 'Form Suggestions',
  condition_parser: 'Condition Parser',
  trigger_assistant: 'Trigger Assistant',
}

function fmt(usd: number) {
  return usd < 0.01 ? `$${usd.toFixed(4)}` : `$${usd.toFixed(2)}`
}

function pct(part: number, total: number) {
  if (total === 0) return 0
  return Math.round((part / total) * 100)
}

// ─── Data fetching ────────────────────────────────────────────────────────────

async function getPlatformAIData() {
  const db = createAdminClient()

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const [{ data: tenants }, { data: configs }, { data: logs }] = await Promise.all([
    db.from('tenants').select('id, name, plan').order('name'),
    db
      .from('tenant_ai_configs')
      .select('tenant_id, ai_enabled, provider, use_own_key, credit_limit_usd, credit_used_usd'),
    db
      .from('ai_usage_logs')
      .select('tenant_id, feature, provider, model, cost_usd, using_own_key, created_at')
      .order('created_at', { ascending: false }),
  ])

  const allTenants = (tenants ?? []) as TenantRow[]
  const allConfigs = (configs ?? []) as ConfigRow[]
  const allLogs = (logs ?? []) as LogRow[]

  // ── Index configs by tenant ──────────────────────────────────────────────
  const configMap = new Map(allConfigs.map((c) => [c.tenant_id, c]))

  // ── Per-tenant summaries ─────────────────────────────────────────────────
  const tenantSummaries: TenantSummary[] = allTenants.map((t) => {
    const cfg = configMap.get(t.id)
    const tLogs = allLogs.filter((l) => l.tenant_id === t.id)
    const tMonthLogs = tLogs.filter((l) => l.created_at >= monthStart)

    const totalCostUsd = tLogs.reduce((s, l) => s + Number(l.cost_usd), 0)
    const platformCostUsd = tLogs
      .filter((l) => !l.using_own_key)
      .reduce((s, l) => s + Number(l.cost_usd), 0)
    const thisMonthCostUsd = tMonthLogs.reduce((s, l) => s + Number(l.cost_usd), 0)

    return {
      tenantId: t.id,
      tenantName: t.name,
      plan: t.plan ?? '—',
      aiEnabled: cfg?.ai_enabled ?? false,
      provider: cfg?.provider ?? '—',
      useOwnKey: cfg?.use_own_key ?? false,
      creditLimitUsd: Number(cfg?.credit_limit_usd ?? 5),
      creditUsedUsd: Number(cfg?.credit_used_usd ?? 0),
      totalCalls: tLogs.length,
      totalCostUsd,
      platformCostUsd,
      thisMonthCostUsd,
    }
  })

  // ── Feature breakdown (all tenants) ─────────────────────────────────────
  const featureMap = new Map<string, FeatureSummary>()
  for (const l of allLogs) {
    const existing = featureMap.get(l.feature) ?? { feature: l.feature, calls: 0, costUsd: 0 }
    existing.calls++
    existing.costUsd += Number(l.cost_usd)
    featureMap.set(l.feature, existing)
  }
  const featureSummaries = Array.from(featureMap.values()).sort((a, b) => b.costUsd - a.costUsd)

  // ── Provider / model breakdown ───────────────────────────────────────────
  const modelMap = new Map<string, ModelSummary>()
  for (const l of allLogs) {
    const key = `${l.provider}::${l.model}`
    const existing = modelMap.get(key) ?? {
      provider: l.provider,
      model: l.model,
      calls: 0,
      costUsd: 0,
    }
    existing.calls++
    existing.costUsd += Number(l.cost_usd)
    modelMap.set(key, existing)
  }
  const modelSummaries = Array.from(modelMap.values()).sort((a, b) => b.costUsd - a.costUsd)

  // ── Global stats ─────────────────────────────────────────────────────────
  const totalSpendAllTime = allLogs.reduce((s, l) => s + Number(l.cost_usd), 0)
  const totalSpendThisMonth = allLogs
    .filter((l) => l.created_at >= monthStart)
    .reduce((s, l) => s + Number(l.cost_usd), 0)
  const totalCalls = allLogs.length
  const activeAITenants = allConfigs.filter((c) => c.ai_enabled).length
  const platformSpendThisMonth = allLogs
    .filter((l) => !l.using_own_key && l.created_at >= monthStart)
    .reduce((s, l) => s + Number(l.cost_usd), 0)

  return {
    tenantSummaries,
    featureSummaries,
    modelSummaries,
    totalSpendAllTime,
    totalSpendThisMonth,
    platformSpendThisMonth,
    totalCalls,
    activeAITenants,
    totalTenants: allTenants.length,
  }
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
  accent?: 'red' | 'amber' | 'green' | 'blue'
}) {
  const colors = {
    red: 'text-destructive',
    amber: 'text-yellow-600 dark:text-yellow-400',
    green: 'text-green-600 dark:text-green-400',
    blue: 'text-blue-600 dark:text-blue-400',
  }
  return (
    <div className="rounded-xl border bg-card p-5 space-y-1">
      <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">{label}</p>
      <p
        className={`text-2xl font-bold tabular-nums ${accent ? colors[accent] : 'text-foreground'}`}
      >
        {value}
      </p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}

function MiniBar({ value, max }: { value: number; max: number }) {
  const w = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0
  return (
    <div className="h-1.5 w-24 rounded-full bg-muted overflow-hidden inline-block align-middle">
      <div className="h-full rounded-full bg-primary" style={{ width: `${w}%` }} />
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AIUsagePage() {
  const { user, claims } = await getSessionClaims()
  if (!user) redirect('/login')
  if (claims?.role !== 'admin') redirect('/tasks')

  const {
    tenantSummaries,
    featureSummaries,
    modelSummaries,
    totalSpendAllTime,
    totalSpendThisMonth,
    platformSpendThisMonth,
    totalCalls,
    activeAITenants,
    totalTenants,
  } = await getPlatformAIData()

  const currentMonth = new Date().toLocaleString('en-GB', { month: 'long', year: 'numeric' })
  const maxTenantCost = Math.max(...tenantSummaries.map((t) => t.totalCostUsd), 0)
  const maxFeatureCost = Math.max(...featureSummaries.map((f) => f.costUsd), 0)

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 space-y-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">AI Spend Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Cross-tenant AI usage and cost breakdown for the platform.
        </p>
      </div>

      {/* ── Stat cards ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="All-time spend" value={fmt(totalSpendAllTime)} sub="across all tenants" />
        <StatCard
          label={`Spend — ${currentMonth}`}
          value={fmt(totalSpendThisMonth)}
          sub={`Platform key: ${fmt(platformSpendThisMonth)}`}
          accent={totalSpendThisMonth > 10 ? 'amber' : undefined}
        />
        <StatCard label="Total API calls" value={totalCalls.toLocaleString()} sub="all time" />
        <StatCard
          label="AI-enabled tenants"
          value={`${activeAITenants} / ${totalTenants}`}
          sub="with AI turned on"
          accent={activeAITenants > 0 ? 'green' : undefined}
        />
      </div>

      {/* ── Per-tenant table ─────────────────────────────────────────────────── */}
      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Per-Tenant Breakdown
        </h2>
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Tenant</th>
                  <th className="px-4 py-3 text-left font-medium">Plan</th>
                  <th className="px-4 py-3 text-left font-medium">AI</th>
                  <th className="px-4 py-3 text-left font-medium">Provider</th>
                  <th className="px-4 py-3 text-left font-medium">Key</th>
                  <th className="px-4 py-3 text-right font-medium">Credit used / limit</th>
                  <th className="px-4 py-3 text-right font-medium">Calls</th>
                  <th className="px-4 py-3 text-right font-medium">This month</th>
                  <th className="px-4 py-3 text-right font-medium">All-time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {tenantSummaries.map((t) => {
                  const creditPct =
                    t.creditLimitUsd > 0
                      ? Math.min((t.creditUsedUsd / t.creditLimitUsd) * 100, 100)
                      : 0
                  return (
                    <tr key={t.tenantId} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap">
                        {t.tenantName}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground capitalize whitespace-nowrap">
                        {t.plan}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            t.aiEnabled
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {t.aiEnabled ? 'On' : 'Off'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground capitalize whitespace-nowrap">
                        {t.aiEnabled ? t.provider : '—'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {t.aiEnabled ? (
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                              t.useOwnKey
                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            {t.useOwnKey ? 'BYOK' : 'Platform'}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {t.aiEnabled && !t.useOwnKey ? (
                          <div className="flex flex-col items-end gap-1">
                            <span className="tabular-nums text-xs">
                              {fmt(t.creditUsedUsd)}{' '}
                              <span className="text-muted-foreground">
                                / {fmt(t.creditLimitUsd)}
                              </span>
                            </span>
                            <div className="h-1.5 w-20 rounded-full bg-muted overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  creditPct >= 90
                                    ? 'bg-destructive'
                                    : creditPct >= 70
                                      ? 'bg-yellow-500'
                                      : 'bg-primary'
                                }`}
                                style={{ width: `${creditPct}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                        {t.totalCalls > 0 ? t.totalCalls.toLocaleString() : '—'}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">
                        {t.thisMonthCostUsd > 0 ? (
                          <span className="font-medium">{fmt(t.thisMonthCostUsd)}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {t.totalCostUsd > 0 ? (
                          <div className="flex items-center justify-end gap-2">
                            <MiniBar value={t.totalCostUsd} max={maxTenantCost} />
                            <span className="font-semibold tabular-nums">
                              {fmt(t.totalCostUsd)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {tenantSummaries.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-sm text-muted-foreground">
                      No tenants found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── Feature + Provider breakdown side by side ────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Feature breakdown */}
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            By Feature
          </h2>
          <div className="rounded-xl border bg-card overflow-hidden">
            {featureSummaries.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">No data yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-muted-foreground text-xs uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Feature</th>
                    <th className="px-4 py-3 text-right font-medium">Calls</th>
                    <th className="px-4 py-3 text-right font-medium">Cost</th>
                    <th className="px-4 py-3 text-right font-medium">Share</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {featureSummaries.map((f) => (
                    <tr key={f.feature} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-medium">
                        {FEATURE_LABELS[f.feature] ?? f.feature}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                        {f.calls.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium">
                        {fmt(f.costUsd)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <MiniBar value={f.costUsd} max={maxFeatureCost} />
                          <span className="text-xs text-muted-foreground w-8 text-right">
                            {pct(f.costUsd, totalSpendAllTime)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t bg-muted/20">
                  <tr>
                    <td className="px-4 py-2 text-xs text-muted-foreground font-medium">Total</td>
                    <td className="px-4 py-2 text-right text-xs tabular-nums text-muted-foreground">
                      {totalCalls.toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-right text-xs tabular-nums font-semibold">
                      {fmt(totalSpendAllTime)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </section>

        {/* Provider / model breakdown */}
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            By Provider / Model
          </h2>
          <div className="rounded-xl border bg-card overflow-hidden">
            {modelSummaries.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">No data yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-muted-foreground text-xs uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Provider</th>
                    <th className="px-4 py-3 text-left font-medium">Model</th>
                    <th className="px-4 py-3 text-right font-medium">Calls</th>
                    <th className="px-4 py-3 text-right font-medium">Cost</th>
                    <th className="px-4 py-3 text-right font-medium">Avg/call</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {modelSummaries.map((m) => (
                    <tr
                      key={`${m.provider}-${m.model}`}
                      className="hover:bg-muted/20 transition-colors"
                    >
                      <td className="px-4 py-3 capitalize font-medium">{m.provider}</td>
                      <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                        {m.model}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                        {m.calls.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium">
                        {fmt(m.costUsd)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground text-xs">
                        {fmt(m.calls > 0 ? m.costUsd / m.calls : 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
