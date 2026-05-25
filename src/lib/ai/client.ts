'use server'

import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { createAdminClient } from '@/lib/supabase/admin'
import { decryptApiKey } from './crypto'
import { computeCost, DEFAULT_MODEL } from './pricing'

export type AIFeature =
  | 'flow_builder'
  | 'form_suggestions'
  | 'condition_parser'
  | 'trigger_assistant'

export interface CallAIParams {
  tenantId: string
  userId: string
  feature: AIFeature
  systemPrompt: string
  userContent: string
  maxTokens: number
}

export interface CallAIResult {
  text: string
  inputTokens: number
  outputTokens: number
  costUsd: number
}

interface TenantAIConfig {
  ai_enabled: boolean
  use_own_key: boolean
  provider: string
  api_key_encrypted: string | null
  credit_limit_usd: number
  credit_used_usd: number
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export async function callAI(params: CallAIParams): Promise<CallAIResult> {
  const { tenantId, userId, feature, systemPrompt, userContent, maxTokens } = params
  const db = createAdminClient()

  // Load tenant AI config (upsert default row if not yet created)
  const { data: config, error: configErr } = await db
    .from('tenant_ai_configs')
    .select(
      'ai_enabled, use_own_key, provider, api_key_encrypted, credit_limit_usd, credit_used_usd'
    )
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (configErr) throw new Error('Failed to load AI configuration.')

  if (!config || !config.ai_enabled) {
    throw new Error(
      'AI features are not enabled for your organisation. Contact your administrator.'
    )
  }

  const cfg = config as TenantAIConfig

  // Quota check — only applies when using the platform key
  if (!cfg.use_own_key) {
    if (cfg.credit_used_usd >= cfg.credit_limit_usd) {
      throw new Error(
        `Your organisation has reached its AI credit limit ($${cfg.credit_limit_usd.toFixed(2)}). Please contact your administrator to top up.`
      )
    }
  }

  // Resolve API key and model
  const provider = cfg.provider ?? 'anthropic'
  const model = DEFAULT_MODEL[provider] ?? DEFAULT_MODEL['anthropic']

  let apiKey: string | undefined
  if (cfg.use_own_key && cfg.api_key_encrypted) {
    try {
      apiKey = decryptApiKey(cfg.api_key_encrypted)
    } catch {
      throw new Error('Failed to decrypt your API key. Please re-enter it in AI settings.')
    }
  } else {
    // Platform key from env
    apiKey = provider === 'openai' ? process.env.OPENAI_API_KEY : process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new Error(`Platform ${provider} API key is not configured.`)
  }

  // ── Call the provider ────────────────────────────────────────────────────────
  let result: CallAIResult

  if (provider === 'openai') {
    result = await callOpenAI(apiKey, model, systemPrompt, userContent, maxTokens)
  } else {
    result = await callAnthropic(apiKey, model, systemPrompt, userContent, maxTokens)
  }

  // ── Log usage ────────────────────────────────────────────────────────────────
  await db.from('ai_usage_logs').insert({
    tenant_id: tenantId,
    user_id: userId,
    feature,
    provider,
    model,
    input_tokens: result.inputTokens,
    output_tokens: result.outputTokens,
    cost_usd: result.costUsd,
    using_own_key: cfg.use_own_key,
  })

  // ── Increment platform quota usage (atomic, only for platform key) ───────────
  if (!cfg.use_own_key) {
    await db.rpc('increment_ai_credit_used', {
      p_tenant_id: tenantId,
      p_amount: result.costUsd,
    })
  }

  return result
}

// ─── Anthropic ────────────────────────────────────────────────────────────────

async function callAnthropic(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userContent: string,
  maxTokens: number
): Promise<CallAIResult> {
  const client = new Anthropic({ apiKey })
  const message = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: 'user', content: userContent }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
  const inputTokens = message.usage.input_tokens
  const outputTokens = message.usage.output_tokens
  return { text, inputTokens, outputTokens, costUsd: computeCost(model, inputTokens, outputTokens) }
}

// ─── OpenAI ───────────────────────────────────────────────────────────────────

async function callOpenAI(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userContent: string,
  maxTokens: number
): Promise<CallAIResult> {
  const client = new OpenAI({ apiKey })
  const completion = await client.chat.completions.create({
    model,
    max_tokens: maxTokens,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
  })

  const text = completion.choices[0]?.message?.content?.trim() ?? ''
  const inputTokens = completion.usage?.prompt_tokens ?? 0
  const outputTokens = completion.usage?.completion_tokens ?? 0
  return { text, inputTokens, outputTokens, costUsd: computeCost(model, inputTokens, outputTokens) }
}
