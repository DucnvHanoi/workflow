-- Knowledge Base: comprehensive seed for BizFlow user-facing articles
-- Covers: general, billing, account, how-to, technical categories
-- Safe for public: no internal architecture, secrets, or structural data

-- ──────────────────────────────────────────────────────────────────────────────
-- Update existing 5 articles with richer content
-- ──────────────────────────────────────────────────────────────────────────────

UPDATE knowledge_base SET
  content_markdown = E'# What is BizFlow?\n\nBizFlow is a workflow automation platform that helps organisations digitise and automate their business processes — without writing any code.\n\n## What you can do\n\n- **Build workflows visually** — drag and drop steps onto a canvas to design approval flows, request forms, and multi-step processes\n- **Assign steps to people or teams** — route tasks to individuals, departments, managers, or skip-level approvers automatically\n- **Set deadlines (SLA)** — put a time limit on any step so nothing gets forgotten\n- **Use AI assistance** — let AI help you build a workflow from a plain-English description, suggest form fields, or find the right flow to start\n- **Track everything** — real-time notifications, an admin dashboard with bottleneck analysis, and detailed reports\n\n## Who uses BizFlow\n\n| Role | What they do |\n|------|--------------|\n| **Admin** | Creates and publishes workflows, manages team members and departments, views reports |\n| **Member** | Completes assigned tasks, triggers flows they need to start |\n\n## Getting started\n\n1. Sign up at bizflow.id.vn and create your organisation\n2. Invite your team members\n3. Build your first workflow — or start from a template\n4. Publish the workflow so your team can trigger it',
  updated_at = NOW()
WHERE slug = 'what-is-bizflow';

UPDATE knowledge_base SET
  content_markdown = E'# Pricing and Plans\n\nBizFlow offers three plans to fit organisations of every size.\n\n## Free — $0 / month\n\nPerfect for small teams getting started.\n\n- Up to **10 users** (including the admin)\n- Up to **2 active workflows**\n- Up to **5 departments**\n- Reports: last **7 days** only\n- AI features: not available\n\n## Pro — $5 / user / month\n\nFor growing teams that need unlimited workflows and AI-powered tools.\n\n- Up to **100 users**\n- **Unlimited** workflows and departments\n- Full report history (7 days / 30 days / 90 days / all-time)\n- **AI flow builder**, smart form suggestions, natural-language branch conditions, and AI text assistance\n\n## Enterprise — Contact us\n\nFor large organisations with custom requirements.\n\n- Unlimited users, workflows, and departments\n- Full analytics and reporting\n- AI features with a custom credit limit configured per organisation\n- Dedicated support and custom SLA\n- Contact us at contact@bizflow.id.vn for pricing\n\n## Frequently asked billing questions\n\n**How is the Pro plan billed?** Per active user, per month. You are charged for the number of users in your organisation at billing time.\n\n**Can I change plans?** Yes. Admins can upgrade or review their plan in **Settings → Billing**.\n\n**What happens if I exceed a limit?** You will see an inline message when you reach a plan limit (for example, trying to add an 11th user on the Free plan). The action is blocked until you upgrade.\n\n**Is there a free trial?** The Free plan is free indefinitely. Upgrade to Pro when you need more users or AI features.',
  updated_at = NOW()
WHERE slug = 'pricing-and-plans';

UPDATE knowledge_base SET
  content_markdown = E'# How to Invite Users\n\nAdmins can invite new team members to their BizFlow workspace by sending a magic-link email.\n\n## Step-by-step\n\n1. Go to **Admin Dashboard → Users** in the left sidebar\n2. Click **Invite User** in the top-right corner\n3. Enter the person''s **email address** and select their **role** (Admin or Member)\n4. Click **Send Invitation**\n\nThe invitee will receive an email with a **one-click link** to set up their account. The link is valid for **24 hours**.\n\n## Checking pending invitations\n\nYou can track who has and has not accepted their invitation:\n\n1. Go to **Users → Pending Invites** in the sidebar\n2. The list shows each invite''s status (Pending / Accepted), who sent it, and when it was last sent\n3. Click **Resend** to send a fresh link if the original has expired\n4. Click **Revoke** to cancel an invitation and remove the account\n\n## Bulk inviting via CSV\n\nTo invite many users at once:\n\n1. Go to **Users → Bulk Import**\n2. Download the CSV template\n3. Fill in email, full name, role, and whether to send an invite email\n4. Upload the file and review the preview\n5. Click **Import** — results show per-row success or error\n\n## Plan limits\n\nThe number of users you can have is determined by your plan (10 on Free, 100 on Pro). You will see an error if you try to invite beyond your limit.',
  updated_at = NOW()
