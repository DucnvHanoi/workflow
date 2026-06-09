'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionClaims } from '@/lib/supabase/auth-helpers'
import { testWebhookUrl } from '@/lib/notifications/webhook'

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
