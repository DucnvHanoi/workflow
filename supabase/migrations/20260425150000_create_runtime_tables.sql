-- =============================================================================
-- Migration: create_runtime_tables
-- Creates: flows, flow_versions, flow_instances, step_instances, step_attachments
-- Depends on: tenants, public.users, departments (must exist first)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- TABLE: flows
-- Parent record for a workflow — versions hang off this
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.flows (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name              text NOT NULL,
  status            text NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft', 'published')),
  latest_version_id uuid,  -- FK added below after flow_versions is created
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.flows ENABLE ROW LEVEL SECURITY;

CREATE POLICY flows_select ON public.flows
  FOR SELECT
  USING ( tenant_id = (auth.jwt() ->> 'tenant_id')::uuid );

CREATE POLICY flows_insert ON public.flows
  FOR INSERT
  WITH CHECK ( tenant_id = (auth.jwt() ->> 'tenant_id')::uuid );

CREATE POLICY flows_update ON public.flows
  FOR UPDATE
  USING ( tenant_id = (auth.jwt() ->> 'tenant_id')::uuid )
  WITH CHECK ( tenant_id = (auth.jwt() ->> 'tenant_id')::uuid );

CREATE POLICY flows_delete ON public.flows
  FOR DELETE
  USING ( tenant_id = (auth.jwt() ->> 'tenant_id')::uuid );

-- -----------------------------------------------------------------------------
-- TABLE: flow_versions
-- Each publish = one immutable snapshot of the canvas graph as JSONB
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.flow_versions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id         uuid NOT NULL REFERENCES public.flows(id) ON DELETE CASCADE,
  version_number  integer NOT NULL DEFAULT 1,
  graph           jsonb NOT NULL DEFAULT '{}'::jsonb,
  published_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),

  UNIQUE (flow_id, version_number)
);

ALTER TABLE public.flow_versions ENABLE ROW LEVEL SECURITY;

-- No direct tenant_id — scoped through flows
CREATE POLICY flow_versions_select ON public.flow_versions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.flows f
      WHERE f.id = flow_versions.flow_id
        AND f.tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    )
  );

CREATE POLICY flow_versions_insert ON public.flow_versions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.flows f
      WHERE f.id = flow_versions.flow_id
        AND f.tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    )
  );

CREATE POLICY flow_versions_update ON public.flow_versions
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.flows f
      WHERE f.id = flow_versions.flow_id
        AND f.tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    )
  );

-- Resolve circular FK now that flow_versions exists
ALTER TABLE public.flows
  ADD CONSTRAINT flows_latest_version_id_fkey
  FOREIGN KEY (latest_version_id)
  REFERENCES public.flow_versions(id)
  ON DELETE SET NULL;

-- -----------------------------------------------------------------------------
-- TABLE: flow_instances
-- One row per triggered workflow run
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.flow_instances (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_version_id  uuid NOT NULL REFERENCES public.flow_versions(id),
  triggered_by     uuid NOT NULL REFERENCES public.users(id),
  current_step_id  text,
  status           text NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'completed', 'cancelled')),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.flow_instances ENABLE ROW LEVEL SECURITY;

-- Scoped through flow_versions → flows → tenant_id
CREATE POLICY flow_instances_select ON public.flow_instances
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.flow_versions fv
      JOIN public.flows f ON f.id = fv.flow_id
      WHERE fv.id = flow_instances.flow_version_id
        AND f.tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    )
  );

CREATE POLICY flow_instances_insert ON public.flow_instances
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.flow_versions fv
      JOIN public.flows f ON f.id = fv.flow_id
      WHERE fv.id = flow_instances.flow_version_id
        AND f.tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    )
  );

CREATE POLICY flow_instances_update ON public.flow_instances
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.flow_versions fv
      JOIN public.flows f ON f.id = fv.flow_id
      WHERE fv.id = flow_instances.flow_version_id
        AND f.tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    )
  );

-- -----------------------------------------------------------------------------
-- TABLE: step_instances
-- One row per step a user must complete within a flow_instance
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.step_instances (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id      uuid NOT NULL REFERENCES public.flow_instances(id) ON DELETE CASCADE,
  step_id          text NOT NULL,
  assigned_to      uuid REFERENCES public.users(id),
  form_data        jsonb NOT NULL DEFAULT '{}'::jsonb,
  status           text NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'completed', 'skipped')),
  completed_at     timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.step_instances ENABLE ROW LEVEL SECURITY;

-- Scoped through flow_instances → flow_versions → flows → tenant_id
CREATE POLICY step_instances_select ON public.step_instances
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.flow_instances fi
      JOIN public.flow_versions fv ON fv.id = fi.flow_version_id
      JOIN public.flows f ON f.id = fv.flow_id
      WHERE fi.id = step_instances.instance_id
        AND f.tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    )
  );

CREATE POLICY step_instances_insert ON public.step_instances
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.flow_instances fi
      JOIN public.flow_versions fv ON fv.id = fi.flow_version_id
      JOIN public.flows f ON f.id = fv.flow_id
      WHERE fi.id = step_instances.instance_id
        AND f.tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    )
  );

CREATE POLICY step_instances_update ON public.step_instances
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.flow_instances fi
      JOIN public.flow_versions fv ON fv.id = fi.flow_version_id
      JOIN public.flows f ON f.id = fv.flow_id
      WHERE fi.id = step_instances.instance_id
        AND f.tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    )
  );

-- -----------------------------------------------------------------------------
-- TABLE: step_attachments
-- File upload records — one row per uploaded file per field
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.step_attachments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  step_instance_id  uuid NOT NULL REFERENCES public.step_instances(id) ON DELETE CASCADE,
  field_key         text NOT NULL,
  storage_path      text NOT NULL,
  filename          text NOT NULL,
  size_bytes        bigint NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.step_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY step_attachments_select ON public.step_attachments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.step_instances si
      JOIN public.flow_instances fi ON fi.id = si.instance_id
      JOIN public.flow_versions fv ON fv.id = fi.flow_version_id
      JOIN public.flows f ON f.id = fv.flow_id
      WHERE si.id = step_attachments.step_instance_id
        AND f.tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    )
  );

CREATE POLICY step_attachments_insert ON public.step_attachments
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.step_instances si
      JOIN public.flow_instances fi ON fi.id = si.instance_id
      JOIN public.flow_versions fv ON fv.id = fi.flow_version_id
      JOIN public.flows f ON f.id = fv.flow_id
      WHERE si.id = step_attachments.step_instance_id
        AND f.tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    )
  );

-- -----------------------------------------------------------------------------
-- updated_at triggers for tables that have updated_at
-- Note: set_updated_at() function already created in Day 3 migration
-- -----------------------------------------------------------------------------
CREATE TRIGGER flows_updated_at
  BEFORE UPDATE ON public.flows
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER flow_instances_updated_at
  BEFORE UPDATE ON public.flow_instances
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();