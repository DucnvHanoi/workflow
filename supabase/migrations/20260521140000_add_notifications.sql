-- ============================================================
-- Migration: add_notifications
-- In-app notification center (Phase 5, Milestone 4).
-- Writes via service-role admin client; reads + updates via RLS
-- (each user sees only their own rows, tenant-scoped).
-- ============================================================

CREATE TABLE notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        text NOT NULL CHECK (type IN (
    'step_assigned',
    'flow_completed',
    'sla_reminder',
    'step_escalated'
  )),
  title       text NOT NULL,
  body        text NOT NULL,
  link        text,
  read_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Primary lookup: user's notification feed, newest first
CREATE INDEX notifications_user_id_created_at_idx
  ON notifications (user_id, created_at DESC);

-- Unread count scan (partial index, avoids full table scan)
CREATE INDEX notifications_unread_idx
  ON notifications (user_id)
  WHERE read_at IS NULL;

-- RLS: each user sees and updates only their own rows, within their tenant
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_user_select"
  ON notifications FOR SELECT
  USING (
    user_id = auth.uid()
    AND tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
  );

CREATE POLICY "notifications_user_update"
  ON notifications FOR UPDATE
  USING (
    user_id = auth.uid()
    AND tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
  );

-- Enable Supabase Realtime so the NotificationBell receives live inserts
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
