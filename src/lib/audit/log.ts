// FILE PATH: src/lib/audit/log.ts
// Shared helper for writing administrative audit-trail entries.
// Mirrors the writeEventLog pattern in flows/actions.ts but for admin/structural
// events (role changes, flow publish/unpublish, step reassignment) stored in the
// audit_log table. Plain module (not 'use server') so any server action can import
// it. Writes use the caller's service-role admin client.

import type { SupabaseClient } from '@supabase/supabase-js'

export type AuditAction = 'role_changed' | 'flow_published' | 'flow_unpublished' | 'step_reassigned'

export type AuditTargetType = 'user' | 'flow' | 'step_instance'

export async function logAuditEvent(
  db: SupabaseClient,
  params: {
    tenantId: string
    actorId?: string | null
    action: AuditAction
    targetType: AuditTargetType
    targetId?: string | null
    targetLabel?: string | null
    description: string
    metadata?: Record<string, unknown>
  }
): Promise<void> {
  try {
    await db.from('audit_log').insert({
      tenant_id: params.tenantId,
      actor_id: params.actorId ?? null,
      action: params.action,
      target_type: params.targetType,
      target_id: params.targetId ?? null,
      target_label: params.targetLabel ?? null,
      description: params.description,
      metadata: params.metadata ?? {},
    })
  } catch {
    // Non-fatal — never block the action for an audit logging failure.
  }
}
