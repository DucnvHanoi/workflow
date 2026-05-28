-- Flow-level comment history visibility toggle
ALTER TABLE flows
  ADD COLUMN IF NOT EXISTS show_full_comment_history boolean NOT NULL DEFAULT true;

-- Per-instance comment thread
CREATE TABLE IF NOT EXISTS instance_comments (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id   uuid REFERENCES tenants(id)       ON DELETE CASCADE NOT NULL,
  instance_id uuid REFERENCES flow_instances(id) ON DELETE CASCADE NOT NULL,
  user_id     uuid REFERENCES auth.users(id)     ON DELETE CASCADE NOT NULL,
  body        text NOT NULL
              CHECK (char_length(trim(body)) > 0 AND char_length(body) <= 2000),
  created_at  timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_instance_comments_instance
  ON instance_comments (instance_id, created_at);

CREATE INDEX IF NOT EXISTS idx_instance_comments_tenant
  ON instance_comments (tenant_id);

ALTER TABLE instance_comments ENABLE ROW LEVEL SECURITY;

-- Tenant isolation — server actions use admin client, but RLS is a safety net
CREATE POLICY "tenant_isolation" ON instance_comments
  FOR ALL USING (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
  );
