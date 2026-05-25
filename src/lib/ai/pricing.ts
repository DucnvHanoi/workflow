// Cost per 1M tokens in USD for each supported model.
// Update when Anthropic / OpenAI change their pricing.

export interface ModelPricing {
  input: number // USD per 1M input tokens
  output: number // USD per 1M output tokens
}

export const MODEL_PRICING: Record<string, ModelPricing> = {
  // Anthropic
  'claude-sonnet-4-6': { input: 3.0, output: 15.0 },
  'claude-haiku-4-5': { input: 1.0, output: 5.0 },
  'claude-opus-4-7': { input: 5.0, output: 25.0 },
  // OpenAI
  'gpt-4o': { input: 2.5, output: 10.0 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
}

// Default model per provider (used as fallback and when provider changes)
export const DEFAULT_MODEL: Record<string, string> = {
  anthropic: 'claude-sonnet-4-6',
  openai: 'gpt-4o-mini',
}

// Available models per provider shown in the settings UI
export interface ModelInfo {
  id: string
  name: string
  description: string // capability summary
  pricing: string // short human-readable pricing hint
}

export const MODELS_BY_PROVIDER: Record<string, ModelInfo[]> = {
  anthropic: [
    {
      id: 'claude-haiku-4-5',
      name: 'Claude Haiku 4.5',
      description: 'Fastest and most affordable',
      pricing: '$1 / $5 per 1M tokens',
    },
    {
      id: 'claude-sonnet-4-6',
      name: 'Claude Sonnet 4.6',
      description: 'Balanced performance and cost',
      pricing: '$3 / $15 per 1M tokens',
    },
    {
      id: 'claude-opus-4-7',
      name: 'Claude Opus 4.7',
      description: 'Most intelligent and capable',
      pricing: '$5 / $25 per 1M tokens',
    },
  ],
  openai: [
    {
      id: 'gpt-4o-mini',
      name: 'GPT-4o mini',
      description: 'Fastest and most affordable',
      pricing: '$0.15 / $0.60 per 1M tokens',
    },
    {
      id: 'gpt-4o',
      name: 'GPT-4o',
      description: 'Powerful, great for complex tasks',
      pricing: '$2.50 / $10 per 1M tokens',
    },
  ],
}

export function computeCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = MODEL_PRICING[model]
  if (!pricing) return 0
  return (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000
}