WHERE slug = 'how-to-invite-users';

UPDATE knowledge_base SET
  content_markdown = E'# How to Create a Workflow\n\n## What is a workflow?\n\nA workflow is a sequence of steps that moves a piece of work from start to finish — for example, a leave request that goes to a manager for approval, then to HR to log.\n\n## Creating a workflow (Admin only)\n\n1. Go to **Flows** in the left sidebar\n2. Click **New Flow** (or open a Template from the **Templates** button)\n3. Give your flow a name and optional category\n\n## Building the canvas\n\nYou will see a canvas with a **Trigger** node and a **Complete** node already placed.\n\n- **Add a step**: click the + button on any node, or drag from the node toolbar\n- **Action node**: a step where someone fills in a form\n- **Branch node**: a yes/no decision that routes the flow based on a field value\n\n## Configuring a step\n\n1. Click a step node to open the config panel on the right\n2. Set a **step name** (e.g. "Manager Approval")\n3. Add **form fields** — short text, long text, dropdown, checkbox, file upload, and more\n4. Set the **assignee rule** — who receives this step:\n   - Requester (the person who triggered the flow)\n   - Manager of requester\n   - A specific email address\n   - Head of a department\n   - Skip-level manager\n5. Optionally set a **deadline** (e.g. "Due within 2 days")\n\n## Using AI to build a workflow\n\nClick the **AI (Sparkles)** button in the toolbar and describe what you need in plain English. BizFlow will generate a complete workflow for you to review and adjust.\n\n## Publishing\n\nWhen your workflow is ready:\n\n1. Open the **Publish** panel (right sidebar)\n2. Click **Publish** — the workflow becomes available for your team to trigger\n\nPublished workflows are versioned. You can keep editing a draft without affecting live instances.',
  updated_at = NOW()
WHERE slug = 'how-to-create-workflow';

UPDATE knowledge_base SET
  content_markdown = E'# Resetting Your Password\n\nIf you have forgotten your password or want to change it, follow these steps.\n\n## If you are logged out\n\n1. Go to the BizFlow login page\n2. Click **Forgot password?** below the sign-in form\n3. Enter your email address and click **Send reset link**\n4. Check your inbox for an email from BizFlow\n5. Click the link in the email — it will open a page where you can set a new password\n6. Enter and confirm your new password, then click **Save**\n\nThe reset link expires after **1 hour**. If it has expired, repeat the steps above to get a new one.\n\n## If you are already logged in\n\nYou can change your password from your profile page:\n\n1. Click your **avatar** in the top-right corner\n2. Select **Profile**\n3. Use the password section to set a new password\n\n## Trouble receiving the email?\n\n- Check your spam / junk folder\n- Make sure you are checking the inbox for the email address registered with BizFlow\n- Wait 2–3 minutes — email delivery can occasionally be delayed\n- If you still do not receive it, contact support at contact@bizflow.id.vn',
  updated_at = NOW()
WHERE slug = 'reset-password';

-- ──────────────────────────────────────────────────────────────────────────────
-- New articles
-- ──────────────────────────────────────────────────────────────────────────────

INSERT INTO knowledge_base (title, slug, content_markdown, category, is_active) VALUES

-- ACCOUNT ─────────────────────────────────────────────────────────────────────

(
  'How to Sign Up',
  'how-to-sign-up',
  E'# How to Sign Up\n\nCreating a BizFlow account takes less than a minute.\n\n## Steps\n\n1. Go to **bizflow.id.vn** and click **Get Started** (or **Sign Up**)\n2. Enter your **email address** and a **password** (minimum 8 characters)\n3. Click **Create account**\n4. You will be signed in and taken to your workspace — your organisation is created automatically with the name "My Organisation"\n\n## After signing up\n\n- You are the **Admin** of your new workspace\n- Rename your organisation in **Settings → General**\n- Invite team members from **Users → Invite User**\n- Build your first workflow from **Flows → New Flow**\n\n## Already have an account?\n\nIf you were invited by a colleague, do not sign up — use the **Accept invitation** link in your invitation email instead. Creating a new account will create a separate workspace, not join your colleague''s.',
  'account',
  true
),

