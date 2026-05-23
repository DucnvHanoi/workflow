-- Phase 7 M3: track sent invitations so admins can resend or revoke them

CREATE TABLE pending_invitations (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email           text        NOT NULL,
  invited_by      uuid        REFERENCES users(id) ON DELETE SET NULL,
  user_id         uuid        REFERENCES users(id) ON DELETE SET NULL,
  invited_at      timestamptz NOT NULL DEFAULT now(),
  resend_count    integer     NOT NULL DEFAULT 0,
  last_resent_at  timestamptz,
  revoked_at      timestamptz,
  status          text        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'accepted', 'revoked'))
);

CREATE INDEX idx_pending_invitations_tenant_status
  ON pending_invitations(tenant_id, status, invited_at DESC);

ALTER TABLE pending_invitations ENABLE ROW LEVEL SECURITY;

-- Admins can SELECT within their own tenant
CREATE POLICY "admin_tenant_select" ON pending_invitations
  FOR SELECT USING (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );
