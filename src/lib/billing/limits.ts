import { unstable_cache } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'

export type PlanLimits = {
  plan: string
  maxUsers: number | null
  maxFlows: number | null
  maxDepartments: number | null
  reportWindowDays: number | null
  aiEnabled: boolean
  aiCreditLimitUsd: number | null
  aiCreditReset: 'monthly' | 'never' | 'none' | null
  pricePerUserCents: number
}

const FREE_FALLBACK: PlanLimits = {
  plan: 'free',
  maxUsers: 10,
  maxFlows: 2,
  maxDepartments: 5,
  reportWindowDays: 7,
  aiEnabled: false,
  aiCreditLimitUsd: 1,
  aiCreditReset: 'never',
  pricePerUserCents: 0,
}

async function fetchLimits(plan: string): Promise<PlanLimits> {
  const admin = createAdminClient()
  const { data, error } = await admin.from('plan_configs').select('*').eq('plan', plan).single()

  if (error || !data) {
    console.error('[getLimits] fallback to free defaults:', error?.message)
    return { ...FREE_FALLBACK, plan }
  }

  return {
    plan: data.plan,
    maxUsers: data.max_users ?? null,
    maxFlows: data.max_flows ?? null,
    maxDepartments: data.max_departments ?? null,
    reportWindowDays: data.report_window_days ?? null,
    aiEnabled: data.ai_enabled,
    aiCreditLimitUsd: data.ai_credit_limit_usd != null ? Number(data.ai_credit_limit_usd) : null,
    aiCreditReset: data.ai_credit_reset ?? null,
    pricePerUserCents: data.price_per_user_cents,
  }
}

// Cached per plan for 60 s — plan configs change only via platform admin
export const getLimits = unstable_cache(fetchLimits, ['plan-limits'], {
  revalidate: 60,
  tags: ['plan-limits'],
})

// Convenience: resolves tenant → plan → limits in one call
export async function getTenantLimits(tenantId: string): Promise<PlanLimits> {
  const admin = createAdminClient()
  const { data: tenant } = await admin.from('tenants').select('plan').eq('id', tenantId).single()
  return getLimits(tenant?.plan ?? 'free')
}
