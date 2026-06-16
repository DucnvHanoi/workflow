-- Phase 19 M1: Outbound custom webhooks infrastructure
-- tenant_custom_webhooks: one row per webhook URL configured by an admin
-- webhook_delivery_log: audit trail of every delivery attempt

CREATE TABLE public.tenant_custom_webhooks (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  url         TEXT        NOT NULL,
  secret      TEXT        NOT NULL,  -- HMAC-SHA256 signing secret (never exposed client-side)
  events      TEXT[]      NOT NULL DEFAULT '{}',  -- subscribed event types
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX tenant_custom_webhooks_tenant_idx
  ON public.tenant_custom_webhooks (tenant_id, is_active);

-- RLS: no direct client access — all mutations go through the admin client in server actions
ALTER TABLE public.tenant_custom_webhooks ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.webhook_delivery_log (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id      UUID        NOT NULL REFERENCES public.tenant_custom_webhooks(id) ON DELETE CASCADE,
  event_type      TEXT        NOT NULL,
  payload         JSONB       NOT NULL DEFAULT '{}',
  status          TEXT        NOT NULL CHECK (status IN ('delivered', 'failed')),
  attempt         INT         NOT NULL DEFAULT 1,
  response_status INT,
  response_body   TEXT,
  error_message   TEXT,
  delivered_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX webhook_delivery_log_webhook_idx
  ON public.webhook_delivery_log (webhook_id, created_at DESC);

ALTER TABLE public.webhook_delivery_log ENABLE ROW LEVEL SECURITY;