(
  'How to Accept an Invitation',
  'how-to-accept-invitation',
  E'# How to Accept an Invitation\n\nWhen an admin invites you to their BizFlow workspace, you will receive an invitation email.\n\n## Steps\n\n1. Open the invitation email from BizFlow\n2. Click **Accept invitation** (or "Set up your account")\n3. You will be taken to an account setup page — enter your **full name** and set a **password**\n4. Click **Save** — you will be signed in and taken to your tasks page\n\n## Link expired?\n\nInvitation links are valid for **24 hours**. If your link has expired:\n\n1. Contact your admin and ask them to **resend the invitation**\n2. They can do this from **Users → Pending Invites → Resend**\n3. You will receive a fresh invitation email\n\n## Notes\n\n- Do not create a new account at the sign-up page — that would create a separate, empty workspace\n- If you already have a BizFlow account from a different organisation, invitation links create a separate session for the new workspace',
  'account',
  true
),

(
  'How to Update Your Profile',
  'how-to-update-profile',
  E'# How to Update Your Profile\n\nYou can update your name, job title, phone number, and profile photo at any time.\n\n## Steps\n\n1. Click your **avatar** in the top-right corner of any page\n2. Select **Profile** from the dropdown menu\n3. On the Profile page:\n   - Edit your **Full name**, **Job title**, or **Phone number**\n   - Click **Save changes** when done\n4. To change your **profile photo**:\n   - Click the photo or the upload button below it\n   - Choose an image file from your computer\n   - The photo is saved automatically\n\n## Note on email\n\nYour email address is read-only in the profile form. To change your login email, contact your organisation admin or reach out to BizFlow support at contact@bizflow.id.vn.',
  'account',
  true
),

(
  'How to Enable Two-Factor Authentication',
  'how-to-enable-mfa',
  E'# How to Enable Two-Factor Authentication (MFA)\n\nTwo-factor authentication adds an extra layer of security to your account. After entering your password, you will also be asked for a one-time code from an authenticator app.\n\n## What you need\n\nAn authenticator app on your phone, such as:\n- Google Authenticator\n- Authy\n- Microsoft Authenticator\n- 1Password\n\n## Enabling MFA\n\n1. Click your **avatar** in the top-right corner and select **Profile**\n2. Scroll down to the **Security** section\n3. Click **Set up two-factor authentication**\n4. Open your authenticator app and scan the QR code shown, or enter the secret key manually\n5. Enter the 6-digit code shown in your authenticator app to verify\n6. Click **Verify** — MFA is now active\n\n## Signing in with MFA\n\nAfter entering your password, you will be redirected to a verification page. Open your authenticator app, enter the current 6-digit code, and click **Verify**.\n\n## Disabling MFA\n\n1. Go to **Profile → Security**\n2. Click **Disable two-factor authentication**\n3. Confirm when prompted\n\n## Lost access to your authenticator app?\n\nContact your organisation admin or BizFlow support at contact@bizflow.id.vn.',
  'account',
  true
),

-- HOW-TO ──────────────────────────────────────────────────────────────────────

(
  'How to Start a Workflow',
  'how-to-start-workflow',
  E'# How to Start (Trigger) a Workflow\n\nAny team member can start a published workflow that their admin has made available to them.\n\n## Steps\n\n1. Go to **Flows** in the left sidebar\n2. You will see a list of workflows available to you\n3. Click **Trigger** (or the play button) next to the workflow you want to start\n4. The workflow will start immediately and the first task will be assigned (usually to you)\n\n## Using AI to find the right workflow\n\nIf you are not sure which workflow to use:\n\n1. On the Flows page, look for the **"Start a flow with AI"** panel at the top\n2. Describe what you need in plain English — for example: _"I need to submit a leave request for next week"_\n3. BizFlow AI will match your request to the best available workflow and show you a confidence rating and reason\n4. Review the match and click **Start this flow** if it looks right\n\n## Notes\n\n- You will only see workflows that are published and that your admin has made available to your department\n- After triggering a flow, find your pending tasks in **Tasks → Pending**',
  'how-to',
  true
),

