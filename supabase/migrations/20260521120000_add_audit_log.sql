-- ============================================================
-- Migration: add_audit_log
-- FILE PATH: supabase/migrations/20260521120000_add_audit_log.sql
-- Administrative / structural audit trail — distinct from flow_event_logs
-- (which records runtime flow execution events). This table records admin
-- actions: role changes, flow publish/unpublish, and step reassignments.
-- ============================================================

CREATE TABLE audit_log (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Tenant this event belongs to (for RLS isolation)
  tenant_id    uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  -- Admin who performed the action (null if the user was later removed)
  actor_id     uuid REFERENCES users(id) ON DELETE SET NULL,
  -- The kind of administrative action
  action       text NOT NULL CHECK (action IN (
    'role_changed',       -- a user's role was changed (user <-> admin)
    'flow_published',     -- a flow version was published
    'flow_unpublished',   -- a flow was reverted to draft
    'step_reassigned'     -- a pending step was reassigned to another user
  )),
  -- Polymorphic target: which kind of entity, its id, and a stored display label
  target_type  text NOT NULL CHECK (target_type IN ('user', 'flow', 'step_instance')),
  target_id    uuid,
  target_label text,
  -- Human-readable summary, e.g. "Changed role of Jane Doe from user to admin"
  description  text NOT NULL,
  -- Structured detail (old/new role, version number, assignee ids, etc.)
  metadata     jsonb NOT NULL DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Indexes for the audit subpage queries
CREATE INDEX audit_log_tenant_id_idx  ON audit_log(tenant_id);
CREATE INDEX audit_log_created_at_idx ON audit_log(created_at);
CREATE INDEX audit_log_action_idx     ON audit_log(action);

-- RLS: tenant-isolated reads. Writes happen via the service-role admin client
-- (which bypasses RLS), so no INSERT/UPDATE/DELETE policies are defined.
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_log_tenant_select"
  ON audit_log FOR SELECT
  USING (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
  );
