-- Enable RLS on three tables that are accessed exclusively via the service-role
-- admin client (createAdminClient). No policies are needed because the service
-- role bypasses RLS entirely. Enabling RLS with zero policies means any attempt
-- to access these tables via the anon/authenticated PostgREST role is denied.

ALTER TABLE public.rate_limit_log        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_ai_config    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_ai_usage_logs ENABLE ROW LEVEL SECURITY;