(
  'How to Complete a Task',
  'how-to-complete-task',
  E'# How to Complete a Task\n\nWhen a workflow step is assigned to you, you will receive an email notification and an in-app notification.\n\n## Finding your tasks\n\n1. Go to **Tasks** in the left sidebar (this is the home page after login)\n2. The **Pending** tab shows all steps waiting for your action\n3. Each task card shows the workflow name, step name, who triggered it, and any deadline\n\n## Completing a task\n\n1. Click a task card to open it\n2. Fill in the form fields (text answers, dropdowns, file uploads, etc.)\n3. You can **Save draft** to come back later without submitting\n4. When you are ready, click **Submit** to complete the step and move the workflow to the next step\n\n## Viewing previous steps\n\nIn the task detail view, you can see responses from earlier steps in the same workflow — useful for context before you fill in your own response.\n\n## Deadlines\n\nIf a step has a deadline, you will see a due date on the task card:\n- **Amber** — due within 24 hours\n- **Red** — overdue\n\nIf you miss a deadline, your manager may receive an escalation alert depending on the workflow configuration.',
  'how-to',
  true
),

(
  'How to View Your Flow History',
  'how-to-view-flow-history',
  E'# How to View Your Flow History\n\n## Flows you triggered\n\n1. Go to **Tasks** in the left sidebar\n2. Click the **My Flows** tab\n3. You will see all workflows you have triggered, with their current status (Pending, Completed, Cancelled, or Error)\n4. Click any row to open the full thread — see every step, who completed it, and what they submitted\n\n## Completed tasks you worked on\n\n1. Go to **Tasks → History**\n2. This shows every step you have completed, grouped by workflow instance\n3. Click a row to expand the details\n\n## For admins: all instances across the team\n\nAdmins can see every workflow instance across the organisation:\n\n1. Go to **Admin → Instances** in the left sidebar\n2. Use the filters (flow, status, triggered by, date range, search) to narrow results\n3. Click any row to open the detail panel\n4. Use **Export** to download a CSV of the filtered results',
  'how-to',
  true
),

(
  'How to Use the AI Flow Builder',
  'how-to-use-ai-flow-builder',
  E'# How to Use the AI Flow Builder\n\nThe AI Flow Builder lets you describe a workflow in plain English and have BizFlow generate the step-by-step canvas for you. Available on the Pro plan.\n\n## Generating a new workflow\n\n1. Open or create a flow — go to **Flows → New Flow**\n2. On the canvas, click the **AI (Sparkles)** button in the toolbar\n3. Select **Generate new workflow**\n4. Type a description of your workflow — for example:\n   _"A leave request flow where the employee submits dates and reason, the manager approves, and HR logs it"_\n5. Click **Generate** — BizFlow will create a full canvas with steps, form fields, and assignee rules\n6. Review and adjust the result, then publish when ready\n\n## Modifying an existing workflow\n\n1. On a canvas that already has nodes, click the **AI (Sparkles)** button\n2. Select **Modify existing**\n3. Describe the change — for example: _"Add a Finance approval step after the manager step"_\n4. Click **Generate** — your existing canvas will be updated\n\n## Tips for better results\n\n- Mention roles explicitly: "assigned to the requester''s manager" produces better assignee rules than just "a manager"\n- Describe what form fields are needed: "fields for start date, end date, and reason"\n- Keep your description to 1–3 sentences for the most focused result\n\n## Enabling AI\n\nAI features must be enabled by your organisation admin. Go to **Settings → AI** to turn them on and optionally connect your own API key.',
  'how-to',
  true
),

