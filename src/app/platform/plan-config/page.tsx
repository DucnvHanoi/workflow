import { createAdminClient } from '@/lib/supabase/admin'
import { updatePlanConfig } from './actions'

function NullableInput({
  name,
  value,
  type = 'number',
  step,
}: {
  name: string
  value: number | null
  type?: string
  step?: string
}) {
  return (
    <input
      type={type}
      name={name}
      defaultValue={value ?? ''}
      step={step}
      placeholder="∞"
      className="w-24 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-sm text-slate-800 dark:text-slate-200 tabular-nums placeholder:text-slate-300"
    />
  )
}

export default async function PlanConfigPage() {
  const db = createAdminClient()
  const { data: plans } = await db
    .from('plan_configs')
    .select('*')
    .order('price_per_user_cents', { ascending: true })

  const PLAN_ORDER = ['free', 'pro', 'enterprise']
  const sorted = (plans ?? []).sort(
    (a, b) => PLAN_ORDER.indexOf(a.plan) - PLAN_ORDER.indexOf(b.plan)
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Plan Config</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Edit plan limits. Changes apply within 60 seconds (cache TTL). Leave a field blank for
          unlimited.
        </p>
      </div>

      <div className="space-y-4">
        {sorted.map((p) => (
          <form key={p.plan} action={updatePlanConfig}>
            <input type="hidden" name="plan" value={p.plan} />
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 capitalize">
                  {p.plan}
                </h2>
                <button
                  type="submit"
                  className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors"
                >
                  Save {p.plan}
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-slate-500 font-medium">Max users</label>
                  <NullableInput name="max_users" value={p.max_users} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-500 font-medium">Max flows</label>
                  <NullableInput name="max_flows" value={p.max_flows} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-500 font-medium">Max departments</label>
                  <NullableInput name="max_departments" value={p.max_departments} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-500 font-medium">Report window (days)</label>
                  <NullableInput name="report_window_days" value={p.report_window_days} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-500 font-medium">AI enabled</label>
                  <select
                    name="ai_enabled"
                    defaultValue={p.ai_enabled ? 'true' : 'false'}
                    className="w-24 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-sm text-slate-800 dark:text-slate-200"
                  >
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-500 font-medium">
                    AI credit limit (USD)
                  </label>
                  <NullableInput
                    name="ai_credit_limit_usd"
                    value={p.ai_credit_limit_usd != null ? Number(p.ai_credit_limit_usd) : null}
                    step="0.01"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-500 font-medium">AI credit reset</label>
                  <select
                    name="ai_credit_reset"
                    defaultValue={p.ai_credit_reset ?? 'none'}
                    className="w-28 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-sm text-slate-800 dark:text-slate-200"
                  >
                    <option value="monthly">monthly</option>
                    <option value="never">never</option>
                    <option value="none">none</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-500 font-medium">
                    Price (cents/user/mo)
                  </label>
                  <input
                    type="number"
                    name="price_per_user_cents"
                    defaultValue={p.price_per_user_cents}
                    className="w-24 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-sm text-slate-800 dark:text-slate-200 tabular-nums"
                  />
                </div>
              </div>

              <p className="text-xs text-slate-400">
                Last updated:{' '}
                {new Date(p.updated_at).toLocaleString('en-GB', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
          </form>
        ))}
      </div>
    </div>
  )
}
