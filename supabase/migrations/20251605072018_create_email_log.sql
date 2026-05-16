-- Migration: add_notification_logs
-- Logs every email attempt (sent or failed).
-- Writes via service role only (adminClient). Never blocks the flow.

CREATE TABLE notification_logs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL,
  instance_id      uuid REFERENCES flow_instances(id) ON DELETE CASCADE,
  step_instance_id uuid REFERENCES step_instances(id) ON DELETE SET NULL,
  recipient_email  text NOT NULL,
  email_type       text NOT NULL,     -- 'step_assigned' | 'flow_completed'
  status           text NOT NULL,     -- 'sent' | 'failed'
  resend_id        text,              -- Resend message ID (present when status='sent')
  error_message    text,              -- present when status='failed'
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- Constraint: only known email types
ALTER TABLE notification_logs
  ADD CONSTRAINT notification_logs_email_type_check
  CHECK (email_type IN ('step_assigned', 'flow_completed'));

-- Constraint: only known statuses
ALTER TABLE notification_logs
  ADD CONSTRAINT notification_logs_status_check
  CHECK (status IN ('sent', 'failed'));

-- Index for admin dashboard lookups (Phase 4)
CREATE INDEX notification_logs_instance_id_idx
  ON notification_logs (instance_id);

CREATE INDEX notification_logs_tenant_id_created_at_idx
  ON notification_logs (tenant_id, created_at DESC);

-- RLS
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;

-- Admins can read their own tenant's logs (for Phase 4 dashboard)
CREATE POLICY "tenant_admin_select"
  ON notification_logs
  FOR SELECT
  USING (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- No INSERT/UPDATE/DELETE via RLS — all writes use service role (adminClient)