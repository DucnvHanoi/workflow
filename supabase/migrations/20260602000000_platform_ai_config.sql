-- =============================================================================
-- Migration: platform_ai_config + platform_ai_usage_logs
-- Platform-owner AI configuration for inbound support email responses.
-- No tenant isolation — service-role access only (no RLS needed).
-- =============================================================================

-- Singleton table: only one row allowed via PRIMARY KEY on a boolean column.
CREATE TABLE IF NOT EXISTS public.platform_ai_config (
  singleton                 boolean PRIMARY KEY DEFAULT TRUE,
  CONSTRAINT singleton_only CHECK (singleton = TRUE),
  ai_enabled                boolean     NOT NULL DEFAULT false,
  provider                  text        NOT NULL DEFAULT 'anthropic'
                              CHECK (provider IN ('anthropic', 'openai')),
  model                     text        NOT NULL DEFAULT 'claude-sonnet-4-6',
  -- Stored independently so the owner can pre-enter both keys and switch providers freely
  anthropic_key_encrypted   text,
  openai_key_encrypted      text,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

-- Per-call audit + cost log for support email AI responses
CREATE TABLE IF NOT EXISTS public.platform_ai_usage_logs (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  feature       text        NOT NULL DEFAULT 'support_email',
  provider      text        NOT NULL CHECK (provider IN ('anthropic', 'openai')),
  model         text        NOT NULL,
  input_tokens  integer     NOT NULL DEFAULT 0,
  output_tokens integer     NOT NULL DEFAULT 0,
  cost_usd      numeric(10, 6) NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX platform_ai_usage_logs_created ON public.platform_ai_usage_logs (created_at DESC);