(
  'How to Manage Departments',
  'how-to-manage-departments',
  E'# How to Manage Departments\n\nDepartments organise your team for step routing, reporting, and access control. Available to admins.\n\n## Creating a department\n\n1. Go to **Departments → Management** in the left sidebar\n2. Click **New Department**\n3. Enter a department name\n4. Optionally choose a **parent department** (up to 3 levels deep) and a **department head**\n\n## Managing members\n\n1. Open the department row and click **Members** in the Actions dropdown\n2. Add users by selecting them from the dropdown — they are moved from their current department\n3. Remove a user by clicking the ✕ next to their name\n\n## Setting a department head\n\nThe department head is used as an assignee option in workflow steps ("Route to department head"). To set one:\n\n1. Edit the department\n2. Select a user in the **Department Head** field\n\n## Department workload\n\nGo to **Departments → Workload** to see pending tasks, overdue steps, and upcoming deadlines broken down per department — useful for spotting bottlenecks.\n\n## Merging departments\n\nIf you need to merge two departments:\n\n1. Open the source department → Actions → **Merge into…**\n2. Select the target department\n3. Optionally delete the source after merging\n\nAll users will be moved to the target department.',
  'how-to',
  true
),

(
  'How to Set Deadlines on Workflow Steps',
  'how-to-set-sla-deadlines',
  E'# How to Set Deadlines (SLA) on Workflow Steps\n\nYou can put a time limit on any step in a workflow to ensure tasks do not stall.\n\n## Setting a deadline\n\n1. Open a workflow in edit mode\n2. Click on an **Action** or **Branch** step node\n3. In the config panel on the right, look for **"Due within"**\n4. Enter a number and choose **hours** or **days** (e.g. "2 days")\n5. Optionally set **"Escalate after N hours overdue"** to notify the assignee''s manager if the step is not completed in time\n\n## How deadlines are shown\n\nOnce a step is assigned, the due date appears on the task card:\n\n- **Muted** — plenty of time remaining\n- **Amber** — due within 24 hours\n- **Red** — overdue\n\nDeadlines are also shown in the admin dashboard and department workload view.\n\n## Escalation\n\nIf you configured an escalation threshold, BizFlow will send an email to the assignee''s manager once that many hours have passed without the step being completed. The escalation is logged in the audit trail.\n\n## Notes\n\n- Deadlines are in **calendar hours**, not business hours\n- If no due-within is set on a step, no deadline badge appears\n- Deadlines are computed from the moment a step is assigned, not from when the flow was triggered',
  'how-to',
  true
),

(
  'How to View Analytics and Reports',
  'how-to-view-reports',
  E'# How to View Analytics and Reports\n\nBizFlow provides several reporting views for admins to track workflow performance.\n\n## Dashboard\n\nGo to **Dashboard** in the left sidebar for a live overview:\n\n- **Stat cards**: total flows, active instances, completed this month, cancelled, SLA breached, and due soon\n- **Per-flow breakdown**: total runs, pending, completed, cancelled, and error counts per workflow\n- **Bottleneck table**: who has the most pending tasks and how long the oldest one has been waiting\n\n## Flow Performance Report\n\nGo to **Admin → Reports → Flows** for a deeper view:\n\n- Average cycle time per flow\n- Completion, cancellation, and error rates\n- Step-level breakdown sorted by median wait time\n- Period selector: 7 days, 30 days, 90 days, or all-time\n\n## SLA Adherence Report\n\nGo to **Admin → Reports → SLA** for deadline tracking:\n\n- On-time vs breached counts per flow\n- Breach rate with colour coding (red over 20%, amber over 10%)\n- Per-step breakdown and escalation effectiveness\n- CSV export\n\n## Plan limits\n\nReport history periods beyond 7 days require the **Pro** plan. Free plan users see the 7-day period only; longer periods are locked with an upgrade prompt.',
  'how-to',
  true
),

(
  'How to Use the Org Chart',
  'how-to-use-org-chart',
  E'# How to Use the Org Chart\n\nThe org chart gives you a visual overview of your team''s reporting structure.\n\n## Viewing the org chart\n\n1. Go to **Org Chart** in the left sidebar\n2. You will see all active team members arranged by their manager and department head relationships\n3. Badges show: department name, Head (amber badge for department heads), and role\n\n## Updating reporting lines (Admin only)\n\n1. On the org chart, drag the connection handle from one person''s node to another''s node\n2. This updates who the person reports to (their manager)\n3. A cycle check prevents circular reporting chains\n\nAlternatively, edit a user''s manager from **Users → (click a user) → edit their profile**.\n\n## User Directory\n\nFor a searchable card grid of all team members, go to **Directory** in the sidebar:\n\n- Search by name, email, or department\n- Filter by department (includes sub-departments automatically)',
  'how-to',
  true
),

