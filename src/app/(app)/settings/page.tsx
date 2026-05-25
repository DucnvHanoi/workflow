import { redirect } from 'next/navigation'
import { getSessionClaims } from '@/lib/supabase/auth-helpers'
import { AISettingsCard } from '@/components/settings/AISettingsCard'
import { getAISettings, getAIUsageLogs } from '@/lib/ai/ai-settings-actions'
import type { AIUsageLogEntry } from '@/lib/ai/ai-settings-actions'

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

export default async function SettingsPage() {
  const { user, claims } = await getSessionClaims()
  if (!user) redirect('/login')
  if (claims?.role !== 'admin') redirect('/tasks')

  const defaultAISettings = {
    aiEnabled: false,
    provider: 'anthropic' as const,
    useOwnKey: false,
    hasOwnKey: false,
    creditUsedUsd: 0,
    creditLimitUsd: 5.0,
  }

  const [{ data: aiSettings }, { data: usageLogs }] = await Promise.all([
    getAISettings(),
    getAIUsageLogs(100),
  ])

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 space-y-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage AI features and review usage across your organisation.
        </p>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          AI Configuration
        </h2>
        <div className="rounded-xl border bg-card p-6">
          <AISettingsCard initial={aiSettings ?? defaultAISettings} />
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          AI Usage Log
        </h2>
        <div className="rounded-xl border bg-card p-6">
          <UsageLogTable entries={usageLogs ?? []} />
        </div>
      </section>
    </main>
  )
}
