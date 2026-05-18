-- FILE PATH: supabase/migrations/TIMESTAMP_add_department_head.sql
-- Adds head_user_id to departments table.
-- ON DELETE SET NULL: if the head user is deleted, the dept head is simply cleared.

ALTER TABLE public.departments
  ADD COLUMN IF NOT EXISTS head_user_id uuid
    REFERENCES public.users(id)
    ON DELETE SET NULL;

COMMENT ON COLUMN public.departments.head_user_id IS
  'Explicitly designated department head. Used by resolve-assignee Edge Function. Falls back to alphabetical-first user if null.';