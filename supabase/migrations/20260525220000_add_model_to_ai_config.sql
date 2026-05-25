-- =============================================================================
-- Migration: add model column to tenant_ai_configs
-- =============================================================================

ALTER TABLE public.tenant_ai_configs
  ADD COLUMN IF NOT EXISTS model text NOT NULL DEFAULT 'claude-sonnet-4-6';
