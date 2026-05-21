// Non-fatal helper — called fire-and-forget from server actions.
// Uses the admin client (service role) because it runs in contexts
// that have no user session (inside advanceFlow, triggerFlow, etc.).

import { createAdminClient } from '@/lib/supabase/admin'

export type NotificationType =
  | 'step_assigned'
  | 'flow_completed'
  | 'sla_reminder'
  | 'step_escalated'

export interface CreateNotificationParams {
  tenantId: string
  userId: string
  type: NotificationType
  title: string
  body: string
  link?: string | null
}

export async function createNotification(params: CreateNotificationParams): Promise<void> {
  try {
    const db = createAdminClient()
    await db.from('notifications').insert({
      tenant_id: params.tenantId,
      user_id: params.userId,
      type: params.type,
      title: params.title,
      body: params.body,
      link: params.link ?? null,
    })
  } catch (err) {
    console.error('[notifications] createNotification failed:', err)
  }
}
