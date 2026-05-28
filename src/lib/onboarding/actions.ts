'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionClaims } from '@/lib/supabase/auth-helpers'

export interface OnboardingStep {
  key: string
  completedAt: string
}

export async function getOnboardingSteps(userId: string): Promise<OnboardingStep[]> {
  const db = createAdminClient()
  const { data } = await db
    .from('user_onboarding')
    .select('step_key, completed_at')
    .eq('user_id', userId)
  return (data ?? []).map((r) => ({
    key: r.step_key as string,
    completedAt: r.completed_at as string,
  }))
}

export async function markOnboardingStep(stepKey: string): Promise<void> {
  const { user } = await getSessionClaims()
  if (!user) return
  const db = createAdminClient()
  await db
    .from('user_onboarding')
    .upsert(
      { user_id: user.id, step_key: stepKey },
      { onConflict: 'user_id,step_key', ignoreDuplicates: true }
    )
}

export interface AdminChecklistState {
  invitedUser: boolean
  createdFlow: boolean
  publishedFlow: boolean
  setupDepartment: boolean
  enabledAi: boolean
  dismissed: boolean
}

export async function getAdminChecklistState(): Promise<AdminChecklistState | null> {
  const { user, claims } = await getSessionClaims()
  if (!user || claims.role !== 'admin') return null

  const tenantId = claims.tenant_id as string
  const db = createAdminClient()

  const [
    { count: userCount },
    { count: flowCount },
    { count: publishedCount },
    { count: deptCount },
    { data: aiConfig },
    { data: dismissedRows },
  ] = await Promise.all([
    db
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .neq('id', user.id),
    db.from('flows').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    db
      .from('flows')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('status', 'published'),
    db.from('departments').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    db.from('tenant_ai_configs').select('id').eq('tenant_id', tenantId).maybeSingle(),
    db
      .from('user_onboarding')
      .select('step_key')
      .eq('user_id', user.id)
      .eq('step_key', 'checklist_dismissed'),
  ])

  return {
    invitedUser: (userCount ?? 0) > 0,
    createdFlow: (flowCount ?? 0) > 0,
    publishedFlow: (publishedCount ?? 0) > 0,
    setupDepartment: (deptCount ?? 0) > 0,
    enabledAi: !!aiConfig,
    dismissed: (dismissedRows ?? []).length > 0,
  }
}
