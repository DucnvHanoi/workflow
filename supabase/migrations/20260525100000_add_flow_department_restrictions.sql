-- Add optional department-level trigger restrictions to flows.
-- When non-null and non-empty, triggerFlow checks that the caller's
-- department_id is in this list before creating an instance.
ALTER TABLE public.flows
  ADD COLUMN IF NOT EXISTS allowed_department_ids uuid[] DEFAULT NULL;
