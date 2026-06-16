-- Phase 19 M2: API keys for REST trigger endpoint

CREATE TABLE IF NOT EXISTS tenant_api_keys (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name         TEXT        NOT NULL,
  key_hash     TEXT        NOT NULL UNIQUE,
  last_used_at TIMESTAMPTZ,
  call_count_30d INTEGER   NOT NULL DEFAULT 0,
  created_by   UUID        NOT NULL REFERENCES users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS tenant_api_keys_tenant_id_idx ON tenant_api_keys(tenant_id);
CREATE INDEX IF NOT EXISTS tenant_api_keys_key_hash_idx  ON tenant_api_keys(key_hash);

ALTER TABLE tenant_api_keys ENABLE ROW LEVEL SECURITY;
-- All access goes through createAdminClient() — no direct client-side access needed.
