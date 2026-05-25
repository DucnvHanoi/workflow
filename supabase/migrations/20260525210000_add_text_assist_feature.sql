-- =============================================================================
-- Migration: add text_assist to ai_usage_logs.feature CHECK constraint
-- =============================================================================

ALTER TABLE public.ai_usage_logs
  DROP CONSTRAINT IF EXISTS ai_usage_logs_feature_check;

ALTER TABLE public.ai_usage_logs
  ADD CONSTRAINT ai_usage_logs_feature_check
    CHECK (feature IN (
      'flow_builder',
      'form_suggestions',
      'condition_parser',
      'trigger_assistant',
      'text_assist'
    ));
