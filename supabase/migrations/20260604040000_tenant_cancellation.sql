-- Tenant-level account cancellation support.
-- Adds cancel_at column + extends three CHECK constraints.

-- 1. cancel_at timestamp on tenants
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS cancel_at timestamptz;

-- 2. Extend tenants.status CHECK to include 'cancelling'
--    Uses a DO block to find and drop the existing constraint by scanning pg_constraint
--    (the auto-generated name from ADD COLUMN ... CHECK is not guaranteed).
DO $$
DECLARE v_name text;
BEGIN
  SELECT conname INTO v_name
  FROM pg_constraint
  WHERE conrelid = 'public.tenants'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%status%';
  IF v_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.tenants DROP CONSTRAINT %I', v_name);
  END IF;
END $$;

ALTER TABLE public.tenants ADD CONSTRAINT tenants_status_check
  CHECK (status IN ('active', 'trial', 'suspended', 'cancelling'));

-- 3. Extend audit_log.action CHECK
ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_action_check;
ALTER TABLE audit_log ADD CONSTRAINT audit_log_action_check
  CHECK (action IN (
    'role_changed',
    'flow_published',
    'flow_unpublished',
    'step_reassigned',
    'step_escalated',
    'user_deactivated',
    'user_reactivated',
    'tasks_bulk_reassigned',
    'account_cancellation_initiated',
    'account_cancellation_reversed'
  ));

-- 4. Extend notification_logs.email_type CHECK
ALTER TABLE notification_logs DROP CONSTRAINT IF EXISTS notification_logs_email_type_check;
ALTER TABLE notification_logs ADD CONSTRAINT notification_logs_email_type_check
  CHECK (email_type IN (
    'step_assigned',
    'flow_completed',
    'invite',
    'sla_reminder',
    'sla_overdue',
    'sla_escalation',
    'drip_day1_confirm_email',
    'drip_day2_team_waiting',
    'drip_day5_go_live',
    'drip_week2_tips',
    'account_cancellation_confirmed',
    'account_cancellation_reversed'
  ));
