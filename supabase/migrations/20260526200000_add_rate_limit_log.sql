CREATE TABLE IF NOT EXISTS public.rate_limit_log (
  key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rate_limit_log_key_created_at_idx
  ON public.rate_limit_log (key, created_at);
