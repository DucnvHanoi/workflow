'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionClaims } from '@/lib/supabase/auth-helpers'
import { encryptApiKey, decryptApiKey as _decryptApiKey } from '@/lib/ai/crypto'
import { DEFAULT_MODEL, MODELS_BY_PROVIDER } from '@/lib/ai/pricing'

// Guard: caller must be the platform admin (email from PLATFORM_ADMIN_EMAIL env var)
async function requirePlatformAdmin() {
  const { user } = await getSessionClaims()
  if (!user) throw new Error('Unauthorized')
  const adminEmail = process.env.PLATFORM_ADMIN_EMAIL
  if (adminEmail && user.email !== adminEmail) throw new Error('Platform admin access required')
  return user
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PlatformAIConfigData {
  aiEnabled: boolean
  provider: 'anthropic' | 'openai'
  model: string
  hasAnthropicKey: boolean
  hasOpenAIKey: boolean
}

export interface PlatformAIUsageEntry {
  id: string
  createdAt: string
  feature: string
  provider: string
  model: string
  inputTokens: number
  outputTokens: number
  costUsd: number
}

// ─── Read config ──────────────────────────────────────────────────────────────

export async function getPlatformAIConfig(): Promise<{
  data: PlatformAIConfigData | null
  error: string | null
}> {
  try {
    await requirePlatformAdmin()
  } catch (e) {
    return { data: null, error: (e as Error).message }
  }

  const db = createAdminClient()
  const { data, error } = await db
    .from('platform_ai_config')
    .select('ai_enabled, provider, model, anthropic_key_encrypted, openai_key_encrypted')
    .maybeSingle()

  if (error) return { data: null, error: error.message }

  if (!data) {
    return {
      data: {
        aiEnabled: false,
        provider: 'anthropic',
        model: DEFAULT_MODEL['anthropic'],
        hasAnthropicKey: false,
        hasOpenAIKey: false,
      },
      error: null,
    }
  }

  const provider = (data.provider as 'anthropic' | 'openai') ?? 'anthropic'
  const validModels = MODELS_BY_PROVIDER[provider]?.map((m) => m.id) ?? []
  const model =
    data.model && validModels.includes(data.model) ? data.model : DEFAULT_MODEL[provider]

  return {
    data: {
      aiEnabled: data.ai_enabled,
      provider,
      model,
      hasAnthropicKey: !!data.anthropic_key_encrypted,
      hasOpenAIKey: !!data.openai_key_encrypted,
    },
    error: null,
  }
}

// ─── Update provider / model / enabled ───────────────────────────────────────

export async function updatePlatformAIConfig(updates: {
  aiEnabled?: boolean
  provider?: 'anthropic' | 'openai'
  model?: string
}): Promise<{ error: string | null }> {
  try {
    await requirePlatformAdmin()
  } catch (e) {
    return { error: (e as Error).message }
  }

  const patch: Record<string, unknown> = {
    singleton: true,
    updated_at: new Date().toISOString(),
  }
  if (updates.aiEnabled !== undefined) patch.ai_enabled = updates.aiEnabled
  if (updates.provider !== undefined) patch.provider = updates.provider
  if (updates.model !== undefined) patch.model = updates.model

  const db = createAdminClient()
  const { error } = await db.from('platform_ai_config').upsert(patch, { onConflict: 'singleton' })

  return { error: error?.message ?? null }
}

// ─── Save an API key ─────────────────────────────────────────────────────────

export async function savePlatformAPIKey(
  provider: 'anthropic' | 'openai',
  apiKey: string
): Promise<{ error: string | null }> {
  try {
    await requirePlatformAdmin()
  } catch (e) {
    return { error: (e as Error).message }
  }
  if (!apiKey.trim()) return { error: 'API key cannot be empty' }

  let encrypted: string
  try {
    encrypted = encryptApiKey(apiKey.trim())
  } catch {
    return { error: 'Failed to encrypt API key. Check server configuration.' }
  }

  const field = provider === 'anthropic' ? 'anthropic_key_encrypted' : 'openai_key_encrypted'

  const db = createAdminClient()
  const { error } = await db
    .from('platform_ai_config')
    .upsert(
      { singleton: true, [field]: encrypted, updated_at: new Date().toISOString() },
      { onConflict: 'singleton' }
    )

  return { error: error?.message ?? null }
}

// ─── Remove an API key ───────────────────────────────────────────────────────

export async function removePlatformAPIKey(
  provider: 'anthropic' | 'openai'
): Promise<{ error: string | null }> {
  try {
    await requirePlatformAdmin()
  } catch (e) {
    return { error: (e as Error).message }
  }

  const field = provider === 'anthropic' ? 'anthropic_key_encrypted' : 'openai_key_encrypted'

  const db = createAdminClient()
  const { error } = await db
    .from('platform_ai_config')
    .upsert(
      { singleton: true, [field]: null, updated_at: new Date().toISOString() },
      { onConflict: 'singleton' }
    )

  return { error: error?.message ?? null }
}

// ─── Usage logs ───────────────────────────────────────────────────────────────

export async function getPlatformAIUsageLogs(limit = 50): Promise<{
  data: PlatformAIUsageEntry[]
  error: string | null
}> {
  try {
    await requirePlatformAdmin()
  } catch (e) {
    return { data: [], error: (e as Error).message }
  }

  const db = createAdminClient()
  const { data, error } = await db
    .from('platform_ai_usage_logs')
    .select('id, created_at, feature, provider, model, input_tokens, output_tokens, cost_usd')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) return { data: [], error: error.message }

  return {
    data: (data ?? []).map((row) => ({
      id: row.id,
      createdAt: row.created_at,
      feature: row.feature,
      provider: row.provider,
      model: row.model,
      inputTokens: row.input_tokens,
      outputTokens: row.output_tokens,
      costUsd: Number(row.cost_usd),
    })),
    error: null,
  }
}
