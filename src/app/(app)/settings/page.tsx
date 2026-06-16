import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionClaims } from '@/lib/supabase/auth-helpers'
import { getTenantLimits } from '@/lib/billing/limits'
import { AISettingsCard } from '@/components/settings/AISettingsCard'
import { getAISettings, getAIUsageLogs } from '@/lib/ai/ai-settings-actions'
import type { AIUsageLogEntry } from '@/lib/ai/ai-settings-actions'
import { Users, GitBranch, Building2, Zap, ArrowRight } from 'lucide-react'
import { TenantNameForm } from '@/components/settings/TenantNameForm'
import { WebhookSettingsCard } from '@/components/settings/WebhookSettingsCard'
import { CustomWebhooksCard } from '@/components/settings/CustomWebhooksCard'
import { ApiKeysCard } from '@/components/settings/ApiKeysCard'
import { getWebhookUrls, getCustomWebhooks } from '@/lib/settings/webhook-actions'
import { getApiKeys } from '@/lib/api/key-actions'
import { CancellationBanner } from '@/components/settings/CancellationBanner'
import { CancelAccountDialog } from '@/components/settings/CancelAccountDialog'

// ─── AI tab helpers ───────────────────────────────────────────────────────────

const FEATURE_LABELS: Record<string, string> = {
  flow_builder: 'Flow Builder',
  form_suggestions: 'Form Suggestions',
  condition_parser: 'Condition Parser',
  trigger_assistant: 'Trigger Assistant',
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function UsageLogTable({ entries }: { entries: AIUsageLogEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center">No AI usage recorded yet.</p>
    )
  }

  const totalCost = entries.reduce((sum, e) => sum + e.costUsd, 0)

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-muted-foreground text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Date</th>
              <th className="px-4 py-3 text-left font-medium">User</th>
              <th className="px-4 py-3 text-left font-medium">Feature</th>
              <th className="px-4 py-3 text-left font-medium">Provider / Model</th>
              <th className="px-4 py-3 text-right font-medium">Tokens</th>
              <th className="px-4 py-3 text-right font-medium">Cost</th>
              <th className="px-4 py-3 text-center font-medium">Key</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {entries.map((e) => (
              <tr key={e.id} className="hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                  {formatDate(e.createdAt)}
                </td>
                <td className="px-4 py-3">
                  <p className="font-medium text-foreground truncate max-w-[140px]">
                    {e.userName ?? '—'}
                  </p>
                  {e.userEmail && (
                    <p className="text-xs text-muted-foreground truncate max-w-[140px]">
                      {e.userEmail}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {FEATURE_LABELS[e.feature] ?? e.feature}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="capitalize">{e.provider}</span>
                  <span className="text-muted-foreground"> / {e.model}</span>
                </td>
                <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap text-muted-foreground">
                  {(e.inputTokens + e.outputTokens).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap font-medium">
                  ${e.costUsd.toFixed(4)}
                </td>
                <td className="px-4 py-3 text-center">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      e.usingOwnKey
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {e.usingOwnKey ? 'Own' : 'Platform'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end text-sm">
        <span className="text-muted-foreground mr-2">Total cost ({entries.length} calls):</span>
        <span className="font-semibold tabular-nums">${totalCost.toFixed(4)}</span>
      </div>
    </div>
  )
}

// ─── Billing tab helpers ──────────────────────────────────────────────────────

interface UsageMeterProps {
  icon: React.ReactNode
  label: string
  used: number
  max: number | null
}

function UsageMeter({ icon, label, used, max }: UsageMeterProps) {
  if (max === null) {
    return (
      <div className="flex items-center justify-between py-3">
        <div className="flex items-center gap-2.5 text-sm text-foreground">
          {icon}
          {label}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm tabular-nums text-foreground font-medium">
            {used.toLocaleString()}
          </span>
          <span className="text-xs text-muted-foreground w-20 text-right">Unlimited</span>
        </div>
      </div>
    )
  }

  const pct = max > 0 ? Math.min((used / max) * 100, 100) : 0
  const barColor = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-indigo-500'
  const textColor = pct >= 90 ? 'text-red-600' : pct >= 70 ? 'text-amber-600' : 'text-foreground'

  return (
    <div className="space-y-1.5 py-2">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2.5 text-foreground">
          {icon}
          {label}
        </div>
        <span className={`tabular-nums font-medium ${textColor}`}>
          {used} / {max}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

const PLAN_BADGE: Record<string, { label: string; className: string }> = {
  free: {
    label: 'Free',
    className: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  },
  pro: {
    label: 'Pro',
    className: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  },
  enterprise: {
    label: 'Enterprise',
    className: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  },
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function SettingsPage({ searchParams }: { searchParams: { tab?: string } }) {
  const { user, claims } = await getSessionClaims()
  if (!user) redirect('/login')
  if (claims?.role !== 'admin') redirect('/tasks')

  const tenantId = claims.tenant_id as string
  const tab =
    searchParams.tab === 'billing'
      ? 'billing'
      : searchParams.tab === 'ai'
        ? 'ai'
        : searchParams.tab === 'integrations'
          ? 'integrations'
          : 'general'

  // General tab — tenant name + cancellation state
  let tenantName = ''
  let tenantStatus = 'active'
  let cancelAt: string | null = null
  if (tab === 'general') {
    const db = createAdminClient()
    const { data } = await db
      .from('tenants')
      .select('name, status, cancel_at')
      .eq('id', tenantId)
      .single()
    tenantName = data?.name ?? ''
    tenantStatus = data?.status ?? 'active'
    cancelAt = data?.cancel_at ?? null
  }

  // Fetch data for active tab only
  let aiSettings: Awaited<ReturnType<typeof getAISettings>>['data'] = null
  let usageLogs: AIUsageLogEntry[] = []
  let aiPlan = 'free'

  if (tab === 'ai') {
    const db = createAdminClient()
    const [aiRes, logsRes, tenantRes] = await Promise.all([
      getAISettings(),
      getAIUsageLogs(100),
      db.from('tenants').select('plan').eq('id', tenantId).single(),
    ])
    aiSettings = aiRes.data
    usageLogs = (logsRes.data as AIUsageLogEntry[]) ?? []
    aiPlan = tenantRes.data?.plan ?? 'free'
  }

  const defaultAISettings = {
    aiEnabled: false,
    provider: 'anthropic' as const,
    model: 'claude-sonnet-4-6',
    useOwnKey: false,
    hasOwnKey: false,
    creditUsedUsd: 0,
    creditLimitUsd: 5.0,
  }

  // Billing data
  let billingData: {
    plan: string
    status: string
    userCount: number
    flowCount: number
    deptCount: number
    lemonRenewsAt: string | null
  } | null = null

  if (tab === 'billing') {
    const db = createAdminClient()
    const [{ data: tenant }, userRes, flowRes, deptRes] = await Promise.all([
      db.from('tenants').select('plan, status, lemon_renews_at').eq('id', tenantId).single(),
      db.from('users').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
      db.from('flows').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
      db.from('departments').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    ])
    billingData = {
      plan: tenant?.plan ?? 'free',
      status: tenant?.status ?? 'active',
      userCount: userRes.count ?? 0,
      flowCount: flowRes.count ?? 0,
      deptCount: deptRes.count ?? 0,
      lemonRenewsAt: tenant?.lemon_renews_at ?? null,
    }
  }

  const limits = tab === 'billing' && billingData ? await getTenantLimits(tenantId) : null

  const checkoutBase = process.env.NEXT_PUBLIC_LS_PRO_CHECKOUT_URL
  const upgradeHref = checkoutBase
    ? `${checkoutBase}?checkout[custom][tenant_id]=${tenantId}`
    : null

  // Integrations tab — webhook URLs + custom webhooks + API keys
  let webhookUrls: { slackUrl: string | null; teamsUrl: string | null } = {
    slackUrl: null,
    teamsUrl: null,
  }
  let customWebhooks: Awaited<ReturnType<typeof getCustomWebhooks>>['data'] = []
  let apiKeys: Awaited<ReturnType<typeof getApiKeys>>['keys'] = []
  if (tab === 'integrations') {
    const [urls, cw, keysRes] = await Promise.all([
      getWebhookUrls(),
      getCustomWebhooks(),
      getApiKeys(),
    ])
    webhookUrls = { slackUrl: urls.slackUrl, teamsUrl: urls.teamsUrl }
    customWebhooks = cw.data
    apiKeys = keysRes.keys
  }

  const tabs = [
    { label: 'General', value: 'general' },
    { label: 'AI', value: 'ai' },
    { label: 'Integrations', value: 'integrations' },
    { label: 'Billing', value: 'billing' },
  ]

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 space-y-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your organisation&apos;s plan, AI features, and usage.
        </p>
      </div>

      {/* ── Tab nav ── */}
      <div className="flex gap-1 rounded-lg border bg-muted/40 p-1 w-fit">
        {tabs.map((t) => (
          <Link
            key={t.value}
            href={`?tab=${t.value}`}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === t.value
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {/* ── General tab ── */}
      {tab === 'general' && (
        <>
          {tenantStatus === 'cancelling' && cancelAt && <CancellationBanner cancelAt={cancelAt} />}

          <section className="space-y-2">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Organisation
            </h2>
            <div className="rounded-xl border bg-card p-6">
              <TenantNameForm currentName={tenantName} />
            </div>
          </section>

          {tenantStatus !== 'cancelling' && (
            <section className="space-y-2">
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Danger Zone
              </h2>
              <div className="rounded-xl border border-destructive/30 bg-card p-6 space-y-2">
                <h3 className="text-sm font-semibold text-foreground">Cancel account</h3>
                <p className="text-sm text-muted-foreground">
                  Permanently delete this workspace and all its data after a 7-day cooling-off
                  period. A full data export will be emailed to you immediately.
                </p>
                <CancelAccountDialog orgName={tenantName} />
              </div>
            </section>
          )}
        </>
      )}

      {/* ── AI tab ── */}
      {tab === 'ai' && (
        <>
          <section className="space-y-2">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              AI Configuration
            </h2>
            <div className="rounded-xl border bg-card p-6">
              <AISettingsCard initial={aiSettings ?? defaultAISettings} plan={aiPlan} />
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              AI Usage Log
            </h2>
            <div className="rounded-xl border bg-card p-6">
              <UsageLogTable entries={usageLogs} />
            </div>
          </section>
        </>
      )}

      {/* ── Integrations tab ── */}
      {tab === 'integrations' && (
        <>
          <section className="space-y-2">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Webhook Notifications
            </h2>
            <p className="text-sm text-muted-foreground">
              Receive step-assignment and SLA alerts directly in Slack or Microsoft Teams.
            </p>
            <div className="rounded-xl border bg-card p-6">
              <WebhookSettingsCard
                initialSlackUrl={webhookUrls.slackUrl}
                initialTeamsUrl={webhookUrls.teamsUrl}
              />
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Custom Webhooks
            </h2>
            <p className="text-sm text-muted-foreground">
              Push flow events to any HTTP endpoint — connect to Zapier, Make.com, n8n, or your own
              systems. Each request is signed with an HMAC-SHA256 secret.
            </p>
            <div className="rounded-xl border bg-card p-6">
              <CustomWebhooksCard initialWebhooks={customWebhooks} />
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              API Access
            </h2>
            <p className="text-sm text-muted-foreground">
              Generate API keys to trigger flows and poll instance status from external systems
              (Zapier, Make.com, scripts). Each key is scoped to this workspace.
            </p>
            <div className="rounded-xl border bg-card p-6">
              <ApiKeysCard initialKeys={apiKeys} />
            </div>
          </section>
        </>
      )}

      {/* ── Billing tab ── */}
      {tab === 'billing' && billingData && limits && (
        <>
          {/* Plan card */}
          <section className="space-y-2">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Current Plan
            </h2>
            <div className="rounded-xl border bg-card p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        PLAN_BADGE[billingData.plan]?.className ?? PLAN_BADGE.free.className
                      }`}
                    >
                      {PLAN_BADGE[billingData.plan]?.label ?? billingData.plan}
                    </span>
                    {billingData.status !== 'active' && (
                      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-amber-100 text-amber-700">
                        {billingData.status}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {billingData.plan === 'free' &&
                      'Limited to 10 users, 2 flows, and 5 departments.'}
                    {billingData.plan === 'pro' &&
                      '$29 / month · Up to 50 users · Full feature access.'}
                    {billingData.plan === 'enterprise' &&
                      'Custom limits and AI configuration managed by your account team.'}
                  </p>
                </div>
                {billingData.plan === 'free' && (
                  <div className="text-right space-y-1">
                    {upgradeHref ? (
                      <a
                        href={upgradeHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 bg-indigo-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
                      >
                        Upgrade to Pro
                        <ArrowRight className="h-4 w-4" />
                      </a>
                    ) : (
                      <button
                        disabled
                        className="inline-flex items-center gap-1.5 bg-indigo-600 text-white text-sm font-semibold px-4 py-2 rounded-lg opacity-50 cursor-not-allowed"
                      >
                        Upgrade to Pro
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    )}
                    <p className="text-xs text-muted-foreground">$29 / month · cancel anytime</p>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Usage meters */}
          <section className="space-y-2">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Usage
            </h2>
            <div className="rounded-xl border bg-card px-6 divide-y divide-border">
              <UsageMeter
                icon={<Users className="h-4 w-4 text-muted-foreground" />}
                label="Users"
                used={billingData.userCount}
                max={limits.maxUsers}
              />
              <UsageMeter
                icon={<GitBranch className="h-4 w-4 text-muted-foreground" />}
                label="Flows"
                used={billingData.flowCount}
                max={limits.maxFlows}
              />
              <UsageMeter
                icon={<Building2 className="h-4 w-4 text-muted-foreground" />}
                label="Departments"
                used={billingData.deptCount}
                max={limits.maxDepartments}
              />
              <div className="flex items-center justify-between py-3">
                <div className="flex items-center gap-2.5 text-sm text-foreground">
                  <Zap className="h-4 w-4 text-muted-foreground" />
                  Report history
                </div>
                <span className="text-sm font-medium text-foreground">
                  {limits.reportWindowDays !== null
                    ? `${limits.reportWindowDays} days`
                    : 'Unlimited'}
                </span>
              </div>
            </div>
          </section>

          {/* Free plan upgrade nudge */}
          {billingData.plan === 'free' && (
            <section className="rounded-xl border border-indigo-200 bg-indigo-50 dark:bg-indigo-950/20 dark:border-indigo-900 p-6">
              <h3 className="text-sm font-semibold text-indigo-900 dark:text-indigo-200 mb-1">
                Unlock Pro features
              </h3>
              <p className="text-sm text-indigo-700 dark:text-indigo-300 mb-4">
                Upgrade to Pro for up to 50 users, unlimited flows and departments, full report
                history, and AI-powered flow building — $29 flat per month.
              </p>
              <ul className="text-sm text-indigo-700 dark:text-indigo-300 space-y-1 mb-4">
                {[
                  '50 users (vs 10 on Free)',
                  'Unlimited flows and departments',
                  'Full report history (30d, 90d, all-time)',
                  'AI integration in flow builder',
                ].map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              {upgradeHref ? (
                <a
                  href={upgradeHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 bg-indigo-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Upgrade to Pro — $29 / month
                  <ArrowRight className="h-4 w-4" />
                </a>
              ) : (
                <button
                  disabled
                  className="inline-flex items-center gap-1.5 bg-indigo-600 text-white text-sm font-semibold px-4 py-2 rounded-lg opacity-50 cursor-not-allowed"
                >
                  Upgrade to Pro — $29 / month
                  <ArrowRight className="h-4 w-4" />
                </button>
              )}
              <p className="text-xs text-indigo-500 mt-2">
                Secure checkout via Lemon Squeezy · cancel anytime
              </p>
            </section>
          )}

          {/* Pro / Enterprise info */}
          {billingData.plan === 'pro' && (
            <section className="rounded-xl border bg-card p-6 space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Manage subscription</h3>
              {billingData.lemonRenewsAt && (
                <p className="text-sm text-muted-foreground">
                  Renews on{' '}
                  <span className="font-medium text-foreground">
                    {new Date(billingData.lemonRenewsAt).toLocaleDateString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                </p>
              )}
              <a
                href="https://app.lemonsqueezy.com/my-orders"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
              >
                Manage billing &amp; invoices
                <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </section>
          )}

          {billingData.plan === 'enterprise' && (
            <section className="rounded-xl border bg-card p-6 space-y-2">
              <h3 className="text-sm font-semibold text-foreground">Enterprise plan</h3>
              <p className="text-sm text-muted-foreground">
                Your plan and limits are managed by your account team. Contact us for any changes.
              </p>
            </section>
          )}
        </>
      )}
    </main>
  )
}
