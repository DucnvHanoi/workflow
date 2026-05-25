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

// Default models per provider used when tenant has not specified otherwise
export const DEFAULT_MODEL: Record<string, string> = {
  anthropic: 'claude-sonnet-4-6',
  openai: 'gpt-4o-mini',
}

export function computeCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = MODEL_PRICING[model]
  if (!pricing) return 0
  return (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000
}
