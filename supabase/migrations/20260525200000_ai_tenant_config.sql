-- =============================================================================
-- Migration: ai_tenant_config
-- Creates: tenant_ai_configs, ai_usage_logs
-- =============================================================================

-- ── tenant_ai_configs ─────────────────────────────────────────────────────────
-- One row per tenant. Tenant admins manage their own row.
-- Platform admin sets credit_limit_usd; tenant cannot change it themselves.

CREATE TABLE IF NOT EXISTS public.tenant_ai_configs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  ai_enabled          boolean NOT NULL DEFAULT false,
  use_own_key         boolean NOT NULL DEFAULT false,
  -- 'anthropic' | 'openai' — only relevant when use_own_key = true
  provider            text NOT NULL DEFAULT 'anthropic'
                        CHECK (provider IN ('anthropic', 'openai')),
  -- AES-256-GCM encrypted: iv:tag:ciphertext (hex)
  api_key_encrypted   text,
  -- credit quota for platform-key usage (USD). NULL = unlimited.
  credit_limit_usd    numeric(10, 4) NOT NULL DEFAULT 5.0000,
  -- running total of platform-key spend (incremented per call, never decremented)
  credit_used_usd     numeric(10, 4) NOT NULL DEFAULT 0.0000,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tenant_ai_configs ENABLE ROW LEVEL SECURITY;

-- Tenant admins can read their own config
CREATE POLICY ai_config_select ON public.tenant_ai_configs
  FOR SELECT
  USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

-- Tenant admins can update their own config (except credit_limit_usd — enforced in server action)
CREATE POLICY ai_config_update ON public.tenant_ai_configs
  FOR UPDATE
  USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

-- ── ai_usage_logs ─────────────────────────────────────────────────────────────
-- Append-only audit + billing log. One row per AI API call.

CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id         uuid REFERENCES public.users(id) ON DELETE SET NULL,
  -- which AI feature triggered this call
  feature         text NOT NULL
                    CHECK (feature IN ('flow_builder', 'form_suggestions', 'condition_parser', 'trigger_assistant')),
  provider        text NOT NULL CHECK (provider IN ('anthropic', 'openai')),
  model           text NOT NULL,
  input_tokens    integer NOT NULL DEFAULT 0,
  output_tokens   integer NOT NULL DEFAULT 0,
  -- computed cost in USD at time of call
  cost_usd        numeric(10, 6) NOT NULL DEFAULT 0,
  -- true = tenant's own key was used (not billed against platform quota)
  using_own_key   boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

-- Tenant admins can read their own logs (for usage dashboard)
CREATE POLICY ai_logs_select ON public.ai_usage_logs
  FOR SELECT
  USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

-- Index for dashboard queries (tenant + time range)
CREATE INDEX ai_usage_logs_tenant_created ON public.ai_usage_logs (tenant_id, created_at DESC);
CREATE INDEX ai_usage_logs_feature ON public.ai_usage_logs (tenant_id, feature);
