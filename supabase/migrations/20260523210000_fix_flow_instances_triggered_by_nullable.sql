-- flow_instances.triggered_by has ON DELETE SET NULL on its FK but was declared NOT NULL,
-- causing user deletion to fail with a not-null constraint violation.
ALTER TABLE public.flow_instances
  ALTER COLUMN triggered_by DROP NOT NULL;
