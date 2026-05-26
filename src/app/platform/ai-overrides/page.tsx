import { createAdminClient } from '@/lib/supabase/admin'
import { updateAIOverride } from './actions'

export default async function AIOverridesPage() {
  const db = createAdminClient()

  // Fetch enterprise tenants with their AI config
  const { data: tenants } = await db
    .from('tenants')
    .select('id, name, plan')
    .eq('plan', 'enterprise')
    .order('name')

  const tenantIds = (tenants ?? []).map((t) => t.id)

  const { data: configs } =
    tenantIds.length > 0
      ? await db
          .from('tenant_ai_configs')
          .select('tenant_id, ai_enabled, credit_limit_usd, credit_used_usd')
          .in('tenant_id', tenantIds)
      : { data: [] }

  const configMap = new Map((configs ?? []).map((c) => [c.tenant_id, c]))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">AI Overrides</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Set custom AI credit limits for enterprise tenants. These override the plan default.
        </p>
      </div>

      {(tenants ?? []).length === 0 ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center">
          <p className="text-sm text-slate-400">No enterprise tenants yet.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Organisation</th>
                <th className="px-4 py-3 text-right font-medium">Used (USD)</th>
                <th className="px-4 py-3 text-left font-medium">Credit limit (USD)</th>
                <th className="px-4 py-3 text-left font-medium">AI enabled</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {(tenants ?? []).map((t) => {
                const cfg = configMap.get(t.id)
                return (
                  <tr
                    key={t.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900 dark:text-slate-100">{t.name}</p>
                      <p className="text-xs text-slate-400 font-mono">{t.id.slice(0, 8)}…</p>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700 dark:text-slate-300">
                      ${cfg ? Number(cfg.credit_used_usd).toFixed(4) : '0.0000'}
                    </td>
                    <td className="px-4 py-3">
                      <form action={updateAIOverride} className="flex items-center gap-2">
                        <input type="hidden" name="tenantId" value={t.id} />
                        <input
                          type="number"
                          name="credit_limit_usd"
                          defaultValue={cfg ? Number(cfg.credit_limit_usd) : ''}
                          step="0.01"
                          min="0"
                          placeholder="unlimited"
                          className="w-32 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-sm text-slate-800 dark:text-slate-200 tabular-nums"
                        />
                        <button
                          type="submit"
                          className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors whitespace-nowrap"
                        >
                          Save
                        </button>
                      </form>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          cfg?.ai_enabled
                            ? 'bg-green-100 text-green-700'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {cfg?.ai_enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </td>
                    <td />
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-slate-400">
        AI enabled/disabled for enterprise tenants is controlled by the tenant admin in their own
        settings. Credit limit here overrides the plan default.
      </p>
    </div>
  )
}
