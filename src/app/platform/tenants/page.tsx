import { createAdminClient } from '@/lib/supabase/admin'
import { updateTenantPlan, updateTenantStatus } from './actions'

const PLAN_BADGE: Record<string, string> = {
  free: 'bg-slate-100 text-slate-700',
  pro: 'bg-indigo-100 text-indigo-700',
  enterprise: 'bg-violet-100 text-violet-700',
}

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  trial: 'bg-amber-100 text-amber-700',
  suspended: 'bg-red-100 text-red-700',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export default async function TenantsPage() {
  const db = createAdminClient()

  // Fetch all tenants
  const { data: tenants } = await db
    .from('tenants')
    .select('id, name, plan, status, created_at')
    .order('created_at', { ascending: false })

  // Fetch user counts per tenant
  const { data: userCounts } = await db.from('users').select('tenant_id')

  const countMap: Record<string, number> = {}
  for (const row of userCounts ?? []) {
    countMap[row.tenant_id] = (countMap[row.tenant_id] ?? 0) + 1
  }

  const rows = (tenants ?? []).map((t) => {
    const users = countMap[t.id] ?? 0
    const mrr = t.plan === 'pro' ? users * 5 : 0
    return { ...t, users, mrr }
  })

  const totalMrr = rows.reduce((s, r) => s + r.mrr, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Tenants</h1>
          <p className="text-sm text-slate-500 mt-0.5">{rows.length} organisations</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500">Est. MRR</p>
          <p className="text-xl font-bold text-slate-900 dark:text-slate-100">
            ${totalMrr.toLocaleString()}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Organisation</th>
              <th className="px-4 py-3 text-left font-medium">Plan</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Users</th>
              <th className="px-4 py-3 text-right font-medium">MRR</th>
              <th className="px-4 py-3 text-left font-medium">Created</th>
              <th className="px-4 py-3 text-left font-medium">Override</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {rows.map((t) => (
              <tr
                key={t.id}
                className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
              >
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-900 dark:text-slate-100">{t.name}</p>
                  <p className="text-xs text-slate-400 font-mono">{t.id.slice(0, 8)}…</p>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${PLAN_BADGE[t.plan] ?? PLAN_BADGE.free}`}
                  >
                    {t.plan}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_BADGE[t.status ?? 'active'] ?? STATUS_BADGE.active}`}
                  >
                    {t.status ?? 'active'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-700 dark:text-slate-300">
                  {t.users}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-700 dark:text-slate-300">
                  {t.mrr > 0 ? `$${t.mrr}` : '—'}
                </td>
                <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                  {formatDate(t.created_at)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {/* Plan override */}
                    <form
                      action={async (fd: FormData) => {
                        'use server'
                        await updateTenantPlan(
                          fd.get('tenantId') as string,
                          fd.get('plan') as string
                        )
                      }}
                      className="flex items-center gap-1"
                    >
                      <input type="hidden" name="tenantId" value={t.id} />
                      <select
                        name="plan"
                        defaultValue={t.plan}
                        className="text-xs rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-1.5 py-1 text-slate-700 dark:text-slate-300"
                      >
                        <option value="free">free</option>
                        <option value="pro">pro</option>
                        <option value="enterprise">enterprise</option>
                      </select>
                      <button
                        type="submit"
                        className="text-xs px-2 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                      >
                        Set plan
                      </button>
                    </form>

                    {/* Status override */}
                    <form
                      action={async (fd: FormData) => {
                        'use server'
                        await updateTenantStatus(
                          fd.get('tenantId') as string,
                          fd.get('status') as string
                        )
                      }}
                      className="flex items-center gap-1"
                    >
                      <input type="hidden" name="tenantId" value={t.id} />
                      <select
                        name="status"
                        defaultValue={t.status ?? 'active'}
                        className="text-xs rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-1.5 py-1 text-slate-700 dark:text-slate-300"
                      >
                        <option value="active">active</option>
                        <option value="trial">trial</option>
                        <option value="suspended">suspended</option>
                      </select>
                      <button
                        type="submit"
                        className="text-xs px-2 py-1 rounded bg-slate-600 text-white hover:bg-slate-700 transition-colors"
                      >
                        Set status
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="text-center text-sm text-slate-400 py-10">No tenants yet.</p>
        )}
      </div>
    </div>
  )
}
