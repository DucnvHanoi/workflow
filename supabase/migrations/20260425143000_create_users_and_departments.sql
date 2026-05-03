-- =============================================================================
-- Migration: create_users_and_departments
-- Creates: public.users, public.departments
-- Note: public.users.id references auth.users(id) — Supabase identity source
-- =============================================================================

-- -----------------------------------------------------------------------------
-- TABLE: departments
-- Created BEFORE users because users.department_id references it
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.departments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name        text NOT NULL,
  parent_id   uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

CREATE POLICY departments_select ON public.departments
  FOR SELECT
  USING ( tenant_id = (auth.jwt() ->> 'tenant_id')::uuid );

CREATE POLICY departments_insert ON public.departments
  FOR INSERT
  WITH CHECK ( tenant_id = (auth.jwt() ->> 'tenant_id')::uuid );

CREATE POLICY departments_update ON public.departments
  FOR UPDATE
  USING ( tenant_id = (auth.jwt() ->> 'tenant_id')::uuid )
  WITH CHECK ( tenant_id = (auth.jwt() ->> 'tenant_id')::uuid );

CREATE POLICY departments_delete ON public.departments
  FOR DELETE
  USING ( tenant_id = (auth.jwt() ->> 'tenant_id')::uuid );

-- -----------------------------------------------------------------------------
-- TABLE: public.users (profile table — extends auth.users)
-- id mirrors auth.users(id) exactly — one row per auth user
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
  id             uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id      uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  email          text NOT NULL,
  full_name      text,
  role           text NOT NULL DEFAULT 'user'
                   CHECK (role IN ('admin', 'user')),
  manager_id     uuid REFERENCES public.users(id) ON DELETE SET NULL,
  department_id  uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_select ON public.users
  FOR SELECT
  USING ( tenant_id = (auth.jwt() ->> 'tenant_id')::uuid );

CREATE POLICY users_insert ON public.users
  FOR INSERT
  WITH CHECK ( tenant_id = (auth.jwt() ->> 'tenant_id')::uuid );

CREATE POLICY users_update ON public.users
  FOR UPDATE
  USING ( tenant_id = (auth.jwt() ->> 'tenant_id')::uuid )
  WITH CHECK ( tenant_id = (auth.jwt() ->> 'tenant_id')::uuid );

CREATE POLICY users_delete ON public.users
  FOR DELETE
  USING ( tenant_id = (auth.jwt() ->> 'tenant_id')::uuid );

-- -----------------------------------------------------------------------------
-- updated_at triggers
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER departments_updated_at
  BEFORE UPDATE ON public.departments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();