'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionClaims } from '@/lib/supabase/auth-helpers'
import { encryptApiKey } from './crypto'

export interface AISettingsData {
  aiEnabled: boolean
  provider: 'anthropic' | 'openai'
  useOwnKey: boolean
  hasOwnKey: boolean
  creditUsedUsd: number
  creditLimitUsd: number
}

export async function getAISettings(): Promise<{
  data: AISettingsData | null
  error: string | null
}> {
  const { user, claims } = await getSessionClaims()
  if (!user || !claims?.tenant_id) return { data: null, error: 'Unauthorized' }
  if (claims.role !== 'admin') return { data: null, error: 'Admin access required' }

  const db = createAdminClient()
  const { data, error } = await db
    .from('tenant_ai_configs')
    .select(
      'ai_enabled, provider, use_own_key, api_key_encrypted, credit_used_usd, credit_limit_usd'
    )
    .eq('tenant_id', claims.tenant_id)
    .maybeSingle()

  if (error) return { data: null, error: error.message }

  if (!data) {
    return {
      data: {
        aiEnabled: false,
        provider: 'anthropic',
        useOwnKey: false,
        hasOwnKey: false,
        creditUsedUsd: 0,
        creditLimitUsd: 5.0,
      },
      error: null,
    }
  }

  return {
    data: {
      aiEnabled: data.ai_enabled,
      provider: (data.provider as 'anthropic' | 'openai') ?? 'anthropic',
      useOwnKey: data.use_own_key,
      hasOwnKey: !!data.api_key_encrypted,
      creditUsedUsd: Number(data.credit_used_usd),
      creditLimitUsd: Number(data.credit_limit_usd),
    },
    error: null,
  }
}

export async function updateAISettings(updates: {
  aiEnabled?: boolean
  provider?: 'anthropic' | 'openai'
  useOwnKey?: boolean
}): Promise<{ error: string | null }> {
  const { user, claims } = await getSessionClaims()
  if (!user || !claims?.tenant_id) return { error: 'Unauthorized' }
  if (claims.role !== 'admin') return { error: 'Admin access required' }

  const db = createAdminClient()
  const patch: Record<string, unknown> = { tenant_id: claims.tenant_id }
  if (updates.aiEnabled !== undefined) patch.ai_enabled = updates.aiEnabled
  if (updates.provider !== undefined) patch.provider = updates.provider
  if (updates.useOwnKey !== undefined) patch.use_own_key = updates.useOwnKey

  const { error } = await db.from('tenant_ai_configs').upsert(patch, { onConflict: 'tenant_id' })

  return { error: error?.message ?? null }
}

export async function saveAPIKey(apiKey: string): Promise<{ error: string | null }> {
  const { user, claims } = await getSessionClaims()
  if (!user || !claims?.tenant_id) return { error: 'Unauthorized' }
  if (claims.role !== 'admin') return { error: 'Admin access required' }
  if (!apiKey.trim()) return { error: 'API key cannot be empty' }

  let encrypted: string
  try {
    encrypted = encryptApiKey(apiKey.trim())
  } catch {
    return { error: 'Failed to encrypt API key. Check server configuration.' }
  }

  const db = createAdminClient()
  const { error } = await db
    .from('tenant_ai_configs')
    .upsert(
      { tenant_id: claims.tenant_id, api_key_encrypted: encrypted, use_own_key: true },
      { onConflict: 'tenant_id' }
    )

  return { error: error?.message ?? null }
}

export interface AIUsageLogEntry {
  id: string
  createdAt: string
  userName: string | null
  userEmail: string | null
  feature: string
  provider: string
  model: string
  inputTokens: number
  outputTokens: number
  costUsd: number
  usingOwnKey: boolean
}

export async function getAIUsageLogs(limit = 100): Promise<{
  data: AIUsageLogEntry[]
  error: string | null
}> {
  const { user, claims } = await getSessionClaims()
  if (!user || !claims?.tenant_id) return { data: [], error: 'Unauthorized' }
  if (claims.role !== 'admin') return { data: [], error: 'Admin access required' }

  const db = createAdminClient()
  const [{ data: logs, error: logsErr }, { data: users }] = await Promise.all([
    db
      .from('ai_usage_logs')
      .select(
        'id, created_at, user_id, feature, provider, model, input_tokens, output_tokens, cost_usd, using_own_key'
      )
      .eq('tenant_id', claims.tenant_id)
      .order('created_at', { ascending: false })
      .limit(limit),
    db.from('users').select('id, full_name, email').eq('tenant_id', claims.tenant_id),
  ])

  if (logsErr) return { data: [], error: logsErr.message }

  const userMap = new Map((users ?? []).map((u) => [u.id, u]))

  const entries: AIUsageLogEntry[] = (logs ?? []).map((row) => {
    const u = userMap.get(row.user_id)
    return {
      id: row.id,
      createdAt: row.created_at,
      userName: u?.full_name ?? null,
      userEmail: u?.email ?? null,
      feature: row.feature,
      provider: row.provider,
      model: row.model,
      inputTokens: row.input_tokens,
      outputTokens: row.output_tokens,
      costUsd: Number(row.cost_usd),
      usingOwnKey: row.using_own_key,
    }
  })

  return { data: entries, error: null }
}

export async function removeAPIKey(): Promise<{ error: string | null }> {
  const { user, claims } = await getSessionClaims()
  if (!user || !claims?.tenant_id) return { error: 'Unauthorized' }
  if (claims.role !== 'admin') return { error: 'Admin access required' }

  const db = createAdminClient()
  const { error } = await db
    .from('tenant_ai_configs')
    .upsert(
      { tenant_id: claims.tenant_id, api_key_encrypted: null, use_own_key: false },
      { onConflict: 'tenant_id' }
    )

  return { error: error?.message ?? null }
}
