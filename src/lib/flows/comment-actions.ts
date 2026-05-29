'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionClaims } from '@/lib/supabase/auth-helpers'
import { createNotification } from '@/lib/notifications/create'
import { sendWebhookNotification } from '@/lib/notifications/webhook'

export type CommentItem = {
  id: string
  body: string
  created_at: string
  user_id: string
  user_name: string | null
  user_email: string
}

// ── Internal access check ─────────────────────────────────────────────────────
// Returns whether the user can access this instance, plus flow metadata.
// Access = admin OR triggerer OR has any step_instance.assigned_to = user.id

type AccessResult =
  | { ok: false }
  | {
      ok: true
      isTriggerer: boolean
      isAdmin: boolean
      flowName: string
      showFullHistory: boolean
      tenantId: string
    }

async function checkAccess(
  instanceId: string,
  userId: string,
  isAdmin: boolean,
  tenantId: string
): Promise<AccessResult> {
  const db = createAdminClient()

  const { data: instance } = await db
    .from('flow_instances')
    .select(
      `
      triggered_by,
      flow_versions!flow_version_id (
        flows!flow_id ( name, tenant_id, show_full_comment_history )
      )
    `
    )
    .eq('id', instanceId)
    .maybeSingle()

  if (!instance) return { ok: false }

  const version = Array.isArray(instance.flow_versions)
    ? instance.flow_versions[0]
    : instance.flow_versions
  const flow = Array.isArray((version as Record<string, unknown>)?.flows)
    ? ((version as Record<string, unknown>).flows as Record<string, unknown>[])[0]
    : (version as Record<string, unknown>)?.flows

  if (!flow || (flow as Record<string, unknown>).tenant_id !== tenantId) return { ok: false }

  const flowName = (flow as Record<string, unknown>).name as string
  const showFullHistory =
    ((flow as Record<string, unknown>).show_full_comment_history as boolean) ?? true
  const isTriggerer = instance.triggered_by === userId

  if (isAdmin || isTriggerer) {
    return { ok: true, isTriggerer, isAdmin, flowName, showFullHistory, tenantId }
  }

  // Regular user — must have been assigned at least one step
  const { count } = await db
    .from('step_instances')
    .select('id', { count: 'exact', head: true })
    .eq('instance_id', instanceId)
    .eq('assigned_to', userId)

  if ((count ?? 0) === 0) return { ok: false }

  return { ok: true, isTriggerer: false, isAdmin: false, flowName, showFullHistory, tenantId }
}

// ── getComments ───────────────────────────────────────────────────────────────

export async function getComments(instanceId: string): Promise<{
  comments: CommentItem[]
  error: string | null
}> {
  const { user, claims } = await getSessionClaims()
  if (!user || !claims?.tenant_id) return { comments: [], error: 'Unauthenticated' }

  const db = createAdminClient()
  const isAdmin = claims.role === 'admin'
  const access = await checkAccess(instanceId, user.id, isAdmin, claims.tenant_id)
  if (!access.ok) return { comments: [], error: 'Access denied.' }

  // History filter — only applies when toggle is off for non-admin, non-triggerer
  let earliestJoin: string | null = null
  if (!access.showFullHistory && !access.isAdmin && !access.isTriggerer) {
    const { data: firstStep } = await db
      .from('step_instances')
      .select('created_at')
      .eq('instance_id', instanceId)
      .eq('assigned_to', user.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    earliestJoin = (firstStep?.created_at as string | null) ?? null
  }

  let query = db
    .from('instance_comments')
    .select('id, body, created_at, user_id, users!user_id(full_name, email)')
    .eq('instance_id', instanceId)
    .order('created_at', { ascending: true })

  if (earliestJoin) {
    query = query.gte('created_at', earliestJoin)
  }

  const { data, error } = await query
  if (error) return { comments: [], error: error.message }

  const comments: CommentItem[] = (data ?? []).map((row) => {
    const u = Array.isArray(row.users) ? row.users[0] : row.users
    return {
      id: row.id as string,
      body: row.body as string,
      created_at: row.created_at as string,
      user_id: row.user_id as string,
      user_name: (u as { full_name?: string | null } | null)?.full_name ?? null,
      user_email: (u as { email?: string } | null)?.email ?? '',
    }
  })

  return { comments, error: null }
}

// ── addComment ────────────────────────────────────────────────────────────────

export async function addComment(
  instanceId: string,
  body: string
): Promise<{ error: string | null }> {
  const trimmed = body.trim()
  if (!trimmed || trimmed.length > 2000) return { error: 'Comment must be 1–2000 characters.' }

  const { user, claims } = await getSessionClaims()
  if (!user || !claims?.tenant_id) return { error: 'Unauthenticated' }

  const db = createAdminClient()
  const isAdmin = claims.role === 'admin'
  const access = await checkAccess(instanceId, user.id, isAdmin, claims.tenant_id)
  if (!access.ok) return { error: 'Access denied.' }

  const { error: insertError } = await db.from('instance_comments').insert({
    tenant_id: claims.tenant_id,
    instance_id: instanceId,
    user_id: user.id,
    body: trimmed,
  })
  if (insertError) return { error: insertError.message }

  // Resolve commenter name
  const { data: commenterRow } = await db
    .from('users')
    .select('full_name')
    .eq('id', user.id)
    .maybeSingle()
  const commenterName = (commenterRow?.full_name as string | null) ?? user.email ?? 'Someone'

  // Collect all participants: triggerer + every step assignee on this instance
  const { data: instanceRow } = await db
    .from('flow_instances')
    .select('triggered_by')
    .eq('id', instanceId)
    .maybeSingle()

  const { data: stepRows } = await db
    .from('step_instances')
    .select('assigned_to')
    .eq('instance_id', instanceId)
    .not('assigned_to', 'is', null)

  const participantIds = new Set<string>()
  if (instanceRow?.triggered_by) participantIds.add(instanceRow.triggered_by as string)
  for (const s of stepRows ?? []) {
    if (s.assigned_to) participantIds.add(s.assigned_to as string)
  }
  participantIds.delete(user.id) // don't notify the poster

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.bizflow.id.vn'
  const taskLink = `${siteUrl}/tasks?open=${instanceId}`

  // In-app notifications (fire-and-forget, non-fatal)
  for (const uid of Array.from(participantIds)) {
    void createNotification({
      tenantId: claims.tenant_id,
      userId: uid,
      type: 'comment_added',
      title: `New comment on "${access.flowName}"`,
      body: trimmed.length > 80 ? trimmed.slice(0, 80) + '…' : trimmed,
      link: taskLink,
    })
  }

  // Webhook notification
  void sendWebhookNotification(claims.tenant_id, {
    type: 'comment_added',
    flowName: access.flowName,
    commenterName,
    body: trimmed.length > 100 ? trimmed.slice(0, 100) + '…' : trimmed,
    taskLink,
  })

  return { error: null }
}
