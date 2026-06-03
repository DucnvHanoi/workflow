-- Extend notification_logs.email_type CHECK to include 4 onboarding drip types.
-- Uses DROP + re-ADD pattern (Postgres requirement for CHECK changes).

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
    'drip_week2_tips'
  ));
