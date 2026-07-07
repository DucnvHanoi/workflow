-- ============================================================
-- Migration: support_spam_status
-- Adds a 'spam' status so the AI support responder can silently
-- archive spam/irrelevant inbound emails instead of auto-replying.
-- ============================================================

ALTER TABLE support_tickets DROP CONSTRAINT support_tickets_status_check;

ALTER TABLE support_tickets
  ADD CONSTRAINT support_tickets_status_check
  CHECK (status IN ('open', 'pending_human', 'ai_replied', 'closed', 'spam'));
