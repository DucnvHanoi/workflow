-- Add Lemon Squeezy subscription fields to tenants
-- These are written by the webhook handler when a subscription is created/updated.

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS lemon_customer_id     TEXT,
  ADD COLUMN IF NOT EXISTS lemon_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS lemon_renews_at        TIMESTAMPTZ;
