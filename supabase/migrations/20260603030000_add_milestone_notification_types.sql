-- Extend notifications.type CHECK to include milestone notification types
-- added for M3 onboarding milestones.

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'step_assigned',
    'flow_completed',
    'sla_reminder',
    'step_escalated',
    'comment_added',
    'first_user_joined',
    'flow_first_completed'
  ));
