-- ============================================================
-- Migration: add_user_deactivation
-- Adds is_active flag to users for soft-deactivation (Phase 6, Milestone 1).
-- Also extends audit_log.action CHECK for deactivation and bulk reassignment.
-- ============================================================

-- is_active: false = deactivated (also banned in Supabase Auth).
-- Existing users default to active.
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- Index for filtering active-only users in assignee resolution queries.
CREATE INDEX IF NOT EXISTS users_is_active_idx
  ON users (tenant_id, is_active);

-- Extend audit_log.action CHECK to include deactivation and bulk reassignment.
-- PostgreSQL requires DROP + re-ADD to change a CHECK constraint.
ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_action_check;
ALTER TABLE audit_log ADD CONSTRAINT audit_log_action_check
  CHECK (action IN (
    'role_changed',
    'flow_published',
    'flow_unpublished',
    'step_reassigned',
    'step_escalated',
    'user_deactivated',
    'user_reactivated',
    'tasks_bulk_reassigned'
  ));