(
  'How to Deactivate and Reactivate a User',
  'how-to-deactivate-user',
  E'# How to Deactivate and Reactivate a User\n\nWhen a team member leaves, you should deactivate their account rather than deleting it. Deactivated users cannot log in and are excluded from task assignment, but their completed work history is preserved.\n\n## Deactivating a user\n\n1. Go to **Users** in the left sidebar\n2. Find the user you want to deactivate\n3. Click the **Actions** menu (three dots) on their row\n4. Click **Deactivate User** and confirm\n\nAlternatively, go to the user''s profile page and use the **Deactivate** button there.\n\n## What happens on deactivation\n\n- The user is immediately signed out and cannot log in again\n- They are removed from all assignee dropdowns and routing rules\n- Any pending tasks assigned to them remain — you should reassign them\n\n## Reassigning pending tasks\n\n1. Go to the user''s profile page\n2. Click **Reassign N pending tasks**\n3. Select the user to reassign all tasks to\n4. Confirm\n\n## Reactivating a user\n\n1. Go to **Users** — deactivated users show as "Inactive" with a grey badge\n2. Click **Actions → Reactivate User**\n3. The user can log in again immediately',
  'how-to',
  true
),

(
  'How to Use Flow Templates',
  'how-to-use-flow-templates',
  E'# How to Use Flow Templates\n\nBizFlow provides a library of ready-made workflow templates you can clone into your workspace and customise.\n\n## Browsing and using a template\n\n1. Go to **Flows** in the left sidebar\n2. Click the **Templates** button (Admin only)\n3. Browse the gallery — templates are organised by category (HR, Finance, IT, Operations, Other)\n4. Click **Use template** on any template you want\n5. BizFlow creates a copy of the template as a draft workflow in your workspace\n6. You are taken to the canvas — customise the steps, form fields, and assignee rules to fit your team\n7. Publish when ready\n\n## What gets copied\n\n- All steps, connections, form fields, and branch conditions from the template\n- Generic assignee rules (requester, manager, skip-level) are kept\n- Tenant-specific assignee rules (fixed email, department head, role in dept) are removed so you can set your own\n\n## Notes\n\n- Template cloning counts towards your flow limit (2 on the Free plan)\n- Templates are maintained by the BizFlow platform team — you can suggest new templates via contact@bizflow.id.vn',
  'how-to',
  true
),

(
  'How to Bulk Import Users via CSV',
  'how-to-bulk-import-users',
  E'# How to Bulk Import Users via CSV\n\nInstead of inviting users one by one, you can import multiple users at once using a CSV file.\n\n## Steps\n\n1. Go to **Users → Bulk Import** in the left sidebar\n2. Click **Download template** to get the correct CSV format\n3. Fill in the CSV with the following columns:\n   - **email** — the user''s email address\n   - **full_name** — their display name\n   - **role** — either `admin` or `user`\n   - **password** — a starting password (used if you set invite to `no`)\n   - **invite** — `yes` to send a magic-link invitation email, `no` to create the account immediately with the provided password\n4. Upload the filled CSV file\n5. Review the **preview** — rows with issues (missing password for non-invite users) are flagged in red\n6. Click **Import** when the preview looks correct\n7. The results page shows each row as success or error\n\n## Notes\n\n- Bulk import counts towards your user plan limit\n- Users invited with `invite=yes` appear in **Users → Pending Invites** until they accept\n- Users created with `invite=no` can log in immediately using the password you set — remind them to change it on first login',
  'how-to',
  true
),

-- BILLING ─────────────────────────────────────────────────────────────────────

