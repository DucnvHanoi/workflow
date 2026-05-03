-- ============================================================
-- Fix RLS policies to read tenant_id from app_metadata
-- (populated by custom_access_token_hook)
-- ============================================================

-- Helper: a stable, inlineable expression for the current tenant
-- Usage in policies: (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid

-- Re-create the tenants table policy (drop old, create new)
DROP POLICY IF EXISTS tenant_isolation_select ON public.tenants;

CREATE POLICY tenant_isolation_select ON public.tenants
  FOR SELECT
  USING (
    id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
  );

-- Re-create users table policies
DROP POLICY IF EXISTS tenant_isolation_select ON public.users;
DROP POLICY IF EXISTS tenant_isolation_insert ON public.users;

CREATE POLICY tenant_isolation_select ON public.users
  FOR SELECT
  USING (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
  );

CREATE POLICY tenant_isolation_insert ON public.users
  FOR INSERT
  WITH CHECK (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
  );

-- Re-create departments table policies
DROP POLICY IF EXISTS tenant_isolation_select ON public.departments;
DROP POLICY IF EXISTS tenant_isolation_insert ON public.departments;

CREATE POLICY tenant_isolation_select ON public.departments
  FOR SELECT
  USING (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
  );

CREATE POLICY tenant_isolation_insert ON public.departments
  FOR INSERT
  WITH CHECK (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
  );

-- Re-create flows table policies
DROP POLICY IF EXISTS tenant_isolation_select ON public.flows;
DROP POLICY IF EXISTS tenant_isolation_insert ON public.flows;

CREATE POLICY tenant_isolation_select ON public.flows
  FOR SELECT
  USING (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
  );

CREATE POLICY tenant_isolation_insert ON public.flows
  FOR INSERT
  WITH CHECK (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
  );