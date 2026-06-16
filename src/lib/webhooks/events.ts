export type OutboundWebhookEventType =
  | 'flow_triggered'
  | 'step_completed'
  | 'flow_completed'
  | 'flow_cancelled'
  | 'step_overdue'

export const WEBHOOK_EVENT_LABELS: Record<OutboundWebhookEventType, string> = {
  flow_triggered: 'Flow triggered',
  step_completed: 'Step completed',
  flow_completed: 'Flow completed',
  flow_cancelled: 'Flow cancelled',
  step_overdue: 'Step overdue',
}