(
  'How to Check Your Plan and Usage',
  'how-to-check-plan-usage',
  E'# How to Check Your Plan and Usage\n\nAdmins can view their current plan, usage meters, and billing information in the Settings area.\n\n## Steps\n\n1. Go to **Settings** in the left sidebar (admin only)\n2. Click the **Billing** tab\n\n## What you will see\n\n- **Current plan** badge (Free, Pro, or Enterprise)\n- **Usage meters** for:\n  - Users (e.g. 7 / 10 for the Free plan)\n  - Flows (e.g. 1 / 2 for the Free plan)\n  - Departments (e.g. 3 / 5 for the Free plan)\n  - Report history (7 days on Free, unlimited on Pro)\n- **Upgrade button** — appears for Free plan users\n\n## What counts towards limits\n\n- **Users**: all active (non-deactivated) users in your workspace\n- **Flows**: all flows that exist (draft or published)\n- **Departments**: all departments, including sub-departments\n\n## Approaching a limit\n\nWhen you try to add more users, flows, or departments than your plan allows, you will see an inline error message. Upgrade to Pro to remove the limits.',
  'billing',
  true
),

(
  'AI Features and Credit Usage',
  'ai-features-and-credit-usage',
  E'# AI Features and Credit Usage\n\nBizFlow''s AI features use large language models (LLM) to help you build and run workflows more efficiently. AI is available on the **Pro** and **Enterprise** plans.\n\n## Available AI features\n\n| Feature | Who uses it | What it does |\n|---------|-------------|---------------|\n| **AI Flow Builder** | Admins (canvas) | Generates or modifies a workflow from a plain-English description |\n| **Smart Form Field Suggestions** | Admins (canvas) | Suggests relevant form fields for a step based on the step name |\n| **Natural-Language Branch Conditions** | Admins (canvas) | Converts plain-English rules into branch conditions |\n| **Flow Trigger Assistant** | Members (Flows page) | Matches a plain-English request to the best available workflow |\n| **AI Text Assistance** | Members (task forms) | Drafts or rewrites long text field content |\n\n## Enabling AI\n\n1. Go to **Settings → AI** (admin only)\n2. Toggle **Enable AI features** on\n3. Choose a **provider** (Anthropic / Claude, or OpenAI / GPT)\n4. Choose **Platform key** (use BizFlow''s shared API key, billed against your credit) or **Your own key** (connect your own API key, billed directly by the provider)\n\n## Credit usage\n\nWhen using the platform key, each AI call consumes a small amount of credit. Your current usage and limit are shown in **Settings → AI** as a progress bar. Contact support if you need your limit increased.\n\n## Model selection\n\nUnder Settings → AI, admins can pick which model to use. Faster, smaller models cost less; larger models produce higher-quality results.',
  'billing',
  true
),

-- TECHNICAL ───────────────────────────────────────────────────────────────────

(
  'Understanding Notifications',
  'understanding-notifications',
  E'# Understanding Notifications\n\nBizFlow sends notifications to keep you informed about tasks and workflow activity.\n\n## In-app notifications\n\nThe **bell icon** in the top bar shows your unread notification count.\n\n- Click the bell to see your most recent 20 notifications\n- Click a notification to mark it as read and navigate to the relevant page\n- Click **Mark all read** to clear the badge\n- Click **View all notifications** to go to the full notifications page\n\n## Types of notifications\n\n| Type | When it appears |\n|------|-----------------|\n| 📋 **Step assigned** | A workflow step has been assigned to you |\n| ✅ **Flow completed** | A workflow you triggered has been completed |\n| ⏰ **SLA reminder** | A step you are responsible for is due soon or overdue |\n| ⚠️ **Step escalated** | A step under your management has been escalated |\n\n## Email notifications\n\nIn addition to in-app notifications, BizFlow also sends email alerts:\n\n- **Step assigned**: you receive an email when a new task is assigned to you\n- **Flow completed**: you receive an email when a flow you triggered is finished\n- **SLA digest**: a daily email listing your overdue and due-soon tasks\n- **Escalation**: your manager receives an email if one of your assigned steps is significantly overdue\n\n## Managing notifications\n\nNotifications are automatic and cannot currently be individually turned off. If you are receiving too many emails, check with your admin about SLA configuration on the workflows.',
  'technical',
  true
),

