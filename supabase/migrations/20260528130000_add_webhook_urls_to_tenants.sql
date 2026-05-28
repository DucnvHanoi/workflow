ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS slack_webhook_url TEXT,
  ADD COLUMN IF NOT EXISTS teams_webhook_url TEXT;
