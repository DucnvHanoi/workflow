import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionClaims } from '@/lib/supabase/auth-helpers'

// ─── Types ────────────────────────────────────────────────────────────────────

interface LogRow {
  feature: string
  provider: string
  model: string
  cost_usd: number
  using_own_key: boolean
  created_at: string
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
  text_assist: 'Text Assist',
}

function fmt(usd: number) {
  return usd < 0.01 ? `$${usd.toFixed(4)}` : `$${usd.toFixed(2)}`
}

function pct(part: number, total: number) {
  if (total === 0) return 0
  return Math.round((part / total) * 100)
}

// ─── Data fetching (scoped to one tenant) ─────────────────────────────────────

async function getTenantAIData(tenantId: string) {
  const db = createAdminClient()

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const [{ data: config }, { data: logs }] = await Promise.all([
    db
      .from('tenant_ai_configs')
      .select('ai_enabled, provider, use_own_key, credit_limit_usd, credit_used_usd')
      .eq('tenant_id', tenantId)
      .maybeSingle(),
    db
      .from('ai_usage_logs')
      .select('feature, provider, model, cost_usd, using_own_key, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false }),
  ])

  const allLogs = (logs ?? []) as LogRow[]
  const monthLogs = allLogs.filter((l) => l.created_at >= monthStart)

  // ── Global stats ─────────────────────────────────────────────────────────
  const totalSpendAllTime = allLogs.reduce((s, l) => s + Number(l.cost_usd), 0)
  const totalSpendThisMonth = monthLogs.reduce((s, l) => s + Number(l.cost_usd), 0)
  const platformSpendThisMonth = monthLogs
    .filter((l) => !l.using_own_key)
    .reduce((s, l) => s + Number(l.cost_usd), 0)
  const totalCalls = allLogs.length
  const creditUsedUsd = Number(config?.credit_used_usd ?? 0)
  const creditLimitUsd = Number(config?.credit_limit_usd ?? 5)

  // ── Feature breakdown ────────────────────────────────────────────────────
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

  return {
    config,
    featureSummaries,
    modelSummaries,
    totalSpendAllTime,
    totalSpendThisMonth,
    platformSpendThisMonth,
    totalCalls,
    creditUsedUsd,
    creditLimitUsd,
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
  accent?: 'red' | 'amber' | 'green'
}) {
  const colors = {
    red: 'text-destructive',
    amber: 'text-yellow-600 dark:text-yellow-400',
    green: 'text-green-600 dark:text-green-400',
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
  if (!claims?.tenant_id) redirect('/tasks')

  const tenantId = claims.tenant_id as string

  const {
    config,
    featureSummaries,
    modelSummaries,
    totalSpendAllTime,
    totalSpendThisMonth,
    platformSpendThisMonth,
    totalCalls,
    creditUsedUsd,
    creditLimitUsd,
  } = await getTenantAIData(tenantId)

  const currentMonth = new Date().toLocaleString('en-GB', { month: 'long', year: 'numeric' })
  const maxFeatureCost = Math.max(...featureSummaries.map((f) => f.costUsd), 0)
  const creditPct = creditLimitUsd > 0 ? Math.min((creditUsedUsd / creditLimitUsd) * 100, 100) : 0
  const useOwnKey = config?.use_own_key ?? false

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 space-y-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">AI Usage</h1>
        <p className="text-sm text-muted-foreground mt-1">
          AI feature usage and cost breakdown for your organisation.
        </p>
      </div>

      {/* ── Stat cards ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="All-time spend"
          value={fmt(totalSpendAllTime)}
          sub="across all AI features"
        />
        <StatCard
          label={`Spend — ${currentMonth}`}
          value={fmt(totalSpendThisMonth)}
          sub={useOwnKey ? 'Your own API key' : `Platform key: ${fmt(platformSpendThisMonth)}`}
          accent={totalSpendThisMonth > 10 ? 'amber' : undefined}
        />
        <StatCard label="Total API calls" value={totalCalls.toLocaleString()} sub="all time" />
        {!useOwnKey ? (
          <StatCard
            label="Credit used"
            value={fmt(creditUsedUsd)}
            sub={`of ${fmt(creditLimitUsd)} limit`}
            accent={creditPct >= 90 ? 'red' : creditPct >= 70 ? 'amber' : undefined}
          />
        ) : (
          <StatCard label="Key type" value="BYOK" sub="your own API key" accent="green" />
        )}
      </div>

      {/* ── No data state ────────────────────────────────────────────────────── */}
      {totalCalls === 0 && (
        <div className="rounded-xl border bg-card px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            No AI calls recorded yet. Enable AI in{' '}
            <a href="/settings" className="underline underline-offset-2">
              Settings
            </a>{' '}
            to get started.
          </p>
        </div>
      )}

      {totalCalls > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ── By Feature ──────────────────────────────────────────────────── */}
          <section className="space-y-2">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              By Feature
            </h2>
            <div className="rounded-xl border bg-card overflow-hidden">
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
            </div>
          </section>

          {/* ── By Provider / Model ─────────────────────────────────────────── */}
          <section className="space-y-2">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              By Provider / Model
            </h2>
            <div className="rounded-xl border bg-card overflow-hidden">
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
            </div>
          </section>
        </div>
      )}
    </main>
  )
}
