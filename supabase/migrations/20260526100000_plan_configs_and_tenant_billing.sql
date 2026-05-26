-- =============================================================================
-- Migration: plan_configs + billing columns on tenants
-- Creates: plan_configs table, seeds plan rows, extends tenants with billing fields
-- =============================================================================

-- ── plan_configs ─────────────────────────────────────────────────────────────
-- Platform-wide config. One row per plan. All limits come from here — never
-- hard-coded in application code. Platform admin (M9) will CRUD this table.

CREATE TABLE IF NOT EXISTS public.plan_configs (
  plan                    text PRIMARY KEY
                            CHECK (plan IN ('free', 'pro', 'enterprise')),
  max_users               integer,
  max_flows               integer,
  max_departments         integer,
  report_window_days      integer,
  ai_enabled              boolean NOT NULL DEFAULT false,
  -- NULL = unlimited or custom per-tenant (enterprise)
  ai_credit_limit_usd     numeric(10, 4),
  -- 'monthly' | 'never' | 'none'  (none = enterprise, governed by tenant_ai_configs)
  ai_credit_reset         text CHECK (ai_credit_reset IN ('monthly', 'never', 'none')),
  price_per_user_cents    integer NOT NULL DEFAULT 0,
  updated_at              timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.plan_configs ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read plan limits (server-side getLimits() calls)
CREATE POLICY plan_configs_select ON public.plan_configs
  FOR SELECT TO authenticated
  USING (true);

-- ── Seed plan rows ────────────────────────────────────────────────────────────

INSERT INTO public.plan_configs
  (plan, max_users, max_flows, max_departments, report_window_days,
   ai_enabled, ai_credit_limit_usd, ai_credit_reset, price_per_user_cents)
VALUES
  ('free',       10,   2,    5,    7,    false, 1.0000,  'never',   0),
  ('pro',        100,  NULL, NULL, NULL, true,  50.0000, 'monthly', 500),
  ('enterprise', NULL, NULL, NULL, NULL, true,  NULL,    'none',    0)
ON CONFLICT (plan) DO UPDATE SET
  max_users            = EXCLUDED.max_users,
  max_flows            = EXCLUDED.max_flows,
  max_departments      = EXCLUDED.max_departments,
  report_window_days   = EXCLUDED.report_window_days,
  ai_enabled           = EXCLUDED.ai_enabled,
  ai_credit_limit_usd  = EXCLUDED.ai_credit_limit_usd,
  ai_credit_reset      = EXCLUDED.ai_credit_reset,
  price_per_user_cents = EXCLUDED.price_per_user_cents,
  updated_at           = now();

-- ── Billing columns on tenants ────────────────────────────────────────────────

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS status                 text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'trial', 'suspended')),
  ADD COLUMN IF NOT EXISTS trial_ends_at          timestamptz,
  ADD COLUMN IF NOT EXISTS stripe_customer_id     text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS current_period_start   timestamptz;
