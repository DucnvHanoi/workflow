-- ============================================================
-- Migration: add_flow_event_logs
-- FILE PATH: supabase/migrations/20260515130000_add_flow_event_logs.sql
-- Replace TIMESTAMP with the actual timestamp prefix, e.g. 20250615120000
-- ============================================================

-- 1. Add 'error' as a valid status on flow_instances
--    Supabase Postgres uses check constraints, not enums by default.
--    If you used a Postgres ENUM, use the ALTER TYPE approach instead.
--    This migration assumes the status column is TEXT with a CHECK constraint.

ALTER TABLE flow_instances
  DROP CONSTRAINT IF EXISTS flow_instances_status_check;

ALTER TABLE flow_instances
  ADD CONSTRAINT flow_instances_status_check
  CHECK (status IN ('pending', 'completed', 'cancelled', 'error'));

-- 2. Create flow_event_logs table
CREATE TABLE flow_event_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Which instance this event belongs to
  instance_id   uuid NOT NULL REFERENCES flow_instances(id) ON DELETE CASCADE,
  -- Which step_instance triggered this event (null for flow-level events like trigger/complete)
  step_instance_id uuid REFERENCES step_instances(id) ON DELETE SET NULL,
  -- The tenant this event belongs to (for RLS)
  tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  -- Who performed the action (null for system events)
  actor_id      uuid REFERENCES users(id) ON DELETE SET NULL,
  -- Event type — one of a known set
  event_type    text NOT NULL CHECK (event_type IN (
    'flow_triggered',     -- user started the flow
    'step_assigned',      -- a step was assigned to someone
    'step_draft_saved',   -- user saved a draft of their form
    'step_submitted',     -- user submitted their form
    'branch_evaluated',   -- branch node was evaluated (records which path was taken)
    'flow_completed',     -- flow reached the complete node
    'flow_error',         -- flow entered error state (e.g. misconfigured branch)
    'flow_cancelled'      -- flow was cancelled by admin
  )),
  -- Human-readable description, e.g. "Manager John approved at Step 2"
  description   text NOT NULL,
  -- Any extra structured data (branch path taken, field values, error details)
  metadata      jsonb NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- 3. Indexes for fast queries
CREATE INDEX flow_event_logs_instance_id_idx ON flow_event_logs(instance_id);
CREATE INDEX flow_event_logs_tenant_id_idx   ON flow_event_logs(tenant_id);
CREATE INDEX flow_event_logs_created_at_idx  ON flow_event_logs(created_at);

-- 4. RLS
ALTER TABLE flow_event_logs ENABLE ROW LEVEL SECURITY;

-- Any authenticated user in the same tenant can read logs
-- (they see logs for instances they are involved in — enforced in the server action)
CREATE POLICY "tenant_isolation_select"
  ON flow_event_logs FOR SELECT
  USING (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
  );

-- Writes happen only via service role (adminClient) — no direct user inserts
-- No INSERT/UPDATE/DELETE RLS policies needed (service role bypasses RLS)
