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
