-- ============================================================
-- Migration: support_system
-- AI-powered customer support: tickets, messages, knowledge base.
-- All writes go through the admin client (service role).
-- Middleware at /platform enforces the platform-owner email guard.
-- ============================================================

-- -------------------------------------------------------
-- support_tickets
-- -------------------------------------------------------
CREATE TABLE support_tickets (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  subject          text        NOT NULL,
  sender_email     text        NOT NULL,
  sender_name      text,
  status           text        NOT NULL DEFAULT 'open'
                               CHECK (status IN ('open', 'pending_human', 'ai_replied', 'closed')),
  priority         text        NOT NULL DEFAULT 'normal'
                               CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  category         text,                          -- ai-inferred: billing | how-to | account | technical | general
  ai_confidence    text        CHECK (ai_confidence IN ('high', 'low')),
  assigned_to      uuid        REFERENCES users(id) ON DELETE SET NULL,
  last_message_at  timestamptz NOT NULL DEFAULT now(),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX support_tickets_status_idx       ON support_tickets (status);
CREATE INDEX support_tickets_sender_email_idx ON support_tickets (sender_email);
CREATE INDEX support_tickets_last_message_idx ON support_tickets (last_message_at DESC);

ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
-- No public policies — all access via service-role admin client

-- keep updated_at current
CREATE OR REPLACE FUNCTION support_tickets_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER support_tickets_updated_at
  BEFORE UPDATE ON support_tickets
  FOR EACH ROW EXECUTE FUNCTION support_tickets_set_updated_at();

-- -------------------------------------------------------
-- support_messages  (one row per email turn)
-- -------------------------------------------------------
CREATE TABLE support_messages (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id        uuid        NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  direction        text        NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  from_email       text        NOT NULL,
  from_name        text,
  body_text        text,
  body_html        text,
  is_ai_generated  boolean     NOT NULL DEFAULT false,
  -- email threading headers
  email_message_id text,       -- Message-ID header of this email
  in_reply_to      text,       -- In-Reply-To header (inbound only)
  resend_id        text,       -- Resend delivery ID (outbound only)
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX support_messages_ticket_id_idx    ON support_messages (ticket_id, created_at);
CREATE INDEX support_messages_message_id_idx   ON support_messages (email_message_id);

ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY;

-- -------------------------------------------------------
-- knowledge_base  (markdown articles the AI reads)
-- -------------------------------------------------------
CREATE TABLE knowledge_base (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title            text        NOT NULL,
  slug             text        NOT NULL UNIQUE,
  content_markdown text        NOT NULL DEFAULT '',
  category         text        NOT NULL DEFAULT 'general'
                               CHECK (category IN ('general', 'billing', 'how-to', 'account', 'technical')),
  is_active        boolean     NOT NULL DEFAULT true,
  -- full-text search vector (auto-updated by trigger)
  search_vector    tsvector,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX knowledge_base_category_idx ON knowledge_base (category) WHERE is_active = true;
CREATE INDEX knowledge_base_search_idx   ON knowledge_base USING GIN (search_vector);

ALTER TABLE knowledge_base ENABLE ROW LEVEL SECURITY;

-- auto-update search_vector on insert/update
CREATE OR REPLACE FUNCTION knowledge_base_update_search_vector()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.content_markdown, '')), 'B');
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER knowledge_base_search_vector_update
  BEFORE INSERT OR UPDATE ON knowledge_base
  FOR EACH ROW EXECUTE FUNCTION knowledge_base_update_search_vector();

-- -------------------------------------------------------
-- Seed: starter knowledge base articles
-- -------------------------------------------------------
INSERT INTO knowledge_base (title, slug, category, content_markdown) VALUES
(
  'What is BizFlow?',
  'what-is-bizflow',
  'general',
  '# What is BizFlow?

BizFlow is a workflow automation SaaS platform that helps organizations digitize and automate their internal approval and business processes.

Key features:
- **Visual workflow builder** — drag-and-drop canvas to design multi-step approval flows
- **Role-based assignments** — steps can be assigned to specific users, departments, or roles
- **SLA management** — set deadlines and auto-escalation rules on each step
- **Email notifications** — automated notifications at each workflow transition
- **Audit logs** — full history of every action taken on a flow instance
- **Multi-tenant** — each organization operates in an isolated environment'
),
(
  'Pricing and Plans',
  'pricing-and-plans',
  'billing',
  '# Pricing and Plans

BizFlow offers three plans:

## Starter
- Up to 5 active users
- Up to 10 workflow templates
- Basic email notifications
- Community support

## Professional
- Up to 50 active users
- Unlimited workflow templates
- SLA management & escalation
- Priority email support

## Enterprise
- Unlimited users
- Custom integrations
- Dedicated account manager
- SLA guarantee

To upgrade your plan, contact us at contact@bizflow.id.vn or visit the billing section of your admin dashboard.'
),
(
  'How to invite users',
  'how-to-invite-users',
  'account',
  '# How to Invite Users

To invite a new user to your BizFlow workspace:

1. Go to **Admin Dashboard → Users**
2. Click **Invite User**
3. Enter the user''s email address and select their role (Member or Admin)
4. Click **Send Invitation**

The user will receive an email with a magic link to set up their account. Invitations expire after 7 days. You can resend an expired invitation from the Users page.'
),
(
  'How to create a workflow',
  'how-to-create-workflow',
  'how-to',
  '# How to Create a Workflow

1. Navigate to **Flows** in the sidebar
2. Click **New Flow**
3. Give your flow a name and optional description
4. Use the canvas to add steps:
   - Click the **+** button to add a new step
   - Configure the step: name, assignee (user/department/role), SLA hours
   - Connect steps by dragging from one node''s handle to the next
5. Click **Save** to save your draft
6. Click **Publish** to make the flow available for new instances

To trigger a flow instance, go to the flow detail page and click **Start New Instance**.'
),
(
  'Resetting your password',
  'reset-password',
  'account',
  '# Resetting Your Password

If you have forgotten your password:

1. Go to the BizFlow login page
2. Click **Forgot password?**
3. Enter your email address
4. Check your inbox for a password reset link
5. Click the link and set a new password

The reset link expires after 1 hour. If you do not receive the email within a few minutes, check your spam folder.'
);
