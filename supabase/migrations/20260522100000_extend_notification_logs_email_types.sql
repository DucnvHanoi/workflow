-- Extend notification_logs.email_type CHECK to include invite and upcoming SLA types.
-- Uses DROP + re-ADD pattern (Postgres requirement for CHECK changes).

ALTER TABLE notification_logs DROP CONSTRAINT IF EXISTS notification_logs_email_type_check;

ALTER TABLE notification_logs ADD CONSTRAINT notification_logs_email_type_check
  CHECK (email_type IN (
    'step_assigned',
    'flow_completed',
    'invite',
    'sla_reminder',
    'sla_overdue',
    'sla_escalation'
  ));
