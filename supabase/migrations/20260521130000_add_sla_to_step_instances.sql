-- ============================================================
-- Migration: add_sla_to_step_instances
-- Adds due_at to step_instances for SLA tracking (Phase 5, Milestone 1).
-- Also extends audit_log.action CHECK for the upcoming step_escalated action.
-- ============================================================

-- Add due_at column to step_instances (nullable — only set when a step has an SLA)
ALTER TABLE step_instances ADD COLUMN IF NOT EXISTS due_at timestamptz;

-- Partial index: only index rows that have a due_at set (efficient for cron scan)
CREATE INDEX IF NOT EXISTS step_instances_due_at_idx
  ON step_instances (due_at)
  WHERE due_at IS NOT NULL;

-- Extend audit_log.action CHECK constraint to include step_escalated.
-- PostgreSQL requires DROP + re-ADD to change a CHECK constraint.
ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_action_check;
ALTER TABLE audit_log ADD CONSTRAINT audit_log_action_check
  CHECK (action IN (
    'role_changed',
    'flow_published',
    'flow_unpublished',
    'step_reassigned',
    'step_escalated'
  ));