(
  'How to Configure AI Settings',
  'how-to-configure-ai-settings',
  E'# How to Configure AI Settings\n\nOrganisation admins can enable, configure, and monitor AI usage from the Settings page.\n\n## Enabling AI\n\n1. Go to **Settings** in the left sidebar\n2. Click the **AI** tab\n3. Toggle **Enable AI features** to on\n\n## Choosing a provider and model\n\n- **Provider**: Choose between Anthropic (Claude models) and OpenAI (GPT models)\n- **Model**: After selecting a provider, pick the specific model. Smaller/faster models (Haiku, GPT-4o mini) cost less per call; larger models (Opus, GPT-4o) produce more detailed results\n\n## Platform key vs your own key\n\n- **Platform key**: BizFlow provides the API key. Your usage is tracked against a credit limit shown in the settings\n- **Your own key**: Paste your Anthropic or OpenAI API key. AI calls are billed directly by that provider — BizFlow does not add any markup. Your key is stored encrypted\n\n## Viewing usage\n\nThe **AI Usage Log** table in Settings → AI shows every AI call made by your team: date, user, feature used, model, token counts, and cost. Use this to understand which features are being used and control spend.\n\n## Disabling AI\n\nToggle **Enable AI features** off. All AI buttons and panels will be hidden from all users in your workspace immediately.',
  'how-to',
  true
),

(
  'File Uploads in Workflow Steps',
  'file-uploads-in-workflow-steps',
  E'# File Uploads in Workflow Steps\n\nWorkflow steps can include file upload fields so assignees can attach documents, images, or other files.\n\n## Uploading a file\n\n1. Open a task that contains a file upload field\n2. Click the upload area or the file picker button\n3. Select a file from your computer\n4. The file is uploaded immediately — you will see the filename and size once it is ready\n5. Submit the step when you are done\n\n## Viewing uploaded files\n\nUploaded files from completed steps are shown in the step history view. Click the file name to download it. Download links are temporary for security — they expire after 60 seconds, but you can click the link again to generate a new one.\n\n## Limits\n\n- Maximum file size: **10 MB per file**\n- File type: any\n- One file per file upload field; add multiple file upload fields if you need multiple attachments\n\n## Exporting attachments\n\nAdmins can export a list of all uploaded files with download links:\n\n1. Go to **Admin → Instances**\n2. Click **Export → Attachments CSV**\n3. The CSV includes file metadata and 7-day download URLs',
  'how-to',
  true
),

(
  'How to Rename Your Organisation',
  'how-to-rename-organisation',
  E'# How to Rename Your Organisation\n\nOrganisation admins can update the workspace name that appears across BizFlow.\n\n## Steps\n\n1. Go to **Settings** in the left sidebar (admin only)\n2. The **General** tab is the default\n3. Find the **Organisation name** field\n4. Edit the name and click **Save**\n\nThe new name will be reflected across your workspace immediately.',
  'general',
  true
),

(
  'What to Do If a Workflow Step Fails or Gets Stuck',
  'workflow-step-stuck-or-error',
  E'# What to Do If a Workflow Step is Stuck or Errors\n\n## Step is pending but not progressing\n\n**Check who is assigned**: the workflow may be waiting on a specific person.\n\n1. Go to **Admin → Instances** and find the workflow instance\n2. Open the detail panel — the current step shows the assignee\n3. If the assignee has left the organisation or been deactivated, their pending tasks will need to be reassigned\n4. Go to **Users → (the user''s profile) → Reassign pending tasks** to move all their tasks to another person\n\n**Check for a deadline**: if the step has a deadline and it has passed, the admin will have received an escalation email. The step still needs to be completed manually.\n\n## Workflow is in Error status\n\nAn error usually means a step could not be assigned. Common causes:\n\n- The assigned user has been deactivated\n- An assignee rule points to a role or department with no active members\n- A fixed-email assignee has been removed from the workspace\n\nTo investigate:\n\n1. Go to **Admin → Instances**\n2. Open the errored instance\n3. The event log at the bottom of the detail panel shows the error description\n\nFix the underlying issue (reassign, add a user to the department, update the workflow assignee rule), then re-trigger a fresh instance.\n\n## Contacting support\n\nIf you cannot resolve the issue, email us at contact@bizflow.id.vn with the workflow name and instance ID.',
  'technical',
  true
)

ON CONFLICT (slug) DO NOTHING;
