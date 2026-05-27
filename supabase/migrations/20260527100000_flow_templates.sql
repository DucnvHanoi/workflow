-- Flow templates (platform-level, no tenant_id)
-- Created and managed exclusively by the platform admin.
-- Published templates are readable by all authenticated tenant users.

CREATE TABLE public.flow_templates (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL DEFAULT 'Untitled Template',
  description text,
  category    text        NOT NULL DEFAULT 'other'
                          CHECK (category IN ('hr', 'finance', 'it', 'operations', 'other')),
  graph       jsonb,
  is_published boolean    NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.flow_templates ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read published templates (tenant browse + clone)
CREATE POLICY "published templates readable by authenticated users"
  ON public.flow_templates FOR SELECT
  TO authenticated
  USING (is_published = true);

-- All writes go through server actions that use the service-role client
-- (bypasses RLS), so no write policies are needed here.

CREATE INDEX idx_flow_templates_published ON public.flow_templates (is_published, category)
  WHERE is_published = true;
