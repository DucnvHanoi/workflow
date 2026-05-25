-- Add escalate_after_hours to step_instances.
-- Stores how many hours after due_at to escalate to the assignee's manager.
-- Copied from node graph config at step_instance creation time (like due_at).

ALTER TABLE step_instances ADD COLUMN IF NOT EXISTS escalate_after_hours integer;

-- Partial index for efficient cron scan
CREATE INDEX IF NOT EXISTS step_instances_escalate_idx
  ON step_instances (due_at, escalate_after_hours)
  WHERE escalate_after_hours IS NOT NULL AND due_at IS NOT NULL;
