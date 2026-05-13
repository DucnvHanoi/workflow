-- Migration: add flow_categories table + category_id FK on flows
-- Run: npx supabase db push  (or paste into Supabase SQL editor)

-- ─── 1. flow_categories table ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.flow_categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name        text NOT NULL,
  color       text NOT NULL DEFAULT '#6366f1', -- tailwind indigo-500 hex
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)               -- no duplicate category names per tenant
);

-- ─── 2. Add category_id to flows (nullable — existing rows = Uncategorized) ──

ALTER TABLE public.flows
  ADD COLUMN IF NOT EXISTS category_id uuid
    REFERENCES public.flow_categories(id) ON DELETE SET NULL;

-- ─── 3. RLS on flow_categories ───────────────────────────────────────────────

ALTER TABLE public.flow_categories ENABLE ROW LEVEL SECURITY;

-- All tenant members can read categories (needed for user-facing flow list)
CREATE POLICY "tenant_members_select_categories"
  ON public.flow_categories
  FOR SELECT
  USING (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
  );

-- Only admins can insert categories
CREATE POLICY "admin_insert_categories"
  ON public.flow_categories
  FOR INSERT
  WITH CHECK (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- Only admins can update categories
CREATE POLICY "admin_update_categories"
  ON public.flow_categories
  FOR UPDATE
  USING (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  )
  WITH CHECK (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- Only admins can delete categories
CREATE POLICY "admin_delete_categories"
  ON public.flow_categories
  FOR DELETE
  USING (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- ─── 4. Index for fast lookup ─────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_flow_categories_tenant
  ON public.flow_categories(tenant_id);

CREATE INDEX IF NOT EXISTS idx_flows_category_id
  ON public.flows(category_id);