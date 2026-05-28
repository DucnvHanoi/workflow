-- Fix 1: Re-point instance_comments.user_id FK from auth.users → public.users
--        so PostgREST can resolve the users!user_id join in getComments.
ALTER TABLE instance_comments
  DROP CONSTRAINT instance_comments_user_id_fkey,
  ADD CONSTRAINT instance_comments_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Fix 2: Extend the notifications type check to include comment_added.
ALTER TABLE notifications
  DROP CONSTRAINT notifications_type_check,
  ADD CONSTRAINT notifications_type_check
    CHECK (type = ANY (ARRAY[
      'step_assigned'::text,
      'flow_completed'::text,
      'sla_reminder'::text,
      'step_escalated'::text,
      'comment_added'::text
    ]));
