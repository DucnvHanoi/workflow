'use server'

import { randomBytes } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionClaims } from '@/lib/supabase/auth-helpers'
import { testWebhookUrl } from '@/lib/notifications/webhook'
import type { OutboundWebhookEventType } from '@/lib/webhooks/events'
import { fireWebhookEvent } from '@/lib/webhooks/deliver'

export type CustomWebhookRow = {
  id: string
  url: string
  events: OutboundWebhookEventType[]
  is_active: boolean
  created_at: string
}

function isValidWebhookUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url)
    return (
      hostname === 'hooks.slack.com' ||
      hostname === 'outlook.office.com' ||
      hostname.endsWith('.webhook.office.com')
    )
  } catch {
    return false
  }
}

export async function getWebhookUrls(): Promise<{
  slackUrl: string | null
  teamsUrl: string | null
  error: string | null
}> {
  const { user, claims } = await getSessionClaims()
  if (!user || claims?.role !== 'admin')
    return { slackUrl: null, teamsUrl: null, error: 'Unauthorized' }

  const db = createAdminClient()
  const { data, error } = await db
    .from('tenants')
    .select('slack_webhook_url, teams_webhook_url')
    .eq('id', claims.tenant_id as string)
    .single()

  if (error) return { slackUrl: null, teamsUrl: null, error: error.message }

  return {
    slackUrl: (data?.slack_webhook_url as string | null) ?? null,
    teamsUrl: (data?.teams_webhook_url as string | null) ?? null,
    error: null,
  }
}

export async function saveWebhookUrls(
  slackUrl: string,
  teamsUrl: string
): Promise<{ error: string | null }> {
  const { user, claims } = await getSessionClaims()
  if (!user || claims?.role !== 'admin') return { error: 'Unauthorized' }

  const slack = slackUrl.trim()
  const teams = teamsUrl.trim()

  if (slack && !isValidWebhookUrl(slack))
    return { error: 'Slack URL must start with https://hooks.slack.com/services/…' }
  if (teams && !isValidWebhookUrl(teams))
    return { error: 'Teams URL must start with https://…webhook.office.com/…' }

  const db = createAdminClient()
  const { error } = await db
    .from('tenants')
    .update({
      slack_webhook_url: slack || null,
      teams_webhook_url: teams || null,
    })
    .eq('id', claims.tenant_id as string)

  return { error: error?.message ?? null }
}

export async function testWebhook(url: string): Promise<{ error: string | null }> {
  const { user, claims } = await getSessionClaims()
  if (!user || claims?.role !== 'admin') return { error: 'Unauthorized' }

  return testWebhookUrl(url.trim())
}

// ─── Custom Webhooks (Phase 19 M1) ───────────────────────────────────────────

export async function getCustomWebhooks(): Promise<{
  data: CustomWebhookRow[]
  error: string | null
}> {
  const { user, claims } = await getSessionClaims()
  if (!user || claims?.role !== 'admin') return { data: [], error: 'Unauthorized' }

  const db = createAdminClient()
  const { data, error } = await db
    .from('tenant_custom_webhooks')
    .select('id, url, events, is_active, created_at')
    .eq('tenant_id', claims.tenant_id as string)
    .order('created_at', { ascending: true })

  if (error) return { data: [], error: error.message }
  return { data: (data ?? []) as CustomWebhookRow[], error: null }
}

export async function createCustomWebhook(
  url: string,
  events: OutboundWebhookEventType[]
): Promise<{ data: { id: string; secret: string } | null; error: string | null }> {
  const { user, claims } = await getSessionClaims()
  if (!user || claims?.role !== 'admin') return { data: null, error: 'Unauthorized' }

  const trimmed = url.trim()
  try {
    new URL(trimmed)
  } catch {
    return { data: null, error: 'Invalid URL.' }
  }
  if (!trimmed.startsWith('https://')) return { data: null, error: 'URL must use HTTPS.' }
  if (events.length === 0) return { data: null, error: 'Select at least one event.' }

  const secret = randomBytes(32).toString('hex')
  const db = createAdminClient()
  const { data, error } = await db
    .from('tenant_custom_webhooks')
    .insert({
      tenant_id: claims.tenant_id as string,
      url: trimmed,
      secret,
      events,
      is_active: true,
    })
    .select('id')
    .single()

  if (error) return { data: null, error: error.message }
  return { data: { id: data.id as string, secret }, error: null }
}

export async function toggleCustomWebhook(
  id: string,
  isActive: boolean
): Promise<{ error: string | null }> {
  const { user, claims } = await getSessionClaims()
  if (!user || claims?.role !== 'admin') return { error: 'Unauthorized' }

  const db = createAdminClient()
  const { error } = await db
    .from('tenant_custom_webhooks')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('tenant_id', claims.tenant_id as string)

  return { error: error?.message ?? null }
}

export async function deleteCustomWebhook(id: string): Promise<{ error: string | null }> {
  const { user, claims } = await getSessionClaims()
  if (!user || claims?.role !== 'admin') return { error: 'Unauthorized' }

  const db = createAdminClient()
  const { error } = await db
    .from('tenant_custom_webhooks')
    .delete()
    .eq('id', id)
    .eq('tenant_id', claims.tenant_id as string)

  return { error: error?.message ?? null }
}

export async function testCustomWebhook(id: string): Promise<{ error: string | null }> {
  const { user, claims } = await getSessionClaims()
  if (!user || claims?.role !== 'admin') return { error: 'Unauthorized' }

  const db = createAdminClient()
  const { data, error } = await db
    .from('tenant_custom_webhooks')
    .select('url, events')
    .eq('id', id)
    .eq('tenant_id', claims.tenant_id as string)
    .single()

  if (error || !data) return { error: 'Webhook not found.' }

  await fireWebhookEvent(claims.tenant_id as string, 'flow_triggered', {
    instanceId: 'test-instance',
    flowName: 'Test Flow',
    actorName: 'Aitomic Flow',
  })

  return { error: null }
}
