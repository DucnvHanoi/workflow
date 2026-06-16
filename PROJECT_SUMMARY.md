WORKFLOW SAAS — COMPLETE PROJECT KNOWLEDGE SUMMARYSolo Developer Build Log & Architecture Baseline Last Updated: Phase 6 Day 1 Completed (M1: User deactivation + M2: Bulk task reassignment)1. PROJECT STACK & ENVIRONMENTCore TechnologiesFramework: Next.js 14.2.29 (App Router, TypeScript)UI Elements: shadcn/ui 2.3.0 + Tailwind CSS v3Database: Supabase (Postgres) — Region: Singapore (ap-southeast-1)Authentication: Supabase Auth (Email/Password + Google OAuth)Hosting: Vercel (connected to GitHub master branch with auto-deploys on push)Runtime Environment: Node.js v24.15.0Key Packages@supabase/ssr@0.6.1 & @supabase/supabase-js@2.49.4 (Supabase connectivity)@xyflow/react@12.3.6 (React Flow canvas rendering engine)zustand@4.5.7 (Lightweight client state for the React Flow canvas)@tanstack/react-table@8.21.3 (Dynamic tabular rendering)@dnd-kit/core@6.3.1, @dnd-kit/sortable@8.0.0, @dnd-kit/utilities@3.2.2 (Form field sorting)sonner@2.0.7 (Toasts) & lucide-react@1.11.0 (Icons)resend@4.0.0 (Email engine)Environment Variables (.env.local)NEXT*PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key # Keep secure, never expose to client
NEXT_PUBLIC_SITE_URL=your-site-url
RESEND_API_KEY=your-resend-key
RESEND_FROM_EMAIL=your-verified-sender-email 2. ARCHITECTURAL INVARIANTS & POLICIESSupabase Client Selection PatternRead-only & Server Components: Use createClient() from @/lib/supabase/server for page-level reads.All Server Actions executing Writes: Use createAdminClient() from @/lib/supabase/admin.ts. This utilizes the SUPABASE_SERVICE_ROLE_KEY to bypass Row Level Security (RLS) policies, preventing silent RLS failures from client component endpoints. Rule: You must manually authenticate the caller’s identity and rights before executing the query.Client Components: Use createBrowserClient() from @supabase/ssr exclusively (e.g., inside browser-based upload components).CRITICAL GOTCHA: Do not use raw createServerClient inside your Next.js pages directly, as the session cookie will not attach securely.Custom JWT Auth & RLS ClaimsYour multi-tenancy model relies on custom claims injected inside the Supabase JWT.Claim Retrieval: Always read roles and tenant identifiers via getSessionClaims() in @/lib/supabase/auth-helpers.ts. This reads directly from decoded access token app_metadata rather than requesting the slow getUser() database lookup.RLS Policies (SQL Level):Select/Update/Delete Tenant Isolation:USING ( tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid )
Insert Tenant Isolation:WITH CHECK ( tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid )
Admin-Only Access:USING ( (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' )
Forbidden Pattern: Never query auth.jwt() ->> 'tenant_id' directly.Server Actions Location RuleAll server actions called directly by Client Components must be stored in a static, non-dynamic route path (such as src/lib/flows/actions.ts).Storing server actions inside dynamic directories (e.g., src/app/(app)/flows/[id]/edit/actions.ts) leads to compile successes but silent failures or runtime routing mismatches.React Flow & Zustand Auto-Save PatternCanvas state lives inside the Zustand global store (canvas-store.ts).To prevent infinite loop flickering, define your React Flow nodeTypes constant outside the main FlowCanvas.tsx component.Auto-Save Trigger: React Flow triggers onNodesChange on dimension changes and clicks. To prevent excessive database operations, filter the events using SAVE_NODE_CHANGES:const SAVE_NODE_CHANGES = new Set(['add', 'remove', 'position', 'reset']);
Save operations are debounced (300ms) and execute as append-only snapshots inside flow_versions.Read-Only Canvas Rules: Set isReadOnly=true during active previewing of prior versions. This suppresses triggerSave() and locks down React Flow board interactivity.Canvas Connection GuidelinesisValidConnection in FlowCanvas.tsx enforces exactly 8 structural constraints:No self-loops.No cycles (iterative Breadth-First Search (BFS) starting from target node).Trigger node is restricted to 0 inbound edges.Complete node is restricted to 0 outbound edges.Trigger and Action nodes must have a maximum of 1 outbound edge.Branch nodes must have a maximum of 2 outbound edges (strictly one per handle: yes and no).Duplicate connections (same source + same target) are blocked.Branch handles (yes / no) must point to different target nodes.3. CORE DATABASE SCHEMA +-------------------+
| tenants |
+-------------------+
| (1:N)
v
+-------------------+
| users |<--+ (Manager Self-Ref)
+-------------------+ | (1:N)
| (1:N) | (1:1) -+
| +---------------+
v v (1:1)
+---------------+ +------------------+
| departments |<=(Max 3)==>| head_user_id | (Circular FK)
+---------------+ Levels +------------------+
| (1:N)
v
+---------------+
| flows |
+---------------+
| (1:1 circular)
v
+---------------+
| flow_versions | (Stores Canvas Graph JSONB)
+---------------+
| (1:N)
v
+----------------+
| flow_instances |
+----------------+
| (1:N)
v
+----------------+
| step_instances |
+----------------+
| (1:N)
v
+------------------+
| step_attachments |
+------------------+
Table Definitionstenantsid (uuid, PK)name (text)plan (text)created_at (timestamptz)users (Linked to Supabase Auth metadata)id (uuid, PK -> auth.users)tenant_id (uuid, FK -> tenants)email (text)full_name (text)role (text: 'admin' | 'user')manager_id (uuid, FK -> users [ON DELETE SET NULL])department_id (uuid, FK -> departments [ON DELETE SET NULL])departmentsid (uuid, PK)tenant_id (uuid, FK -> tenants)name (text)parent_id (uuid, FK -> departments [ON DELETE SET NULL] - Limit: max 3 levels deep)head_user_id (uuid, FK -> users [ON DELETE SET NULL])created_at / updated_at (timestamptz)flowsid (uuid, PK)tenant_id (uuid, FK -> tenants)name (text)status (text: 'draft' | 'published')latest_version_id (uuid, circular FK -> flow_versions [ON DELETE SET NULL])category_id (uuid, FK -> flow_categories [ON DELETE SET NULL])created_at / updated_at (timestamptz)flow_versionsid (uuid, PK)flow_id (uuid, FK -> flows [ON DELETE CASCADE])version_number (int)graph (JSONB) - Contains full React Flow canvas metadata:nodes array (coordinates, name, step schema, fields, assignee rules)edges array (connections, routing tags)published_at (timestamptz, nullable)created_at (timestamptz)flow_instances (Runtime executions)id (uuid, PK)flow_version_id (uuid, FK -> flow_versions)triggered_by (uuid, FK -> users)current_step_id (text)status (text: 'pending' | 'completed' | 'cancelled' | 'error')created_at / updated_at (timestamptz)step_instancesid (uuid, PK)instance_id (uuid, FK -> flow_instances [ON DELETE CASCADE])step_id (text) - Corresponds to the node ID in the graph schemaassigned_to (uuid, FK -> users)form_data (JSONB) - Active responses submitted by usersstatus (text: 'pending' | 'completed' | 'skipped')completed_at / created_at (timestamptz)step_attachmentsid (uuid, PK)step_instance_id (uuid, FK -> step_instances [ON DELETE CASCADE])field_key (text)storage_path (text)filename (text)size_bytes (bigint)created_at (timestamptz)flow_event_logs (Activity log)id, instance_id, step_instance_id, tenant_id, actor_id, event_type, description, metadata (JSONB), created_atevent_type: 'flow_triggered' | 'step_assigned' | 'step_draft_saved' | 'step_submitted' | 'branch_evaluated' | 'flow_completed' | 'flow_error' | 'flow_cancelled'notification_logs (Email dispatch logging)id, tenant_id, instance_id, step_instance_id, recipient_email, email_type, status ('sent' | 'failed'), resend_id, error_message, created_at4. RUNTIME SYSTEM & REFACTOR HIGHLIGHTSDynamic Cross-Node Branch EvaluationUpgraded branch logic (advanceFlow inside src/lib/flows/actions.ts) evaluates conditions using values from any prior completed step on the path.Prior steps are dynamically walked via a reverse BFS search in the branch config panel to fetch valid upstream properties.Condition Structure:type BranchCondition = {
id: string;
fieldId: string;
nodeId?: string; // If undefined/legacy, defaults to the immediate parent step
operator: 'eq';
value: string;
handleId: 'yes' | 'no';
}
Private Uploads and Storage PathsBucket: step-attachments (Private, 10MB individual file limits enforced)Structured Pathing: {tenantId}/{instanceId}/{stepNodeId}/{fieldId}/{timestamp}*{filename}Action Sequence: Draft saves not written to storage (they remain in browser memory). Form submissions upload the file client-side via a browser client first, then commit paths as a string array inside the JSONB payload.Secure Downloads: Handled via getSignedUrl() action yielding a temporary 60-second download token.Display Component: FileDownloadLink.tsx checks values using the isFilePaths(value) check to render downloadable links.Department Head RoutingDatabase maps departments.head_user_id -> users(id).If selected, the assignee router evaluates the assignee via a dedicated Supabase Edge Function (resolve-assignee). It prioritizes this designated user first and falls back to alphabetical sorting of the department members if undefined.My Tasks 3-Tab ConsolidationTo optimize navigation, /my-flows has been deprecated and removed from the sidebar. Everything resides on a consolidated /tasks layout featuring three tabs:Pending Tasks: Shows actions assigned directly to the logged-in user.My Flows: Shows all flow instances triggered by the user, regardless of active status.History: Displays a collapsible summary of historical items completed by the user.5. RECENT WORK: PHASE 4 METRICS & ADMIN SYSTEMS (DAYS 39-40)Administrative Dashboard (/dashboard)Rebuilt from a temporary placeholder into a robust, server-side data analytics dashboard.Stat Cards (4): Total Flows, Active Instances, Completed This Month, and Cancelled.Per-flow Breakdown Table: Compiles Flow Name (linking directly back to /flows/[id]/edit), Status Badge, and relative metrics (Total, Pending, Completed, Cancelled, and Error totals).Flows with zero run cycles still successfully appear via parallel structural loads."Pending-at-who" Bottleneck Table: Resolves the Assignee Name, Email, Pending Step counts, and the Oldest Pending age.Color-coding Thresholds: Pending counts $\ge 5$ render in bold red, while counts $\ge 3$ render in amber.Aging Alerts: Oldest pending entries exceeding 7 days trigger a bold red alert accompanied by an warning icon.Security & Isolation: Tenant isolation is enforced inside single-pass server queries using nested joins: flow_instances $\rightarrow$ flow_versions $\rightarrow$ flows(tenant_id).Admin Instances Hub (/admin/instances)New paginated, multi-filterable system layout designed to trace all execution pathways inside the tenant space.5 Interactive Filters: Filter dynamically by Flow (Dropdown), Status (Dropdown), Triggered-by User (Dropdown), Date range (From/To inputs), and Free-text search (scans Flow Name, User Name, and Email).Filter Badge: Indicates the exact count of active filter parameters on the toggle label.Ellipsis Pagination: Client-side execution displaying 20 items per page with smart dot navigation helpers.Unified Detail Presentation: Integrates a half-screen slide-in detail panel (lg:w-[50vw]) matching the state patterns used inside tasks-client.tsx. Supports active row-state highlighting and closes cleanly with the Escape key.Auth Redirect HarmonizationAll four login entry redirect endpoints have been redirected away from /dashboard and aimed at /tasks for both admins and standard users./dashboard has been locked under ADMIN_ONLY_ROUTES within middleware.ts.6. KNOWN GOTCHAS & DEVELOPMENT TRAPSPostgREST Relationship Ambiguity: Having dual Foreign Keys between tables (like users referencing departments via department_id, while departments references users via head_user_id) will crash raw joins with a PostgREST ambiguous relationship error.Fix: Always supply an explicit hint in your select string:const query = supabase.from('users').select('id, email, departments!department_id ( id, name )');
Self-Joins: Direct database self-joins (such as users!manager_id joined back to users) crash in PostgREST.Fix: Run two distinct queries, and map relationships using a client-side dictionary dictionary mapping (managerMap).Windows Environment File Corruption: Running npm install while your Next.js development server is active can corrupt .next caches on Windows systems.Fix: If you see weird build errors, run rm -rf .next and restart your dev server.Next.js 14 'use server' Exports: Under the Next 14 App Router, dynamic server action modules can only export asynchronous functions. Re-exporting modules, constants, or types from server action files is strictly prohibited and breaks builds.Radix Select.Item Empty-Value Crash: Setting value="" in Radix-based UI selectors (such as the "Clear filter" select option) triggers immediate component-tree crashes.Fix: Replace all empty string selection options with a designated sentinel string "all", then handle "all" as a bypassed query parameter in your filters.Administrative Component Context Bleed: Rendering InstanceDetailClient in administrative views (such as inside the /admin/instances page layout) can lead to missing properties if user properties are not explicitly hydrated.Fix: Always pass down currentUserId, isAdmin, and tenantId from the parent server component when rendering detail overlays in admin routers.7. DEVELOPMENT ROADMAP: PHASE 4 (REMAINING) PHASE 1 — FOUNDATION ✅ COMPLETE (Days 1–22)
PHASE 2 — FLOW BUILDER ✅ COMPLETE (Days 23–32)
PHASE 3 — RUNTIME ENGINE ✅ COMPLETE (Days 33–38)
POST-DAY-38 UI POLISH ✅ COMPLETE
PHASE 4 — ADMIN DASHBOARD ✅ COMPLETE (Days 39–42)
PHASE 5 — (see §10 roadmap) 🔜 PLANNED
Remaining Milestones to Complete:1. CSV Data ExportBuild an admin export pathway linking flow parameters, dates, triggers, status metadata, and dynamically flattened step variables into a CSV format.Implement a secondary export handler mapping uploaded step-attachments metadata to static URLs.2. Comprehensive Audit TrailEstablish a database-backed audit_log tracking events like role revisions, structural publishing adjustments, and step reassignments.Create a paginated administrative audit subpage (/admin/audit) featuring query filtering.3. Flow Version Difference ViewerConstruct a diff-comparison component capable of comparing JSON representations between any two structural version numbers.

8. DAY 41 — PHASE 4 ADMIN REPORTS (COMPLETED)
   All three remaining Phase 4 milestones built in one session; `npm run build` passes clean.

CSV Data Export (/admin/instances): New admin-only GET route src/app/api/admin/export/route.ts with two modes via ?type=. instances → one row per flow instance: base columns (id, flow, status, triggerer, dates, step counts) plus dynamically flattened step-variable columns (the union of every step·field across the filtered set, resolved to human labels via each version's graph; file-type fields render "N file(s)"). attachments → one row per uploaded file with 7-day signed download URLs (batched createSignedUrls). Output prefixed with a UTF-8 BOM and CRLF line endings for Excel. An "Export" dropdown in instances-client.tsx builds the download URL from the active filters (flow/status/user/date/search). Auth: route checks admin in-handler because middleware guards /admin but NOT /api/admin.

Audit Trail (/admin/audit): New table audit_log (migration 20260521120000_add_audit_log.sql) — tenant-isolated SELECT RLS via the app_metadata path, service-role writes only, polymorphic target_type/target_id/target_label, action CHECK set (role_changed, flow_published, flow_unpublished, step_reassigned), indexes on tenant/created_at/action. Reusable helper logAuditEvent() in src/lib/audit/log.ts (plain module, non-fatal try/catch, typed db: SupabaseClient). Emitters wired into updateUserRole (users/actions.ts, captures old→new role) and publishFlow / unpublishFlow / reassignStep (lib/flows/actions.ts). Added userId to the requireAdminWithTenant gate so flow actions can record the actor. Server page loads up to 1000 recent rows + resolves actor names; audit-client.tsx does action/actor/date/search filtering + 20-per-page pagination. Nav item "Audit Trail" (admin-only); /admin/audit already covered by the /admin middleware prefix.

Flow Version Diff Viewer (Flow Builder → version panel): Pure diffGraphs() in src/lib/flows/diff.ts compares two SerializedGraphs and reports steps added/removed/modified (field add/remove/modify, assignee-rule, branch-logic, rename, description changes) plus connections added/removed. VersionDiffDialog.tsx fetches both versions' graphs via /api/flows/versions/[versionId] and renders a readable summary (count pills + sectioned list). A "Compare versions" affordance was added to VersionListPanel.tsx (two version selects defaulting to newest vs. previous → "View changes" modal).

NEW TRAP — Set/Map spread vs TS target: tsconfig sets no "target", so it defaults to ES3 and spreading a Set/Map ([...set], [...map.keys()]) fails the build with a downlevelIteration error. Always use Array.from() instead. (Fixed two pre-existing such spreads in admin/instances/page.tsx that were silently breaking the build.) Also re-confirmed the Windows .next corruption trap: a build failed with PageNotFoundError on unrelated pages (/departments, /login) — cleared with rm -rf .next, then rebuilt clean.

Testing status: actions.test.ts passes (incl. publishFlow/unpublishFlow). 2 PRE-EXISTING failures remain in category-actions.test.ts (untouched files, unrelated to Day 41). Tenant Isolation Integrity Test (GET /api/test/tenant-isolation) could NOT be run: the route is middleware-guarded (307 → /login for unauthenticated callers) AND its hard-coded Tenant B fixture creds (tenant_b_user@test.com / TestPassword123!) are now rejected by Supabase ("Invalid login credentials"), so the endpoint fails at its own Tenant B sign-in. The route also does NOT yet cover the new audit_log table. To re-enable: recreate the Tenant B fixture user (or update the route creds) and extend the table list with audit_log. Outstanding before sign-off: this isolation re-check + live-browser QA of all three features.

Bug fix (post Day 41): In instance-detail-client.tsx the isCurrent flag was evaluated as detail.current_step_id === stepInstance.id with no flow-status guard. The DB leaves current_step_id pointing at the last processed step even after a flow completes, so the "Current step" badge appeared on a finished step in the History tab. Fixed by adding && detail.status === 'pending' to the condition.

9. DAY 42 — PHASE 4 QA & CANVAS POLISH (COMPLETED)
   Phase 4 signed off. `npm run build` passes clean (21 routes). Test suite: 41 passing (incl. 3 new updateDraftGraph + 7 new diffGraphs tests); the 2 category-actions.test.ts failures remain pre-existing and untouched.

Task 1 — Tenant Isolation Test & Phase 4 QA (rewritten as v4): The hard-coded fixture tenant ('aaaaaaaa-…') is gone and both real tenants (ACE Corp 06801690…, Sun Corp 280c705a…) now own flow data, so the old "indirect tables must return 0 rows" assertion no longer holds. Reframed the test: Tenant A = ACE Corp (owns the audit_log rows that must stay hidden), Tenant B = Sun Corp (signs in). Creds are read from .env.local (TENANT_ISOLATION_TEST_EMAIL / \_PASSWORD) — no real passwords in source. audit_log added to the direct-tenant_id checks. Indirect tables (flow_versions, flow_instances, step_instances, step_attachments) now fetch a known Tenant A row id via the service-role client and assert it is invisible to Tenant B (instead of assuming an empty Tenant B). QA was performed at the authenticated-HTTP level (no browser-automation tool available): minted a real session cookie via @supabase/ssr, then exercised the routes — isolation route returns allIsolated for all 8 tables; CSV export (instances) returns text/csv with UTF-8 BOM (byte-verified EF BB BF), CRLF, correct header + 3 data rows; attachments export returns correct header (0 rows — no uploads in DB); /admin/audit returns 200 with rendered entries. Pure client-side interactions (VersionDiffDialog open/render, audit-client filter/pagination dropdowns, instances-client export-URL builder, Radix selects) were NOT click-tested — only the data/route layer behind them was verified.

SECURITY FIX (found during isolation QA): GET /api/flows/versions/[versionId] used the service-role client (bypasses RLS) with NO tenant check — any authenticated user could read any tenant's flow graph by guessing a version UUID. Added a getSessionClaims gate + owning-flow tenant check (two queries, since flow_versions↔flows is an ambiguous PostgREST relationship); wrong-tenant now returns 404 (existence not revealed). Verified: ACE admin reads own version (200); Sun Corp blocked from an ACE version (404).

Task 2 — Canvas position-save polish (DONE): New updateDraftGraph(flowId, graph) server action in src/lib/flows/actions.ts overwrites the latest DRAFT version's graph in place (no version bump) — and, if the latest version is already published or none exists, falls back to saveDraftVersion so published history is never mutated. canvas-store.ts now shares one debounced (300ms) save path via a runDebouncedSave(saver) helper: triggerSave → saveDraftVersion (structural edits) and triggerPositionSave → updateDraftGraph (position-only moves). FlowCanvas.tsx splits node changes — STRUCTURAL_NODE_CHANGES {add, remove, reset} route to triggerSave; a position-only batch routes to triggerPositionSave (structural wins when both are present in one batch). This stops the version_number ballooning seen in existing flows (one had 153 versions, mostly from drags). Unit-tested all three updateDraftGraph paths.

NOTE — vitest .env / Resend: actions.ts transitively imports the email module, which does `new Resend(process.env.RESEND_API_KEY)` at module load. Vitest doesn't load .env.local, so the suite now mocks @/lib/email/resend (alongside the existing admin/auth mocks) to stay importable without a real key.

10. PHASE 5 — OPERATIONAL RELIABILITY: SLAs, ESCALATIONS & NOTIFICATIONS (ROADMAP)
    Theme: flows must not stall silently. This phase closes the loop on the bottleneck/aging data the Day 39 dashboard already surfaces — adding deadlines, proactive reminders, automatic escalation, and an in-app notification center. Builds on existing primitives: notification_logs (email dispatch log), flow_event_logs, audit_log + logAuditEvent(), the resolve-assignee edge function (manager resolution), and the dashboard's "oldest pending age" logic.

Milestone 1 — Step due dates / SLA config ✅ COMPLETE (Phase 5, Day 1)

- Builder: optional "Due within N hours/days" control in StepConfigPanel for action and branch nodes; persisted as slaHours on NodeData (graph JSONB — no extra DB column for config).
- Runtime: computeDueAt() in actions.ts sets due_at = now() + slaHours at both step_instance creation points (triggerFlow first step + advanceFlow subsequent steps).
- Migration 20260521130000_add_sla_to_step_instances.sql: nullable due_at (timestamptz) + partial index on step_instances; audit_log.action CHECK extended with 'step_escalated'.
- Surface: due date badge in Pending Tasks tab and instance detail step cards (colour-coded: red overdue / amber ≤24h / muted otherwise; hidden once step completes).

Milestone 2 — Reminder & digest emails

- Scheduler: Vercel Cron (app is already on Vercel) → secured GET /api/cron/sla guarded by a CRON_SECRET header check (NOT middleware-auth, since cron has no session). Document the secret in .env.local + Vercel env.
- Scan pending step_instances: T-1d "due soon" reminders and "overdue" notices → Resend emails, logged to notification_logs (reuse existing table; may add email_type values 'sla_reminder' | 'sla_overdue').
- Daily per-assignee digest of open tasks. Be careful to de-dupe (don't re-send the same reminder each cron tick — track last-sent in notification_logs or a sent flag).

Milestone 3 — Overdue escalation

- When a step is overdue past a threshold, escalate to the assignee's manager (reuse resolve-assignee / users.manager_id). Policy configurable per step (escalate after N hours overdue) or a tenant default.
- Record as audit_log action 'step_escalated' (migration: extend the action CHECK set) and a flow_event_logs entry. Reuse logAuditEvent().

Milestone 4 — In-app notification center ✅ COMPLETE (Phase 5, Day 2)

- Migration: notifications table + tenant/user RLS + Supabase Realtime publication.
- Emitters: step_assigned (triggerFlow + advanceFlow) and flow_completed (both paths in advanceFlow) wired via fire-and-forget createNotification() helper.
- Bell: NotificationBell client component in Topbar — unread count badge, dropdown with last 20, mark-as-read on click, mark-all-read button, Realtime subscription for live updates.
- Page: /notifications — full list (last 50), mark individual / mark-all-read, type badges.

Milestone 5 — Dashboard SLA surfacing ✅ COMPLETE (Phase 5, Day 3)

- "SLA Breached" and "Due Soon" stat cards added; "Overdue" and "Due Soon" columns added to the bottleneck table. Color-coded red/amber matching existing aging alerts.

Cross-cutting notes

- Timezones: store due_at in UTC; render in the viewer's locale. Decide whether SLA hours are calendar hours or business hours (start with calendar hours).
- Tenant isolation: every new table/route must follow the app_metadata RLS path and the service-role-write pattern; extend GET /api/test/tenant-isolation to cover notifications (and any new tables).
- Idempotency: the cron path must be safe to run repeatedly without duplicate emails/escalations.

11. PHASE 5 DAY 1 — SLA CONFIG (COMPLETED)
    `npm run build` passes clean (21 routes). Test suite: 41 passing, 2 pre-existing category-actions failures unchanged.

Migration 20260521130000_add_sla_to_step_instances.sql: adds nullable due_at (timestamptz) to step_instances with a partial index (WHERE due_at IS NOT NULL) for efficient cron scanning. Extends audit_log.action CHECK to include 'step_escalated' ahead of Milestone 3 (requires DROP + re-ADD constraint in Postgres).

Flow Builder — StepConfigPanel.tsx: "Due within" field added for action AND branch nodes (both are human-assigned and have form fields). Stores slaHours (always in hours) on NodeData in the graph JSONB. Unit selector converts for display via deriveSlaDisplay(): hours divisible by 24 round-trip as days. Clearing the number field removes slaHours from NodeData entirely. triggerSave() called on every change so it persists like label/description edits.

Runtime — actions.ts: computeDueAt(slaHours) helper = now() + slaHours×3600s, returns null when unset. Wired into both step_instance creation sites: triggerFlow (first step after trigger node) and advanceFlow (each subsequent step). Both calls now pass due_at to the DB insert.

Data model: TaskListItem.dueAt added; StepInstanceRow.due_at added in both actions.ts (used by tasks panel) and my-flows/[id]/types.ts (used by full instance detail page). All DB selects and row-mapping functions updated: getMyTasks, getInstanceDetailForPanel, my-flows/[id]/page.tsx.

UI: formatDue() helper added to tasks-client.tsx and instance-detail-client.tsx. Colour rules: diff < 0 → red "Xm/h/d overdue"; diff < 24h → amber "Due in Xh/m"; else → muted "Due DD Mon". PendingTaskCard renders it below the created-at line. Step cards in instance detail show it only while status = 'pending' (hidden once completed_at is set).

12. PHASE 5 DAY 2 — IN-APP NOTIFICATION CENTER (COMPLETED)
    Milestone 2 (reminder emails) and Milestone 3 (escalation emails) parked — Resend requires a verified domain to send to arbitrary recipients; will revisit once domain is set up. Jumped to Milestone 4 instead (no email dependency).

`npm run build` passes clean (22 routes — /notifications added). Test suite: 41 passing, 2 pre-existing category-actions failures unchanged.

Migration 20260521140000_add_notifications.sql: notifications table with tenant_id, user_id, type (CHECK: step_assigned|flow_completed|sla_reminder|step_escalated), title, body, link, read_at, created_at. Two indexes: (user_id, created_at DESC) for feed queries; partial (user_id WHERE read_at IS NULL) for unread count. RLS SELECT + UPDATE policies for own rows only (auth.uid() + app_metadata tenant check). ALTER PUBLICATION supabase_realtime ADD TABLE notifications enables live push.

src/lib/notifications/create.ts: createNotification() — admin client insert, non-fatal try/catch, fire-and-forget safe. Called with void from actions.ts in three places: step_assigned in triggerFlow, step_assigned in advanceFlow, flow_completed (both advanceFlow paths). Vitest mock added for @/lib/notifications/create to keep the test suite clean.

src/lib/notifications/actions.ts: getNotifications(limit), markNotificationRead(id), markAllNotificationsRead() — all use admin client + getSessionClaims() auth gate + explicit user_id/tenant_id filter for safety.

NotificationBell.tsx (src/components/shell/): client component, receives userId + initialNotifications (fetched server-side in Topbar). Supabase Realtime channel subscribed on INSERT and UPDATE for user_id=eq.{userId}. Unread count badge (red, capped at 9+). DropdownMenu with 20-item scrollable list — unread rows have blue tint + blue dot. Click → markNotificationRead + router.push(link). "Mark all read" button. "View all notifications →" footer link.

Topbar.tsx updated: accepts userId prop; fetches initialNotifications server-side (alongside existing tenant/profile queries); renders NotificationBell between brand and avatar. layout.tsx updated to pass user.id to Topbar.

/notifications page: server page (getNotifications(50)) + NotificationsClient: full list with type badges (📋✅⏰⚠️), individual "Mark read" + "View →" links, "Mark all read" button, empty-state illustration.

13. PHASE 5 DAY 3 — DASHBOARD SLA SURFACING & ISOLATION TEST PATCH (COMPLETED)
    Milestone 5 complete. `npm run build` passes clean (22 routes). Test suite unchanged.

Milestone 5 — Dashboard SLA surfacing (dashboard/page.tsx):

- Two new stat cards added: "SLA Breached" (red, AlertCircle icon) and "Due Soon" (amber, Clock icon). Stat card grid changed from xl:grid-cols-4 to xl:grid-cols-3 to accommodate 6 cards cleanly.
- Counters totalOverdue and totalDueSoon declared alongside activePending/cancelledTotal (before the statCards array) and populated during the step_instances aggregation loop.
- due_at added to the step_instances select query and RawPendingStep type.
- Aggregation loop now computes isOverdue (due_at < now) and isDueSoon (0 < due_at - now < 24h) per step, incrementing both the tenant-wide counters and per-user overdueCount/dueSoonCount.
- PendingUserRow type extended with overdueCount and dueSoonCount.
- Bottleneck table ("Pending at Who") gets two new columns — "Overdue" (red when > 0) and "Due Soon" (amber when > 0); zero values render as "—" to reduce visual noise.

Tenant isolation test patch (api/test/tenant-isolation/route.ts):

- notifications added to directTenantTables (alongside users, departments, flows, audit_log). RLS is compound (auth.uid() = user_id AND tenant_id check), so querying tenant_id = TENANT_A_ID as Tenant B will return 0 rows. The existing "own-data not exercised" note now covers both audit_log and notifications when Tenant B has no rows.

14. PHASE 6 DAY 1 — USER DEACTIVATION & BULK TASK REASSIGNMENT (COMPLETED)
    Milestones 1 & 2 of Phase 6. `npm run build` passes clean (22 routes). Test suite unchanged.

Migration 20260521150000_add_user_deactivation.sql: ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE to users + partial index (tenant_id, is_active). Extends audit_log.action CHECK to include 'user_deactivated', 'user_reactivated', 'tasks_bulk_reassigned' (DROP + re-ADD pattern).

AuditAction type (src/lib/audit/log.ts): Extended with 'step_escalated' (missed from Phase 5), 'user_deactivated', 'user_reactivated', 'tasks_bulk_reassigned'.

Server actions (src/app/(app)/users/actions.ts):

- deactivateUser(targetUserId): bans via auth.admin.updateUserById({ ban_duration: '876000h' }) + sets is_active=false + logs audit. Blocks self-deactivation.
- reactivateUser(targetUserId): unban via ban_duration='none' + sets is_active=true + logs audit.

Server action (src/lib/flows/actions.ts):

- bulkReassignTasks(fromUserId, toUserId): single UPDATE step_instances SET assigned_to=toUserId WHERE assigned_to=fromUserId AND status='pending'. Verifies toUser is active. Fires createNotification() to new assignee. Logs 'tasks_bulk_reassigned' audit entry with count. Revalidates /users, /tasks, /dashboard.
- getTenantUsers(): now filters .eq('is_active', true) so inactive users never appear as reassignment targets.

UI changes:

- UserRow type (users-table.tsx): is_active field added. Deactivated rows rendered at opacity-60 with "Inactive" badge. Avatar bg switches to muted for deactivated users.
- UserActions (user-actions.tsx): "Deactivate User" menu item (active users, not self) / "Reactivate User" (inactive users). Delegates to DeactivateUserDialog.
- DeactivateUserDialog (new): confirm dialog handles both deactivate and reactivate in one component, toggling text/style based on user.is_active.
- BulkReassignDialog (new): user picker (active users only, excludes self) + "Reassign N tasks" CTA. Calls bulkReassignTasks().
- UserProfileActions (new client component): shown on /users/[id]. Shows "Reassign N pending tasks" button (when count > 0) and "Deactivate"/"Reactivate" button (not shown for self).
- users/[id]/page.tsx: now fetches is_active, pending task count, and active users list. Renders amber "Inactive" banner and UserProfileActions.
- users/page.tsx: is_active included in query. allUsers prop filtered to active-only (for manager dropdown).

Resolve-assignee edge function (supabase/functions/resolve-assignee/index.ts): .eq('is_active', true) added to ALL user lookups: department head walk, resolveRequester, resolveFixed, resolveManagerOfRequestor (manager query), resolveSkipLevel (both manager and skip-level queries), resolveRoleInDept. Inactive users are treated as missing — rule fails with a descriptive error rather than routing to a banned account.

KNOWN GOTCHA — ban_duration: '876000h' (~100 years) is used for effective permanent bans. 'none' lifts the ban. This uses Supabase's Go duration string format. Do not use 'indefinite' — it is not a valid value.

15. PHASE 6 DAY 1 — QA & BUG FIXES (COMPLETED)
    Manual QA of Phase 6 Day 1 features revealed three bugs; all fixed. `npm run lint` passes clean.

Bug 1 — /users blank list after migration: The migration (20260521150000_add_user_deactivation.sql) had not been applied to the database. users/page.tsx selects is_active; PostgREST returned an error (column not found), which was silently swallowed (console.error + fallback to []). Fix: run the migration. Root cause documented.

Bug 2 — /users/[id] profile page redirecting silently to /users: getUserWithChain used departments(name) without the explicit FK hint required by the ambiguous users↔departments dual-FK relationship. PostgREST returned an ambiguous relationship error, data came back null, and the page hit redirect('/users'). The user experienced this as "nothing happens when clicking a user." Fix: changed to departments!department_id ( name ) matching the pattern used in users/page.tsx.

Bug 3 — Assignee resolution failure showed "Unassigned" with no explanation: When resolve-assignee returns { assigned_to_user_id: null, error: "..." } (e.g. fixed assignee is deactivated), triggerFlow and advanceFlow only checked assigned_to_user_id and silently discarded result.error. The step was created with assigned_to = null and the event log said "assigned to Unassigned." Fix: both call sites now capture assigneeError; if set, writeEventLog is called with eventType: 'flow_error' and description: '"Step" could not be assigned: <edge function error message>'. Metadata also records assigneeError for debugging.

Resolve-assignee edge function redeployed to Supabase (npx supabase functions deploy) to activate the is_active filters added in Day 1 code.

KNOWN TEST SCENARIO — Bulk Reassign button (Test 3): The "Reassign N pending tasks" button on /users/[id] only renders when pendingCount > 0. To test: trigger a flow that assigns a step to User A first, then deactivate User A, then visit their profile. The button appears because the pending step_instance remains assigned to them after deactivation.

16. PHASE 6 — COMPLETE ✅

M1 — User deactivation ✅ COMPLETE (Day 1)
M2 — Bulk task reassignment ✅ COMPLETE (Day 1)
M3 — Invite email delivery ✅ COMPLETE (Day 2)
M4 — SLA digest emails + escalation ✅ COMPLETE (Day 2)
M5 — User self-service profile page ✅ COMPLETE (Day 2)

17. PHASE 6 DAY 2 — INVITE EMAIL, SLA CRON & SETTINGS (COMPLETED)
    `npm run build` passes clean (24 routes). Test suite: 41 passing, 2 pre-existing category-actions failures unchanged.

M3 — Invite email delivery:
inviteUser() in src/app/(app)/invite/actions.ts now calls sendInviteEmail() (fire-and-forget) after the public.users row is pre-inserted. The Supabase magic link from inviteData.properties.action_link is passed directly to Resend. New buildInviteEmail() template in templates.ts: branded shell, "Accept invitation" CTA button, 24h expiry note. sendInviteEmail() in resend.ts logs to notification_logs with email_type='invite' (instanceId=null — nullable FK, no constraint violation). Migration 20260522100000 extends notification_logs.email_type CHECK to include 'invite', 'sla_reminder', 'sla_overdue', 'sla_escalation'. inviterName and tenantName are resolved via two parallel adminClient queries so the email body is personalised.

M4 — SLA daily digest + escalation emails:
Migration 20260522110000 adds escalate_after_hours (nullable integer) to step_instances with a partial index on (due_at, escalate_after_hours). NodeData gains escalateAfterHours?: number (stored in graph JSONB). StepConfigPanel shows an "Escalate after N hours/days overdue" field only when an SLA is already configured — the field is hidden otherwise to keep the UI clean. Both step_instance creation sites in actions.ts (triggerFlow first step + advanceFlow subsequent steps) now copy escalate_after_hours alongside due_at. Two new email templates: buildSlaDigestEmail() (per-assignee table of overdue + due-soon tasks) and buildEscalationEmail() (to manager, with overdue duration). Cron route GET /api/cron/sla (src/app/api/cron/sla/route.ts): secured by Authorization: Bearer {CRON_SECRET} header check; fetches all pending step_instances with due_at set; resolves flow names + step labels by walking instance→flow_version→graph JSONB; groups by assignee; sends one digest per assignee per day (de-duped via notification_logs sla_reminder rows for today); sends one escalation per step_instance once only (de-duped via notification_logs sla_escalation + step_instance_id). vercel.json created with schedule "0 1 \* \* \*" (1am UTC = 8am ICT). Env var CRON_SECRET must be set in .env.local and Vercel dashboard.

KNOWN GOTCHA — Array.from vs Set spread: cron route uses Array.from(new Set(...)) throughout. Never use [...new Set()] — tsconfig target defaults to ES3 and Set/Map spread fails at build time (downlevelIteration error). This is the same trap documented in Day 41.

M5 — User self-service profile page:
New route /settings (24th route) accessible to all authenticated roles — not in ADMIN_ONLY_ROUTES so middleware lets any logged-in user through. Server page src/app/(app)/settings/page.tsx fetches own users row (full_name, email) via read-only createClient(). Client form settings-form.tsx: email field shown read-only (no self-serve email change), full_name editable, save button disabled until value differs from initial. Server action updateOwnFullName() in src/app/(app)/settings/actions.ts: getSessionClaims() auth gate (no admin check), trims + validates name length, updates own row only via adminClient with .eq('id', user.id) + .eq('tenant_id', claims.tenant_id) double-guard. Avatar in Topbar replaced: static div → AvatarDropdown client component (src/components/shell/AvatarDropdown.tsx) using shadcn DropdownMenu; shows display name + email in header, Settings link (router.push('/settings')), Sign out (reuses createBrowserClient signOut pattern from SignOutButton). SignOutButton standalone component is still available but no longer used by Topbar.

18. PHASE 6 POST-DAY-2 — INVITE EMAIL QA & FORM FIX (COMPLETED)

Verified custom domain email delivery (noreply@aitomicflow.com):
.env.local updated to RESEND_FROM_EMAIL=noreply@aitomicflow.com (verified domain on Resend). No code change was required — resend.ts already reads const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev' at module load. The env-var swap was the only needed change. End-to-end verification via scripts/verify-invite.mjs confirmed Resend accepted the message with status=sent and a real resend_id, logged correctly to notification_logs with email_type='invite'.

Bug fix — InviteForm always showed success toast:
src/components/auth/invite-form.tsx was wrapping inviteUser() in a try/catch. Since Next.js server actions return discriminated union results ({ success: true } | { success: false, error: string }) rather than throwing, the catch block never fired — every call appeared to succeed even when the action returned { success: false }. Fixed by removing the try/catch and checking result.success directly, calling toast.error(result.error) on failure. Duplicate-invite attempts now correctly show the "A user with this email already exists." error toast instead of a false success.

Code hygiene — resend.ts comment removal:
Removed a stale multi-line comment on the FROM_EMAIL line that referenced onboarding@resend.dev as a production fallback; the single const line is self-documenting.

PENDING — Production environment variables to add in Vercel:

- RESEND_FROM_EMAIL=noreply@aitomicflow.com (invite + notification emails use verified domain)
- CRON_SECRET=<secret from .env.local> (required for GET /api/cron/sla to accept Vercel's cron trigger)

19. PHASE 7 — ENHANCED USER MANAGEMENT (ROADMAP)
    Theme: deeper user lifecycle management — securing access with MFA, streamlining onboarding via bulk import, and visualising team structure with an org chart.

M1 — MFA / OTP Authentication ✅ COMPLETE (Day 1)
M2 — Bulk CSV User Import 🔜 PLANNED (Day 2)
M3 — Invitation Pending Management ✅ COMPLETE (Day 1)
M4 — Org Chart 🔜 PLANNED (Day 3)
M5 — User Directory 🔜 PLANNED (Day 3)
M6 — Enhanced User Profiles (avatar, job title, phone) 🔜 PLANNED (Day 4)
M7 — Department Management UI 🔜 PLANNED (Day 2)
M8 — Guided Offboarding Wizard 🔜 PLANNED (Day 4)

20. PHASE 7 DAY 1 — MFA & INVITATION PENDING MANAGEMENT (COMPLETED)
    `npm run build` passes clean (26 routes — /auth/mfa and /invite/pending added). Test suite unchanged.

M1 — MFA / OTP Authentication:

- MfaCard.tsx (src/components/settings/MfaCard.tsx): client component on the /settings page. On mount calls supabase.auth.mfa.listFactors() to detect enrolled TOTP. Three states: unenrolled → qr (enroll + show QR + manual secret) → enrolled. Cleans up lingering unverified factors before re-enrolling. Verify calls supabase.auth.mfa.challengeAndVerify(); unenroll calls supabase.auth.mfa.unenroll(). No DB schema change required — Supabase stores TOTP factors internally.
- /settings page updated: split into "Profile" and "Security" sections; MfaCard renders in Security.
- login-form.tsx: after successful signInWithPassword, checks getAuthenticatorAssuranceLevel(). If nextLevel === 'aal2' and currentLevel !== 'aal2', redirects to /auth/mfa instead of /tasks.
- /auth/mfa page (src/app/auth/mfa/page.tsx): client page. On mount checks AAL (redirects to /tasks if already aal2 or MFA not enrolled). Creates a TOTP challenge, shows 6-digit input, calls verify(). On success redirects to /tasks.
- middleware.ts: /auth/mfa added to PUBLIC_ROUTES so the AAL1 session (post-password, pre-MFA) can load the challenge page.

KNOWN GOTCHA — Google OAuth + MFA: signInWithOAuth bypasses the login-form AAL check. If a user enrolled TOTP via email/password and then signs in with Google, the /auth/callback redirect goes straight to /tasks. Supabase returns aal1 for OAuth flows regardless of enrolled TOTP factors. Full enforcement would require an AAL check in /auth/callback — deferred to a future session.

M3 — Invitation Pending Management:

- Migration 20260523100000_add_pending_invitations.sql: pending_invitations table (tenant_id, email, invited_by FK→users, user_id FK→users ON DELETE SET NULL, invited_at, resend_count, last_resent_at, revoked_at, status CHECK pending|accepted|revoked). Admin-only SELECT RLS via app_metadata path. Partial index on (tenant_id, status, invited_at DESC).
- inviteUser() extended: after inserting public.users, inserts a pending_invitations row (non-fatal if insert fails).
- getPendingInvitations(): admin-only; joins inviter and invitee via users!invited_by and users!user_id; computes is_accepted from invitee.full_name IS NOT NULL (set during /account-setup).
- resendInvitation(id): regenerates magic link via generateLink, re-sends email, increments resend_count + updates last_resent_at.
- revokeInvitation(id): marks revoked first (captures user_id before ON DELETE SET NULL), then deletes public.users + auth.users via admin API.
- /invite/pending page: server page + PendingInvitationsClient. Table shows email, Pending/Accepted badge, invited-by name, last-sent date, resend count, Resend/Revoke action buttons (only for pending rows). Revoke requires a confirm() dialog.
- nav-items.ts: "Invite" gains exact: true flag (active only on /invite, not /invite/pending). "Pending Invites" added as a separate nav item. sidebar.tsx active-link logic respects the exact flag.

DELETION ORDER for revokeInvitation — status set to 'revoked' first (before the DB cascade nullifies user_id), then public.users deleted, then auth.admin.deleteUser(). This ordering is intentional: it ensures user_id is captured before ON DELETE SET NULL fires and that the auth.users deletion doesn't fail due to public.users FK reference.

21. PHASE 7 DAY 2+ — ORG CHART, DIRECTORY, AVATAR PROPAGATION & OFFBOARDING BUG FIX (COMPLETED)

M4 — Org Chart (/org-chart): ✅ COMPLETE

- ReactFlow-based interactive org chart; read-only for members, editable for admins.
- computeGraph() builds parentMap by combining users.manager_id with dept head relationships from departments.head_user_id. Dept heads' parent is the head of their dept's parent department.
- computeLayout() tree layout: leaf-slot counter → parent centroid. Stable across re-renders via graphKey useMemo (keyed on manager_id + head_user_id values).
- OrgNode custom node: renders avatar image or initials, department label, Head badge (amber), role badge.
- Admin interactions: drag source handle → target node → onConnect → updateUserManager() server action. Cycle detection via wouldCreateCycle() (walks upward from source). onEdgesDelete → updateUserManager(target, null). Optimistic edge update with rollback on error.
- Server action (org-chart/actions.ts): updateUserManager(userId, managerId) — adminClient + adminOnly guard + tenant check.

M5 — User Directory (/directory): ✅ COMPLETE

- Grid card browser (1–4 columns responsive). Filters: text search (name/email/dept) + department select.
- Department filter is hierarchy-aware: selecting a parent dept includes all descendant dept members via BFS buildDescendantSet().
- Dropdown uses DFS getSortedDepts() to produce indented tree (— prefix per depth level).
- Colorized initials fallback: deterministic hash of user.id maps to 6 fixed avatar color classes.

Avatar propagation — users list, org chart, directory:

- avatar_url added to DB select + type in all three surfaces. Conditionally renders <img object-cover> inside existing rounded container; background color class suppressed when image present to prevent color bleed through rounded corners.
- Files changed: users/page.tsx, users-table.tsx (UserRow type), directory/page.tsx, directory-client.tsx (DirectoryUser type), org-chart/page.tsx, org-chart-client.tsx (OrgUser + OrgNodeData types + computeGraph node data).

Offboarding wizard step-drift bug fix (offboarding-wizard.tsx):

- Root cause: steps[] was an inline array recomputed from props every render. bulkReassignTasks calls revalidatePath → Next.js re-renders page → pendingCount prop drops to 0 → steps shrinks from ['overview','tasks','deactivate'] to ['overview','deactivate'] while currentStepIdx was already at 2 → steps[2] = undefined → currentStep = 'done' → no action buttons rendered; user stuck with only Cancel.
- Fix: steps moved into useState (initialized lazily via buildSteps()). useEffect with [open] dependency snapshots the step list at dialog open time and resets index. Props changing mid-flow no longer mutate the frozen step list. eslint-disable-next-line react-hooks/exhaustive-deps is intentional — we close over prop values at open time only.

Enhanced User Profiles — avatar upload (migration 20260523200000_add_profile_fields.sql):

- Adds avatar_url (text nullable) to users table.
- Defines avatars storage bucket (private) + 4 RLS policies on storage.objects: SELECT own files, INSERT own files (path must start with auth.uid()), UPDATE own files, DELETE own files.
- Storage bucket `avatars` is active; avatar upload, display in users list, org chart, and directory confirmed working.

PHASE 7 MILESTONE STATUS UPDATE — ALL COMPLETE ✅:
M1 — MFA / OTP Authentication ✅ COMPLETE (Day 1)
M2 — Bulk CSV User Import ✅ COMPLETE — /invite/import; parse→preview→import→results; bulkImportUsers server action; nav item "Bulk Import"
M3 — Invitation Pending Management ✅ COMPLETE (Day 1)
M4 — Org Chart ✅ COMPLETE
M5 — User Directory ✅ COMPLETE
M6 — Enhanced User Profiles (avatar, job title, phone) ✅ COMPLETE — all three fields on /settings
M7 — Department Management UI ✅ COMPLETE — /departments; full CRUD (create/rename/delete/reparent/set-head); 3-level depth guard; 7 components
M8 — Guided Offboarding Wizard ✅ COMPLETE — multi-step dialog: overview→tasks→reports→depthead→deactivate

PHASE 7 COMPLETE. Build: 29 routes, clean. Known open: Google OAuth MFA enforcement deferred (OAuth returns aal1 regardless of enrolled TOTP; AAL check in /auth/callback needed for full enforcement).

22. POST-PHASE 7 — USER MANAGEMENT IMPROVEMENTS (CURRENT SESSION)
    `npm run build` passes clean (29 routes). Three independent improvements shipped.

─── A. Bulk CSV Import — password & invite columns ───────────────────────────

CSV template updated from `email,full_name,role` to `email,full_name,role,password,invite`.

Two creation paths in `bulkImportUsers` (src/app/(app)/invite/actions.ts):

- `invite=yes` → generates a Supabase magic invite link, sends the invite email via Resend, inserts a `pending_invitations` row (user appears on /invite/pending for tracking), password column ignored.
- `invite=no` → creates user immediately with the provided password (`email_confirm: true`). Password is required; missing password returns a row-level error without aborting the rest of the batch.

`BulkImportRow` type extended: `password?: string`, `invite: boolean`.
`BulkImportResult` type extended: `invited?: boolean` (true = invite sent, false = created with password).

Preview table gains Password (masked as ••••••••) and Invite (badge) columns. Rows with invite=no and no password show a red "missing" warning in the preview so admin catches errors before importing. Results table shows "Invite sent" vs "Created" in the status column. Description text and upload-zone hint updated. `revalidatePath('/invite/pending')` added so bulk-invited users appear immediately on the pending list.

─── B. Bulk user delete with checkbox selection ──────────────────────────────

`users-table.tsx` (src/components/users/users-table.tsx):

- First column is a checkbox using TanStack Table row selection (`getRowId: row => row.id`, `enableRowSelection: row => row.id !== currentUserId`). Native `<input type="checkbox">` with Tailwind styling (no new Radix dependency needed).
- "Select all" checkbox in the header. Own row's checkbox is always disabled.
- When ≥ 1 row is selected, a "Delete N selected" destructive button appears in the toolbar.
- Clicking the button first fetches impact data (see §C), then opens an AlertDialog showing the impact summary. Confirming calls `deleteUsers`.
- Selected rows get `data-state=selected` highlight.

`deleteUsers(userIds)` server action (src/app/(app)/users/actions.ts):

- Admin-only + tenant-scoped: verifies all targets belong to the caller's tenant before deleting.
- Silently skips the caller's own ID (cannot delete yourself).
- Calls `auth.admin.deleteUser(id)` per user; revalidates `/users` and `/org-chart`.
- Returns `{ deleted, skipped }`.

─── C. Pre-delete impact warning ─────────────────────────────────────────────

`getUsersDeleteImpact(userIds)` server action (src/app/(app)/users/actions.ts):

- Four parallel `count` queries: pending step_instances (`assigned_to IN userIds, status=pending`), direct reports (`manager_id IN userIds`), dept head roles (`head_user_id IN userIds`), active flow instances (`triggered_by IN userIds, status=pending`).
- Returns `{ pendingTasks, directReports, deptHeadRoles, activeFlows }`.

Delete dialog renders one of two states:

- **Amber warning box** listing every non-zero impact item with plain-English descriptions (e.g. "3 pending tasks will become unassigned and stall").
- **Green safe-to-delete box** when all counts are zero.
- Delete is not blocked — the dialog informs rather than prevents, so admins can still remove test/duplicate accounts even if they have incidental data.

─── D. DB bug fix — flow_instances.triggered_by NOT NULL ─────────────────────

Bug: `auth.admin.deleteUser()` was silently failing for users who had ever triggered a flow. Root cause found via Supabase auth logs:

`ERROR: null value in column "triggered_by" of relation "flow_instances" violates not-null constraint (SQLSTATE 23502)`

The FK on `flow_instances.triggered_by` was `ON DELETE SET NULL`, but the column was declared `NOT NULL`. When Supabase Auth deleted the auth.users row, Postgres tried to null out the `triggered_by` references and hit the column constraint, rolling back the entire delete.

Fix: migration `20260523210000_fix_flow_instances_triggered_by_nullable.sql`:
`ALTER TABLE public.flow_instances ALTER COLUMN triggered_by DROP NOT NULL;`

Applied to remote DB via Supabase MCP. Local migration file created. All other SET NULL FK columns (`step_instances.assigned_to`, `flow_event_logs.actor_id`, `audit_log.actor_id`, `users.manager_id`) were verified already nullable — only `triggered_by` was affected.

KNOWN GOTCHA — SET NULL FKs require nullable columns: Any FK declared `ON DELETE SET NULL` must have the column itself declared as nullable (`ALTER COLUMN ... DROP NOT NULL`). Mismatch causes silent delete failures at the auth layer that are only visible in Supabase auth service logs, not in PostgREST error responses.

23. SESSION — POST-PHASE 7 COMMIT & BUILD SIGN-OFF (2026-05-24)
    Reviewed Phase 7 completion (all 8 milestones ✅). Verified post-Phase 7 work (§22) was uncommitted; ran build, fixed lint, committed.

Lint fix — `users-table.tsx`:

- Removed unused `AlertDialogTrigger` import (imported but never used in JSX after the delete dialog was wired through a state flag rather than a Trigger wrapper). ESLint `no-unused-vars` flagged it as a hard warning.

Commit `c9338e5` — 8 files, 678 insertions:

- `src/app/(app)/invite/actions.ts` — bulkImportUsers two-path logic (invite vs password)
- `src/app/(app)/invite/import/import-client.tsx` — preview/results UI for password + invite columns
- `src/app/(app)/users/actions.ts` — deleteUsers + getUsersDeleteImpact server actions
- `src/components/users/users-table.tsx` — checkbox row selection + delete toolbar + lint fix
- `src/lib/flows/category-actions.test.ts` — pre-existing test file (minor touch)
- `scripts/verify-bulk-import.mjs` — new one-shot verification script for bulk import email flow
- `supabase/migrations/20260523210000_fix_flow_instances_triggered_by_nullable.sql` — triggered_by nullable fix
- `PROJECT_SUMMARY.md` — §22 docs

Build status: 29 routes, clean. No lint warnings. Test suite: 41 passing, 2 pre-existing category-actions failures unchanged.

Next phase TBD.

24. BUG FIXES & FORM IMPROVEMENTS (2026-05-24)

─── A. Notification bell redirect fix ───────────────────────────────────────

Bug: clicking a notification in the bell dropdown did not navigate to the
linked page. Root cause: `router.push()` in Next.js App Router is a soft
(client-side) navigation that only re-renders the page segment — the layout
(including `NotificationBell`) is not remounted, so the Radix `DropdownMenu`
open state persisted across navigations, leaving the dropdown sitting on top
of the new page and making it look like nothing happened.

Fix (`src/components/shell/NotificationBell.tsx`): added controlled `open`
state to `DropdownMenu`; `setOpen(false)` is called in `handleClick` before
`router.push()` so the dropdown closes first and the navigation is visible.

─── B. Long Text (textarea) form field type ─────────────────────────────────

New `textarea` `FormFieldType` added alongside the existing `text` (short text).

Builder changes:

- `canvas-store.ts`: `FormFieldType` union extended with `'textarea'`.
- `FormBuilderPanel.tsx`: new "Long Text" entry in the Add field dropdown;
  existing "Text" renamed to "Short Text" for clarity.
- `FormFieldRow.tsx`: badge label "Long Text", indigo color (`bg-indigo-100 text-indigo-700`).

Runtime (step form) changes:

- `StepFormModal.tsx` + `TaskDetailModal.tsx`: both files contain a `FieldRenderer`
  copy. Both updated with an `AutoTextarea` component — `rows={5}` minimum,
  auto-grows vertically via `scrollHeight` on every value change, `resize-none
overflow-hidden`. Disabled state renders as a read-only textarea (same styling).
- `instance-detail-client.tsx` + `TaskDetailModal.tsx` (`PreviousStepCard`):
  textarea submitted values rendered with `whitespace-pre-wrap` so newlines
  display correctly in read-only history views.

KNOWN GOTCHA — duplicate FieldRenderer: `StepFormModal.tsx` and
`TaskDetailModal.tsx` each contain their own `FieldRenderer` function. Any new
field type must be added to **both** files. Forgetting one causes the label to
render but the input to be invisible (the bug that triggered this fix).

25. PHASE 8 — DEPARTMENT MANAGEMENT IMPROVEMENTS (COMPLETE ✅)
    Theme: close the loop between org structure and live workflow activity —
    making /departments a useful operational surface, not just a setup screen.

M1 — Department Workload View ✅ COMPLETE

- New route /departments/workload: server page showing pending steps, overdue,
  due soon, and oldest pending age aggregated per department (independent, no
  rollup). Hierarchy-aware display (indented sub-depts). Color coding matches
  dashboard bottleneck table (red ≥ 5 / overdue, amber ≥ 3 / due soon,
  7-day red alert on oldest).
- Nav restructured: "Departments" is now a sidebar group (like "Users") with
  two items — "Management" (/departments, exact match) and "Workload"
  (/departments/workload). BarChart2 icon for Workload.

M2 — Inline Member Management ✅ COMPLETE

- Dialog on /departments: shows current members (with remove ✕ per row) and
  an "Add member" select for users in other depts (with "(moving dept)" hint).
  addMemberToDepartment / removeMemberFromDepartment server actions in
  src/app/(app)/departments/actions.ts. Revalidates /departments, /users,
  /org-chart. Wired via "Members" item in DepartmentActions dropdown.

M3 — Department Merge ✅ COMPLETE

- "Merge into…" action: bulk-moves all users from dept A → dept B via a single
  UPDATE. Transfers dept A's head to dept B if B has none. Optionally deletes
  source dept (skipped with amber warning if source has child departments).
  mergeDepartment() server action in src/app/(app)/departments/actions.ts.
  MergeDepartmentDialog renders a target Select + delete-source checkbox.
  Wired via "Merge into…" item in DepartmentActions dropdown.

M4 — Flow Trigger Restrictions by Department ✅ COMPLETE

- Migration 20260525100000_add_flow_department_restrictions.sql: adds
  allowed_department_ids uuid[] DEFAULT NULL to flows table.
- updateFlowDepartmentRestrictions() server action stores the list (null when
  empty, meaning unrestricted).
- triggerFlow() checks the caller's department_id against allowed_department_ids
  before creating the instance; returns an error if not in the list.
- "Trigger Restrictions" section in PublishPanel: toggle + per-dept checklist,
  auto-saves on every change, amber warning when restricted but no depts selected.
- Prop-threaded: edit page → FlowCanvas → ConfigSidebar → IdlePanel → PublishPanel.

26. PHASE 9 — AI INTEGRATION (ROADMAP)
    Theme: embed Claude AI into the builder and runtime to reduce manual effort,
    surface smarter defaults, and help non-technical users interact with workflows
    more naturally. Requires ANTHROPIC_API_KEY in .env.local and Vercel env vars.
    All AI calls must go through server actions or API routes — never from the browser.
    Use claude-sonnet-4-6 as the default model (best price/quality balance).

M1 — AI Flow Builder ✅ COMPLETE

    See §27 for full implementation notes and bug-fix history.

M2 — Smart Form Field Suggestions ✅ COMPLETE

    See §28 for full implementation notes.

M3 — Natural-language Branch Conditions ✅ COMPLETE

    See §29 for full implementation notes.

M4 — Flow Trigger Assistant ✅ COMPLETE

    See §30 for full implementation notes.

27. PHASE 9 M1 — AI FLOW BUILDER (COMPLETE ✅)
    `npm run build` passes clean. Committed across 5 incremental commits on master.

─── Overview ─────────────────────────────────────────────────────────────────

Two modes are available from the AI button (Sparkles/violet) in NodeToolbar:

- Generate (replace): describe a new workflow in plain English → Claude returns
  a complete SerializedGraph (nodes, edges, form fields, assignee rules) which
  replaces the current canvas and is saved as a new draft version.
- Modify (existing): describe a change to the current flow → Claude receives the
  full current graph as compact JSON and returns the updated graph. Only shown
  when the canvas already has nodes.

─── Files ────────────────────────────────────────────────────────────────────

src/lib/ai/flow-builder.ts (new — 'use server')

- Anthropic client instantiated once at module level (reads ANTHROPIC_API_KEY).
- SYSTEM_PROMPT: strict schema spec for generate mode — one trigger, one
  complete, action/branch rules, AssigneeRule options, BranchCondition rules,
  layout rules. Ends with hard JSON-only instruction.
- MODIFY_SYSTEM_PROMPT: same schema reference + 7 modification rules (preserve
  ids, keep trigger/complete, maintain connectivity). Hard JSON-only instruction.
- callClaude(systemPrompt, userContent, maxTokens): shared helper. Strips
  code fences (`json ... `) from model output, guards that response starts
  with '{', parses JSON, validates nodes/edges arrays.
- generateFlowFromDescription(description): admin auth gate + callClaude with
  SYSTEM_PROMPT, 4096 output tokens.
- modifyFlowFromDescription(instruction, currentGraph): admin auth gate +
  builds userContent as "EXISTING GRAPH:\n{compact JSON}\n\nMODIFICATION
  INSTRUCTION:\n..." + callClaude with MODIFY_SYSTEM_PROMPT, 8192 output tokens
  (modified graphs can be larger than generated ones).

src/components/canvas/AiFlowGeneratorDialog.tsx (new)

- Mode toggle (Modify existing / Replace with new) — only shown when canvas
  has existing nodes; defaults to generate when canvas is empty.
- Amber warning when in generate mode with existing nodes (canvas will be
  replaced).
- Textarea placeholder text differs by mode. Character counter.
- Generate button disabled until description.trim().length ≥ 10.
- Error surface: red alert box using destructive/30 border + AlertTriangle.

src/components/canvas/NodeToolbar.tsx

- Violet "AI" button (Sparkles icon) with onAiClick prop wired to open dialog.

src/components/canvas/FlowCanvas.tsx

- aiDialogOpen state + setAiDialogOpen.
- AiFlowGeneratorDialog wired with hasExistingNodes={nodes.length > 0} and
  currentGraph={serializeGraph(nodes, edges)}.
- handleGraphGenerated: deserializeGraph → setState(nodes, edges) → triggerSave.

─── Bug fixes encountered during M1 development ──────────────────────────────

1. Markdown code fences in response (SyntaxError: Unexpected token '`'):
Model returned `json ... ` despite the system prompt instruction.
Fix: strip with /^`(?:json)?\s*/i ... /\s*`$/ before JSON.parse.

2. Plain-text refusal (SyntaxError: Unexpected token 'I', "I don't se..."):
   Triggered when the prompt was judged ambiguous; model responded in English
   instead of JSON. Fix: !cleaned.startsWith('{') guard returns a friendly
   error; strengthened system prompt to say "make reasonable assumptions and
   still output valid JSON."

3. Assistant prefill 400 (invalid_request_error — "This model does not support
   assistant message prefill. The conversation must end with a user message."):
   An attempt to force JSON by appending { role: 'assistant', content: '{' }
   to the messages array failed because claude-sonnet-4-6 does not support
   assistant prefill. Fix: removed the prefill entirely; reverted to the
   instruction-only + code-fence-strip approach.

4. Modify mode 400 (compact JSON + token budget):
   First attempt at modify mode sent a large pretty-printed graph and hit
   token/request limits. Fix: JSON.stringify(currentGraph) (compact, no
   pretty-print) and raised max_tokens to 8192 for the modify call.

5. ANTHROPIC_API_KEY not set in production:
   "Could not resolve authentication method" error in Vercel logs. Fix: add
   ANTHROPIC_API_KEY to Vercel environment variables.

─── KNOWN GOTCHA — claude-sonnet-4-6 and assistant prefill ──────────────────

claude-sonnet-4-6 does NOT support the assistant message prefill technique
({ role: 'assistant', content: '...' } as the last message). The API returns
400 immediately. Rely on system prompt instructions + response post-processing
(code-fence stripping, startsWith guard) instead.

─── Assignee rule mapping ────────────────────────────────────────────────────

The system prompt lists 5 AssigneeRule options and instructs Claude to pick
the best match from the description:
requester | manager_of_requestor | skip_level | requester_dept_head
| fixed (only when an email address is explicitly mentioned)
Results are noticeably better when the description mentions roles explicitly
(e.g. "assigned to the requester's manager") vs. generic "step 2 approval".

28. PHASE 9 M2 — AI FORM FIELD SUGGESTIONS (COMPLETE ✅)
    Build: clean. Bug fix committed separately (default-label guard).

─── Overview ─────────────────────────────────────────────────────────────────

"Suggest fields with AI" button in FormBuilderPanel — visible only when:

1. The step has a custom label (not a default like "New Action" / "Branch")
2. The step has zero fields (button hides once any field exists)

Admin names the step, optionally adds a description, clicks the button.
Claude returns 3–6 typed field suggestions in a dismissible strip. Each
suggestion can be added individually; strip auto-closes when all are used.

─── Files ────────────────────────────────────────────────────────────────────

src/lib/ai/form-suggestions.ts (new — 'use server')

- suggestFormFields(stepLabel, stepDescription, flowName, nodeType)
- Admin-only auth gate. Sends 4-line context to claude-sonnet-4-6 (1024
  output tokens — suggestions are short).
- System prompt: 3-6 suggestions, specific types over generic text, no
  options arrays for dropdown/radio/checkbox (admin sets those manually),
  approval steps get radio (Approve/Reject) + textarea (Comments).
- Response parsing: code-fence strip + startsWith('[') guard (array, not
  object — same pattern as M1 but for JSON arrays).
- Returns FieldSuggestion[]: { type: FormFieldType, label: string }

src/components/canvas/panels/FormBuilderPanel.tsx

- New prop: flowName: string (threaded from edit page).
- hasCustomLabel: non-empty AND not in DEFAULT_LABELS set
  {'New Action', 'Branch', 'New Step', 'Trigger', 'Complete'}.
- handleSuggest(): useTransition wrapper → suggestFormFields() server action.
- handleAddSuggestion(s): addFormField() + immediate Zustand getState() read
  to find the new field id → updateFormField(label) → triggerSave() →
  removes suggestion from strip (auto-dismisses when strip empties).
- Suggestion strip: violet-tinted cards, type badge + label + Plus icon.
  X button dismisses all remaining suggestions.
- Error state: red alert inline below the empty-state box.

Prop threading (flowName): edit page → FlowCanvas → ConfigSidebar → FormBuilderPanel

─── KNOWN GOTCHA — default label guard ──────────────────────────────────────

The button must check BOTH that the label is non-empty AND that it differs
from the node's default label. Without the second check, "New Action" (the
default for action nodes) triggers the button immediately on node creation,
yielding meaningless generic suggestions before the admin has named the step.

29. PHASE 9 M3 — NATURAL-LANGUAGE BRANCH CONDITIONS (COMPLETE ✅)
    Build: clean. Three commits on master (initial M3, eq/neq case-insensitive fix, operator dropdown).

─── Overview ─────────────────────────────────────────────────────────────────

Each Yes/No branch group in BranchConfigPanel now has an "Parse with AI"
input strip at the bottom. The admin types a plain-English condition
("amount is more than 1000", "decision equals Approve") and presses Enter
or the Sparkles button. Claude maps it to a real fieldId + operator + value
and appends the condition to that group. Falls back with an inline error if
the field cannot be resolved.

Operators expanded from just 'eq' to the full set:
eq | neq | gt | lt | gte | lte | contains

─── Files ────────────────────────────────────────────────────────────────────

src/store/canvas-store.ts

- BranchCondition.operator widened:
  'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains'

src/lib/flows/actions.ts (advanceFlow — condition evaluator)

- switch on cond.operator replaces the single 'eq' check.
- Numeric operators (gt/lt/gte/lte) use parseFloat; return false if either
  side is NaN (safe for non-numeric field values).
- eq / neq: case-insensitive (toLowerCase on both sides).
- contains: case-insensitive fieldValue.toLowerCase().includes(...).

src/lib/ai/condition-parser.ts (new — 'use server')

- parseConditionFromText(text, availableFields, handleId)
- Admin-only auth gate. Sends plain-English text + typed field list to
  claude-sonnet-4-6 (512 output tokens — single JSON object).
- System prompt: operator guide, strict JSON-only output, two shapes
  (success object or { "error": string }).
- Response parsing: code-fence strip + startsWith('{') guard.
- Field validation: returned nodeId+fieldId pair is checked against
  availableFields before accepting — prevents hallucinated field refs.
- Returns { condition: Omit<BranchCondition, 'id'> | null, error: string | null }

src/components/canvas/panels/BranchConfigPanel.tsx

- availableFieldsForAI: useMemo that enriches FieldOption[] with fieldType
  by looking up the FormField from allNodes — gives Claude type context
  (e.g. knowing a field is 'number' triggers gt/lt operator selection).
- addParsedCondition(partial): generates an id and calls persist().
- BranchGroup: new props handleId, availableFields, onAddParsed.
  Contains local useState(aiText) + useTransition(isParsing) + aiError.
  AI input strip hidden when no fields available (nothing to reference).
  Enter key submits the input.
- ConditionRow: operator is now an interactive <select> dropdown (was a
  read-only badge). Options are filtered by the selected field's type via
  OPERATORS_BY_TYPE:
  text / textarea → eq, neq, contains
  number → eq, neq, gt, lt, gte, lte
  dropdown / radio → eq, neq
  checkbox → eq, contains
  date → eq, gt, lt, gte, lte
  file → eq only
  No field selected yet → defaults to eq, neq.
- handleFieldChange: when the field changes, the operator is auto-reset to
  the first allowed operator for the new field type if the current operator
  is no longer valid.
- RowProps gains availableFields: AvailableField[] so ConditionRow can look
  up the field type for the currently selected nodeId+fieldId pair.

─── KNOWN GOTCHA — field type context ───────────────────────────────────────

The AvailableField payload includes fieldType so Claude can pick the right
operator class (numeric vs. text). Without it, "amount > 1000" on a text
field would still parse correctly syntactically, but Claude might default to
'eq' not knowing the field is numeric. Passing type gives Claude the hint it
needs to select gt/lt/gte/lte for number fields automatically.

The same fieldType lookup drives the operator dropdown — both the AI parser
and the manual UI derive allowed operators from the same OPERATORS_BY_TYPE map,
so they stay in sync automatically.

30. PHASE 9 M4 — FLOW TRIGGER ASSISTANT (COMPLETE ✅)
    Build: clean. Two commits on master (initial M4, move from /my-flows to /flows).

─── Overview ─────────────────────────────────────────────────────────────────

Collapsible AI panel on the /flows page (nav bar item visible to all users).
Non-admins see it above the flow list. Admins are excluded — they already have
full builder controls on the same page.

User types a plain-English request ("I need to submit a leave request for next
week"). Claude matches it to the best published flow available to the user's
department, returns a confidence rating, a 1–2 sentence reasoning, and any
field values it can infer from the description. The user reviews the match and
clicks "Start this flow" to trigger it, then fills in the real form.

Prefill values are shown as informational hints only ("enter these when the
task form opens") — the actual triggerFlow call is unchanged and does not
pre-submit any form data.

─── Files ────────────────────────────────────────────────────────────────────

src/lib/ai/trigger-assistant.ts (new — 'use server')

- FlowSummary: { id, name, description, firstStepFields[] }
- FlowSuggestion: { flowId, confidence: 'high'|'medium'|'low', reasoning, prefillData }
- getAvailableFlowSummaries(): fetches published flows for the current user's
  tenant + filters by allowed_department_ids. Extracts first-step form fields
  by walking: trigger node → first edge → first step node → formSchema.
- suggestFlowForRequest(userText, flows): calls claude-sonnet-4-6 (512 tokens).
  System prompt: strict JSON-only output, flowId must match a real id or null,
  confidence definitions, prefillData rules (only explicitly stated values).
  Response parsing: code-fence strip + startsWith('{') guard + flowId
  validation against the provided list.

src/components/my-flows/FlowTriggerAssistant.tsx (new — 'use client')

- Collapsible violet panel (hidden entirely if flows.length === 0).
- Collapsed header: Sparkles icon + "Start a flow with AI" label.
- Expanded body: textarea + "Find a flow" button (useTransition for async).
- Suggestion result card: flow name, description, confidence badge
  (emerald=high, amber=medium, zinc=low), reasoning text, inferred values
  list, "Start this flow" trigger button, "Try again" reset link.
- No-match state: CircleDashed icon + reasoning + "Try a different description".
- ⌘↵ / Ctrl↵ keyboard shortcut submits the textarea.
- Error states: aiError (from Claude call) and triggerError (from triggerFlow)
  shown as inline destructive alert boxes.

src/app/(app)/flows/page.tsx

- Adds getAvailableFlowSummaries() to the parallel Promise.all fetch.
- Renders <FlowTriggerAssistant flows={summaries} /> for non-admins only,
  above <FlowsClient>.

─── Why /flows not /my-flows ─────────────────────────────────────────────────

/my-flows shows triggered instances (history view) and is not in the nav bar.
/flows is in the nav bar for all users and is where non-admins go to start a
flow. Moving the AI panel there maximises discoverability without requiring a
separate nav entry.

─── KNOWN GOTCHA — department filtering mirrors triggerFlow ─────────────────

getAvailableFlowSummaries uses the same allowed_department_ids logic as
triggerFlow so the AI panel never surfaces a flow the user cannot actually
trigger. The dept check is: if allowed is empty → open to all; otherwise the
user's department_id must be in the list.

31. PHASE 10 — AI COST CONTROL & MULTI-TENANCY (ROADMAP)
    Theme: make AI features financially sustainable. Every tenant controls whether
    AI is on, which provider/model they use, and pays (or consumes quota) for usage.
    Platform owner can see per-tenant spend for billing. BYOK tenants pay their
    provider directly; platform-key tenants consume an org-level USD credit quota.
    Encryption secret: AI_KEY_ENCRYPTION_SECRET (64-char hex, openssl rand -hex 32).
    Also requires OPENAI_API_KEY in env for platform-key OpenAI tenants.

M1 — Foundation Infrastructure ✅ COMPLETE

    See §32 for full implementation notes.

M2 — Tenant AI Settings UI ✅ COMPLETE

    See §33 for full implementation notes.

M3 — Platform-owner AI Usage Dashboard ✅ COMPLETE

    See §35 for full implementation notes.

M4 — AI Generate / Rewrite for Long Text Fields ✅ COMPLETE

    See §36 for full implementation notes.

M5 — Per-provider Model Selection ✅ COMPLETE

    See §37 for full implementation notes.

32. PHASE 10 M1 — AI FOUNDATION INFRASTRUCTURE (COMPLETE ✅)
    Build: clean. Committed on master (commit 2fbef04).

─── Overview ─────────────────────────────────────────────────────────────────

Replaced all direct Anthropic SDK calls with a unified callAI() gateway that
enforces per-tenant quota, logs every call for billing, encrypts BYOK keys, and
supports both Anthropic and OpenAI providers behind a single interface.

─── Database ─────────────────────────────────────────────────────────────────

supabase/migrations/20260525200000_ai_tenant_config.sql

tenant_ai_configs (one row per tenant):
ai_enabled bool (default false), use_own_key bool, provider text,
api_key_encrypted text | null, credit_limit_usd numeric (default 5.0000),
credit_used_usd numeric (default 0). RLS: tenant admin can SELECT/UPDATE own row.

ai_usage_logs (append-only billing log):
tenant_id, user_id, feature (flow_builder|form_suggestions|condition_parser|
trigger_assistant), provider, model, input_tokens, output_tokens, cost_usd,
using_own_key. RLS: tenant can SELECT own rows. Indexed on (tenant_id, created_at)
and (tenant_id, feature).

increment_ai_credit_used(p_tenant_id, p_amount) — SECURITY DEFINER function for
atomic credit increment (avoids read-modify-write race condition).

─── Files ────────────────────────────────────────────────────────────────────

src/lib/ai/crypto.ts
AES-256-GCM encrypt/decrypt. Key from AI_KEY_ENCRYPTION_SECRET (64-char hex).
Stored format: "iv:tag:ciphertext" (all hex). Authenticated encryption —
tamper-evident and integrity-checked.

src/lib/ai/pricing.ts
MODEL_PRICING record (USD per 1M tokens) for Claude Sonnet 4.6, Haiku 4.5,
Opus 4.7, GPT-4o, GPT-4o-mini. DEFAULT_MODEL per provider. computeCost() helper.

src/lib/ai/client.ts ('use server')
callAI({ tenantId, userId, feature, systemPrompt, userContent, maxTokens })
→ { text, inputTokens, outputTokens, costUsd }

Full flow:

1. Load tenant_ai_configs row (upsert default if missing).
2. Abort if ai_enabled = false (user-facing message).
3. If platform key: abort if credit_used_usd >= credit_limit_usd.
4. Resolve API key (decrypt BYOK or read platform env var).
5. Route to callAnthropic() or callOpenAI().
6. Insert ai_usage_logs row.
7. If platform key: call increment_ai_credit_used() RPC.

All 4 existing AI server actions (flow-builder, form-suggestions,
condition-parser, trigger-assistant) were rewritten to route through callAI()
instead of instantiating Anthropic SDK directly.

─── KNOWN GOTCHA — openai package version ───────────────────────────────────

openai@6.x is required (installed as openai@6.39.0). The older openai@4.x API
is incompatible with the v6 client constructor and chat.completions.create shape.

33. PHASE 10 M2 — TENANT AI SETTINGS UI (COMPLETE ✅)
    Build: clean. Committed on master (commit 73cfff9).

─── Overview ─────────────────────────────────────────────────────────────────

Tenant admins can configure AI through a new "AI Features" section appended to
the existing /settings page. Non-admins see no AI section (the section is
conditionally rendered server-side by role check).

─── Files ────────────────────────────────────────────────────────────────────

src/lib/ai/ai-settings-actions.ts ('use server')

- AISettingsData: { aiEnabled, provider, useOwnKey, hasOwnKey, creditUsedUsd,
  creditLimitUsd }. hasOwnKey is a bool — the raw key is never sent to the client.
- getAISettings(): reads tenant_ai_configs via admin client (admin role guard).
  Returns default values if no row exists yet (row is created on first AI call).
- updateAISettings({ aiEnabled?, provider?, useOwnKey? }): upserts the changed
  columns atomically.
- saveAPIKey(apiKey): encrypts with encryptApiKey(), upserts api_key_encrypted
  and sets use_own_key = true.
- removeAPIKey(): clears api_key_encrypted, sets use_own_key = false.

src/components/settings/AISettingsCard.tsx ('use client')

Rendered inside a card on /settings, admin only. All mutations use useTransition
and revert optimistic local state on error.

Controls:

- Enable AI toggle (saved on click, toggles visibility of all sub-controls).
- Provider select: Anthropic (Claude) | OpenAI (GPT). Saved on change.
- Key source radio: Platform key | Your own key. Saved on change.
- Own key section (when "Your own key"):
  - If key exists: masked display + Change (shows input) + Remove button.
  - If no key / Change pressed: password input + Cancel (if existing) + Save.
- Credit usage (when "Platform key"):
  Progress bar coloured green / yellow (≥70%) / red (≥90%).
  Shows "$used / $limit" and a note to contact admin for limit increases.

src/app/(app)/settings/page.tsx

- isAdmin derived from claims.role.
- getAISettings() fetched in parallel with the user profile query (Promise.all).
  Non-admins skip the fetch entirely (resolves to null immediately).
- "AI Features" section rendered only if isAdmin. Falls back to defaultAISettings
  if the DB row doesn't exist yet (first-time state).

─── Design decisions ─────────────────────────────────────────────────────────

- Credit limit is read-only in this UI — only the platform owner can raise it
  (future: /admin billing page).
- creditUsedUsd is read from the initial server render and is not refreshed
  live — accurate enough for an informational display.
- The API key password input uses type="password" so the browser never shows it
  in plain text; the value is only transmitted server-side over TLS.

34. PHASE 10 — SETTINGS/PROFILES REFACTOR & AI USAGE LOG (COMPLETE ✅)
    Build: clean (31 routes). `npm run build` passes with no lint or type errors.

─── Overview ─────────────────────────────────────────────────────────────────

Separated user profile management and AI administration into two distinct routes.
The former /settings page (profile + MFA) is now /profiles. The new /settings
page is an admin-only AI hub: enable/disable AI, configure provider and API key,
and review the full usage log.

─── Route changes ────────────────────────────────────────────────────────────

/profiles (was /settings — accessible to all authenticated users)

- src/app/(app)/profiles/page.tsx: server page rendering Photo, Profile form,
  and Security (MFA) sections. No AI card.
- src/app/(app)/profiles/actions.ts: updateOwnProfile() and updateAvatarUrl()
  server actions, revalidatePath('/profiles'). Stable path required because
  AvatarUpload (a shared client component) imports updateAvatarUrl directly.
- src/app/(app)/profiles/profile-form.tsx: client form for full_name / job_title
  / phone, imports from ./actions (relative to the profiles route).

/settings (new — admin only, redirects non-admins to /tasks)

- src/app/(app)/settings/page.tsx: server page with two sections:
  1. "AI Configuration" — renders AISettingsCard (existing component unchanged).
  2. "AI Usage Log" — server-rendered table of the last 100 ai_usage_logs rows.
     Columns: Date, User (name + email), Feature, Provider / Model, Tokens
     (input + output combined), Cost (USD 4 decimal places), Key (Platform /
     Own badge). Footer shows total cost and call count.
     max-w-3xl layout (wider than /profiles) to accommodate the table.
     Non-admin sessions are hard-redirected to /tasks before any data fetch.

─── New server action ────────────────────────────────────────────────────────

getAIUsageLogs(limit = 100) in src/lib/ai/ai-settings-actions.ts

- Admin-only auth gate (getSessionClaims()).
- Two parallel queries: ai_usage_logs (ordered desc by created_at, limit N)
  - users (id, full_name, email) for the same tenant.
- User name/email resolved via an in-memory Map keyed by user id — avoids the
  ambiguous PostgREST join on ai_usage_logs.user_id.
- Returns AIUsageLogEntry[]: { id, createdAt, userName, userEmail, feature,
  provider, model, inputTokens, outputTokens, costUsd, usingOwnKey }.

─── Navigation updates ───────────────────────────────────────────────────────

AvatarDropdown (src/components/shell/AvatarDropdown.tsx):

- Added role prop (string). "Settings" link replaced by two items:
  "Profile" (User icon) → /profiles for all users.
  "Settings" (Settings icon) → /settings for admins only (role === 'admin').

Topbar (src/components/shell/topbar.tsx):

- Passes role={role} to AvatarDropdown (role was already available as a prop).

nav-items.ts (src/components/shell/nav-items.ts):

- Settings icon imported from lucide-react.
- New nav item: { label: 'Settings', href: '/settings', icon: Settings,
  adminOnly: true, group: 'Settings' } — appears at the bottom of the sidebar
  under a "Settings" group label, admin-only.

─── Cleanup ──────────────────────────────────────────────────────────────────

- src/app/(app)/settings/actions.ts — deleted (profile actions moved to profiles/).
- src/app/(app)/settings/settings-form.tsx — deleted (profile form moved to profiles/).
- src/components/settings/AvatarUpload.tsx: import updated from
  @/app/(app)/settings/actions → @/app/(app)/profiles/actions.

─── KNOWN GOTCHA — stable import path for shared client components ───────────

AvatarUpload is a shared component under src/components/settings/ and imports
updateAvatarUrl directly. Per the CLAUDE.md architecture rule, server actions
imported by client components must live at a static, non-dynamic path. Both
/settings/actions.ts and /profiles/actions.ts satisfy this (neither is a dynamic
route). The import was updated to /profiles/actions.ts to match the new route.

35. PHASE 10 M3 — PLATFORM-OWNER AI USAGE DASHBOARD (COMPLETE ✅)
    Build: clean (32 routes). `npm run build` passes with no lint or type errors.

─── Overview ─────────────────────────────────────────────────────────────────

New admin route /admin/ai-usage giving the platform owner a cross-tenant view
of AI spend. Pure server component — no client state needed. Guarded by admin
role check (middleware already covers /admin prefix; re-checked in page).

Data is fetched via the service-role admin client so it spans all tenants.
Three parallel queries: tenants, tenant_ai_configs, ai_usage_logs. Aggregation
is done in JS using Map-based grouping (avoids PostgREST's lack of GROUP BY).

─── SECURITY FIX — Tenant isolation bug (post-M3) ───────────────────────────

Bug: /admin/ai-usage originally used createAdminClient() (bypasses RLS) with
no tenant filter. Any tenant admin could see every other tenant's usage data
in the "Per-Tenant Breakdown" table.

Root cause: getPlatformAIData() had no .eq('tenant_id', ...) clause and
getAIUsageLogs() was also called without a tenant scope, so the admin client
returned all rows from all tenants.

Fix: replaced with getTenantAIData(tenantId) — all three queries (configs,
logs, tenant row) are scoped with .eq('tenant_id', tenantId). tenantId is
derived from getSessionClaims() on the server; if claims.tenant_id is absent
the page hard-redirects to /tasks before any data fetch. The cross-tenant
"Per-Tenant Breakdown" table was removed from the tenant-scoped page.

The page now shows only the calling admin's own tenant: stat cards for
all-time spend, this-month spend, total calls, and credit used/BYOK status.
The feature breakdown and provider/model breakdown remain, filtered to the
tenant.

FEATURE_LABELS map updated to include text_assist: 'Text Assist' so the
feature column displays a readable label instead of the raw DB enum value.

─── Page layout ──────────────────────────────────────────────────────────────

src/app/(app)/admin/ai-usage/page.tsx (new, max-w-6xl)

Stat cards (4):

- All-time spend (sum of all ai_usage_logs.cost_usd across all tenants).
- This month's spend + platform-key sub-label (so the owner sees what they
  are personally paying vs. BYOK tenants paying their own provider).
- Total API calls (all time, all tenants).
- AI-enabled tenants count out of total tenants.

Per-Tenant Breakdown table:
Columns: Tenant | Plan | AI (On/Off badge) | Provider | Key (BYOK/Platform badge)
| Credit used/limit (progress bar, red ≥90%/amber ≥70%) | Calls
| This month cost | All-time cost (with inline MiniBar).
Rows sorted by tenant name. Tenants with AI off still appear (shows full
roster so owner knows who has not yet enabled the feature).

By Feature table (left half of bottom grid):
Columns: Feature | Calls | Cost | Share (MiniBar + %).
Sorted by cost descending. Footer row shows totals.

By Provider / Model table (right half of bottom grid):
Columns: Provider | Model (monospace) | Calls | Cost | Avg cost per call.
Sorted by cost descending.

─── Navigation ───────────────────────────────────────────────────────────────

nav-items.ts: Bot icon imported from lucide-react. New nav item:
{ label: 'AI Spend', href: '/admin/ai-usage', icon: Bot, adminOnly: true }
Inserted immediately after 'Audit Trail' in the admin section.

─── Design decisions ─────────────────────────────────────────────────────────

- Platform key vs BYOK: "This month" stat card sub-label shows platform-key
  portion so the owner knows their direct cost exposure immediately.
- Credit bar on per-tenant row matches the same red/amber/green thresholds as
  AISettingsCard (≥90% red, ≥70% amber) for visual consistency.
- MiniBar inline in the All-time column gives a relative-scale visual without
  needing a charting library.
- All cost values use fmt(): 4 decimal places when < $0.01, 2 decimal places
  otherwise — avoids "$0.00" for sub-cent AI calls.
- No date filter controls in this initial version — shows all-time data.
  "This month" is computed in JS using Date.now() at render time (UTC).

36. PHASE 10 M4 — AI GENERATE / REWRITE FOR LONG TEXT FIELDS (COMPLETE ✅)
    Build: clean (32 routes). Two commits on master (initial feature, preview-before-apply improvement).

─── Overview ─────────────────────────────────────────────────────────────────

Every Long Text (textarea) field in step forms now has an AI writing
assistant. The user types a plain-English instruction, sees the AI result
in a preview box, then explicitly chooses to apply or discard it — the
field value is never touched until the user clicks "Use this."

Two modes are detected automatically:

- Generate (field is empty): "Describe what to write…"
- Rewrite (field has content): "How should it be rewritten?"

After generation, a "Regenerate" button lets the user tweak the instruction
and try again without losing their original content.

─── Files ────────────────────────────────────────────────────────────────────

supabase/migrations/20260525210000_add_text_assist_feature.sql

- Drops and recreates the ai_usage_logs.feature CHECK constraint to include
  'text_assist' alongside the existing four feature values.

src/lib/ai/client.ts

- AIFeature union extended with 'text_assist'.

src/lib/ai/text-assist.ts (new — 'use server')

- assistTextarea({ fieldLabel, stepLabel, flowName?, instruction, currentText? })
- getSessionClaims() provides tenantId/userId — no need to pass from client.
- Two system prompts: GENERATE_SYSTEM_PROMPT (blank field) and
  REWRITE_SYSTEM_PROMPT (existing content). Both instruct the model to output
  only the field text with no preamble.
- Calls callAI() with feature 'text_assist', maxTokens 1024.
- Returns { text: string | null, error: string | null }.

src/components/canvas/StepFormModal.tsx and TaskDetailModal.tsx

- TextareaWithAI component added to both files (mirrors the existing
  duplicate-FieldRenderer pattern documented in §24).
- State machine: idle → prompt input → AI preview → accept / discard.
  aiPreview: string | null holds the pending suggestion; onChange() is only
  called on explicit "Use this" click.
- Button label changes to "Regenerate" when a preview is already showing,
  so the user can refine without dismissing.
- FieldRenderer gains stepLabel: string and flowName?: string props, threaded
  to TextareaWithAI for richer AI context.
- StepFormModal gains optional flowName? prop.

src/app/(app)/my-flows/[id]/instance-detail-client.tsx

- Passes flowName={detail.flow_name} to StepFormModal so the AI has full
  workflow context (flow name + step name + field label).

─── KNOWN GOTCHA — duplicate TextareaWithAI ──────────────────────────────────

TextareaWithAI is defined independently in both StepFormModal.tsx and
TaskDetailModal.tsx, matching the existing duplicate-FieldRenderer pattern.
Any change to the component must be applied to both files.

─── Usage logging ────────────────────────────────────────────────────────────

Each assistTextarea() call is logged to ai_usage_logs with feature='text_assist'.
It appears in the tenant's /settings usage table and the platform's
/admin/ai-usage spend dashboard under the "text_assist" feature row.

37. PHASE 10 M5 — PER-PROVIDER MODEL SELECTION (COMPLETE ✅)
    Build: clean (32 routes). Committed on master (commit 7e2581f).

─── Overview ─────────────────────────────────────────────────────────────────

Tenant admins can now choose a specific AI model within their selected
provider. When AI is enabled and a provider is selected, a radio-button list
of available models appears (e.g. Haiku 4.5 / Sonnet 4.6 / Opus 4.7 for
Anthropic). Exactly one model is active at a time. callAI() reads the stored
model from the DB for every call — no longer hardcodes a default.

─── Database ─────────────────────────────────────────────────────────────────

supabase/migrations/20260525220000_add_model_to_ai_config.sql

ALTER TABLE public.tenant_ai_configs
ADD COLUMN IF NOT EXISTS model text NOT NULL DEFAULT 'claude-sonnet-4-6';

Applied to remote DB via Supabase MCP.

─── Files ────────────────────────────────────────────────────────────────────

src/lib/ai/pricing.ts

- ModelInfo interface: { id, name, description, pricing }.
- MODELS_BY_PROVIDER: catalog of available models per provider with human-
  readable names, capability descriptions, and short pricing strings.
  anthropic: Haiku 4.5 / Sonnet 4.6 / Opus 4.7
  openai: GPT-4o mini / GPT-4o

src/lib/ai/ai-settings-actions.ts

- AISettingsData gains model: string field.
- getAISettings(): selects model from DB. Validates the stored model against
  MODELS_BY_PROVIDER[provider]; falls back to DEFAULT_MODEL[provider] if the
  stored model is not valid for the current provider (guards against stale data
  after a provider switch).
- updateAISettings(): now accepts model?: string and patches the model column.

src/lib/ai/client.ts

- TenantAIConfig gains model: string | null.
- model column added to the tenant_ai_configs SELECT.
- Model resolution: cfg.model ?? DEFAULT_MODEL[provider] ?? DEFAULT_MODEL['anthropic'].

src/components/settings/AISettingsCard.tsx

- model state initialized from initial.model.
- handleProviderChange(p): resets model to DEFAULT_MODEL[p] and persists both
  provider and model in a single updateAISettings() call (atomic provider swap).
- handleModelChange(m): optimistic update with revert on error.
- Model list UI: bordered divided list of radio buttons below the provider
  select. Each row: radio + model name + description (flex-1) + pricing string
  (right-aligned). Selected row has bg-primary/5 tint.
- availableModels = MODELS_BY_PROVIDER[provider] ?? [].

src/app/(app)/settings/page.tsx

- defaultAISettings fallback object gains model: 'claude-sonnet-4-6' to match
  the updated AISettingsData type.

─── Design decisions ─────────────────────────────────────────────────────────

- Single model active at a time: the UI uses radio buttons, not checkboxes.
- Provider switch atomically resets model so there is never a mismatch between
  provider and model stored in the DB.
- Validation in getAISettings() means a legacy row (no model column, defaulted
  to claude-sonnet-4-6 by the migration) is always returned with a valid model
  even if the tenant was previously on OpenAI.

38. PHASE 11 — ANALYTICS & REPORTING (COMPLETE ✅)
    Theme: turn the workflow data that already exists in the DB into actionable
    intelligence for tenant admins. Zero new infrastructure required — all data
    is captured in flow_instances, step_instances, ai_usage_logs, and audit_log.
    Pure server-side JS aggregation (Map-based), consistent with the pattern in
    /dashboard and /admin/ai-usage. No charting library needed for MVP.

M1 — Flow Performance Report ✅ COMPLETE

New route /admin/reports/flows (admin only). Per-flow stat table with avg cycle
time, completion/cancellation/error rates, period selector (7d/30d/90d/all),
step-level bottleneck breakdown (expandable, sorted by median wait time desc).

M2 — SLA Adherence Report ✅ COMPLETE

New route /admin/reports/sla (admin only). Per-flow SLA summary with on-time /
breached / overdue counts, breach rate colour coding (red >20% / amber >10%),
per-step breakdown, escalation effectiveness analysis, CSV export.

M4 — Executive Dashboard Enhancement ✅ COMPLETE

/dashboard upgraded with period selector (7d/month/30d/90d), period-over-period
deltas on Triggered/Completed/Cancelled stat cards, inline sparklines on the
bottleneck table. Fixed pre-existing bug where SLA Breached and Due Soon always
showed 0.

─────────────────────────────────────────────────────────────────────────────────

39. PHASE 12 — LANDING PAGE & MULTI-TENANCY / BILLING (ROADMAP)
    Theme: public-facing marketing site + self-service tenant signup + plan
    enforcement. Splits into two sub-tracks: 12-A (Landing Page) ships first
    so prospects can discover and register; 12-B (Billing & Enforcement) wires
    up Stripe and hard limits afterwards.

PLAN TIERS (all limits must be configurable via platform admin panel — no
hard-coded numbers in business logic; values stored in DB config):

Free — $0 / month
· 10 users (incl. admin)
· 2 flows
· 5 departments
· Reports: 7-day window only
· No AI in flow builder
· AI usage cap: $1 all-time (no monthly reset)

Pro — $5 / user / month (max 100 users)
· Unlimited flows & departments
· All report periods (7d / 30d / 90d / all-time)
· AI in flow builder enabled
· AI monthly credit cap: $50 / month ← internal only, NOT shown
to tenants on pricing page or settings UI
· Monthly AI credit resets on billing cycle date

Enterprise — Contact us (custom contract)
· Everything in Pro, no user-count ceiling
· AI credit limit configured per-tenant by platform admin
· Dedicated support / custom SLA

CONFIGURABILITY REQUIREMENT:
Every numeric limit (user cap, flow cap, dept cap, report window days, AI
credit limit, price per seat) must be readable from a DB config table —
NOT hard-coded in source. A platform admin panel (Phase 12-B or later) will
expose CRUD for these values so they can change without a redeploy.

─── PHASE 12-A: LANDING PAGE ────────────────────────────────────────────────

M1 — Marketing homepage at /

Replace the current redirect-only page.tsx with a full landing page.
Add / and /signup to PUBLIC_ROUTES in middleware.ts. Logged-in visitors
are still redirected to /tasks. Sections: sticky navbar (logo, Features,
Pricing, FAQ anchors + Log in + Get Started CTA), hero (headline +
"Your AI workflow magic" subheadline + Start Free / Log In buttons),
6-feature grid (Flow Builder, AI Integration, SLA Tracking, Analytics,
Department Management, Audit Trail), footer (links + copyright).

M2 — Pricing section on the landing page

3-column pricing table (Free / Pro / Enterprise) with per-tier feature
checklist. "Get Started" → /signup, "Contact Us" → mailto. Pricing data
lives in a static config constant (src/lib/plans.ts) so numbers are in
one place and easy to edit before the platform admin panel is built.
Pro AI cap is NOT listed — only surfaced as "AI-powered flow builder ✓".

M3 — /signup page (self-service tenant registration)

Public page: email + password fields only. On submit via server action: 1. createAdminClient().auth.admin.createUser() with email_confirm: true 2. INSERT into tenants (name = 'My Organization', plan = 'free') 3. INSERT into users (id, tenant_id, email, role = 'admin') 4. auth.admin.updateUserById() → set app_metadata { tenant_id, role } 5. Sign the user in and redirect to /tasks
Error states: email already in use, weak password, server error.

M4 — FAQ section + final polish

5–6 collapsible FAQ items (accordion, no JS library needed — details/summary
or Radix Collapsible). Mobile responsive throughout. Smooth-scroll anchors.
OG meta tags (title, description, og:image placeholder) in layout.

─── PHASE 12-B: BILLING & PLAN ENFORCEMENT ──────────────────────────────────

M5 — Plan config DB table + limits helper

Migration: create plan_configs table —
plan TEXT PRIMARY KEY,
max_users INT,
max_flows INT,
max_departments INT,
report_window_days INT, -- NULL = unlimited
ai_enabled BOOLEAN,
ai_credit_limit_usd NUMERIC, -- NULL = unlimited; monthly for pro
ai_credit_reset TEXT, -- 'monthly' | 'never' | 'none'
price_per_user_cents INT, -- 0 for free/enterprise
updated_at TIMESTAMPTZ
Seed with Free / Pro / Enterprise rows matching the plan tiers above.
Helper getLimits(plan): reads from this table (cached, 60s TTL).

Also add to tenants table:
status TEXT CHECK IN ('active','trial','suspended') DEFAULT 'active'
trial_ends_at TIMESTAMPTZ
stripe_customer_id TEXT
stripe_subscription_id TEXT
current_period_start TIMESTAMPTZ -- for monthly AI credit reset

M6 — Usage enforcement gates

Check limits before: invite user (user cap), create flow (flow cap),
create department (dept cap), trigger AI (ai_enabled + credit cap).
Reports period selector: hide 30d/90d/all-time tabs for free tenants
(replace with upgrade prompt).
UI: inline "You've reached your Free plan limit — upgrade to Pro" banner,
not a generic error page.

M7 — Stripe checkout + webhook

/api/billing/create-checkout — POST, creates Stripe Checkout session for
Pro upgrade (quantity = current active user count).
/api/billing/webhook — POST, handles:
customer.subscription.created → set plan='pro', status='active'
customer.subscription.updated → update plan/status
customer.subscription.deleted → downgrade to plan='free'
/api/billing/portal — GET, creates Stripe Customer Portal session.
Env vars: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRO_PRICE_ID.

M8 — Billing tab in /settings

New "Billing" tab (admin only). Shows: current plan badge, usage meters
(users X/10, flows X/2 for free), upgrade CTA → Stripe checkout, or
"Manage billing" → Stripe portal for Pro. Enterprise shows "Managed plan".

M9 — Platform admin panel /platform

Separate from /admin (tenant-scoped). Accessible only to a designated
platform-owner account (checked via hardcoded email env var or a
platform_admin boolean in app_metadata).
Routes:
/platform/tenants — table of all tenants: name, plan, status, users,
created_at, MRR contribution. Manual plan/status override.
/platform/plan-config — CRUD editor for plan_configs table: edit any
limit or price without a redeploy.
/platform/ai-overrides — per-enterprise-tenant AI credit limit editor.

CROSS-CUTTING NOTES

- plan_configs is the single source of truth for all limits. getLimits()
  is called at enforcement points, never inline constants.
- Pro AI monthly credit ($50) resets on current_period_start + 30 days,
  tracked via tenant_ai_configs.credit_used_usd (reset to 0 on cycle).
- Enterprise ai_credit_limit_usd is stored in tenant_ai_configs directly
  (overrides plan_configs default) — set by platform admin.
- Pricing page never mentions AI dollar amounts — only feature availability.
- Recommended build order: M1 → M2 → M3 → M4 → M5 → M6 → M7 → M8 → M9.

40. PHASE 12-B — BILLING & PLAN ENFORCEMENT (COMPLETE ✅, M7 DEFERRED)
    Build: clean. M5, M6, M8, M9 committed (commit 2af2b15). M7 (Stripe) explicitly
    deferred — Stripe does not support Vietnam as a payout country. Upgrade buttons
    show "Payment coming soon" state in the UI until a legal entity in a supported
    country is established (Stripe Atlas / Singapore incorporation).

M5 — Plan config DB table + limits helper ✅ COMPLETE

    supabase/migrations/20260526100000_plan_configs_and_tenant_billing.sql:

    - plan_configs table: plan TEXT PK, max_users INT, max_flows INT,
      max_departments INT, report_window_days INT, ai_enabled BOOL,
      ai_credit_limit_usd NUMERIC(10,4), ai_credit_reset TEXT, price_per_user_cents INT,
      updated_at TIMESTAMPTZ. RLS: SELECT for authenticated (any role).
    - Seeded with three rows: free (10/2/5/7d/false/$1/never/$0),
      pro (100/∞/∞/∞/true/$50/monthly/$500/user), enterprise (∞/∞/∞/∞/true/∞/none/custom).
    - ALTER TABLE tenants ADD COLUMN IF NOT EXISTS: status TEXT DEFAULT 'active'
      CHECK (active|trial|suspended), trial_ends_at TIMESTAMPTZ,
      stripe_customer_id TEXT, stripe_subscription_id TEXT,
      current_period_start TIMESTAMPTZ.

    src/lib/billing/limits.ts:

    - PlanLimits type: { maxUsers, maxFlows, maxDepartments, reportWindowDays,
      aiEnabled, aiCreditLimitUsd, aiCreditReset, pricePerUserCents } — all
      nullable numeric fields use number | null (null = unlimited).
    - FREE_FALLBACK: safe static fallback used if DB read fails.
    - getLimits(plan): unstable_cache wrapper (60s TTL, tag 'plan-limits').
      Reads from plan_configs; returns FREE_FALLBACK on error.
    - getTenantLimits(tenantId): fetches tenant.plan → calls getLimits(plan).

    CONFIGURABILITY REQUIREMENT SATISFIED: no numeric limits are hard-coded
    in business logic. All enforcement points call getTenantLimits() at runtime.
    revalidateTag('plan-limits') is called after any plan_configs mutation to
    bust the cache within the 60s TTL.

M6 — Usage enforcement gates ✅ COMPLETE

    Invite (src/app/(app)/invite/actions.ts):
    - inviteUser(): counts existing users, compares to limits.maxUsers, returns
      { success: false, error: "plan limit" } if at cap.
    - bulkImportUsers(): counts remaining slots, trims the batch to fit (partial
      success allowed) or returns error if already at cap.

    Flows (src/app/(app)/flows/flows-route-actions.ts):
    - createFlow(): counts existing flows, throws an Error if at limits.maxFlows.

    Departments (src/app/(app)/departments/actions.ts):
    - createDepartment(): counts existing depts, returns { error: "..." } if at
      limits.maxDepartments.

    AI (src/lib/ai/client.ts):
    - callAI(): plan-level gate added at top — if !planLimits.aiEnabled throws
      "AI features are not available on the Free plan. Upgrade to Pro."

    Reports — period selector lock (both /admin/reports/flows and /admin/reports/sla):
    - Server page fetches getTenantLimits() → derives maxDays (reportWindowDays).
    - isAllowed(period): caps the selected period to maxDays.
    - Default period is forced to '7' when tenant is restricted.
    - Both client components (flows-report-client.tsx, sla-report-client.tsx) accept
      maxDays: number | null prop; locked tabs render with Lock icon + 50% opacity +
      cursor-not-allowed + upgrade prompt below the tab bar.

M7 — Stripe checkout + webhook ⏭ DEFERRED

    Explicitly skipped. Stripe does not support Vietnam as a payout country.
    Required setup when ready: Stripe Atlas or Singapore legal entity.
    Env vars needed: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRO_PRICE_ID.

M8 — Billing tab in /settings ✅ COMPLETE

    src/app/(app)/settings/page.tsx rewritten with two tabs:
    - Tab navigation via ?tab=ai (default) / ?tab=billing — Link-based, server-rendered.
    - "Billing" tab fetches tenant plan/status, user/flow/dept counts, getTenantLimits().

    UsageMeter component: progress bar (indigo → amber ≥70% → red ≥90%) for capped
    resources; "Unlimited" text when max is null.

    Billing tab content:
    - Plan badge (PLAN_BADGE record: free/pro/enterprise colour classes).
    - Usage meters: Users (X/max), Flows (X/max), Departments (X/max).
    - Report history: plain text ("7 days" or "Unlimited") — not a progress meter.
    - Upgrade CTA button (disabled, "Payment coming soon" — M7 deferred).
    - Pro / Enterprise info cards.

    "AI" tab is unchanged: AISettingsCard + AI Usage Log table.

    TypeScript fix: conditional Promise.all that returned a union type was replaced
    with explicit if block + typed variable declarations:
      let aiSettings: Awaited<ReturnType<typeof getAISettings>>['data'] = null
      let usageLogs: AIUsageLogEntry[] = []
      if (tab === 'ai') { ... }

M9 — Platform admin panel /platform ✅ COMPLETE

    Middleware guard (src/middleware.ts):
    - PLATFORM_ROUTES = ['/platform'], isPlatformRoute() helper.
    - Step 4: if email !== PLATFORM_ADMIN_EMAIL → redirect /unauthorized.
    - .env.local: PLATFORM_ADMIN_EMAIL=ducnv.hn@gmail.com

    Server actions double-check assertPlatformAdmin() as defense-in-depth
    (server actions can be called independently of middleware).

    Layout (src/app/platform/layout.tsx):
    - Completely separate from the (app) shell — no sidebar, no Topbar.
    - Sticky top bar: "Platform Admin" branding, nav to 3 pages, user email right-aligned.
    - Uses getSessionClaims() + redirect('/login') if no session.

    /platform/page.tsx → redirect to /platform/tenants.

    /platform/tenants (src/app/platform/tenants/page.tsx):
    - Table of all tenants: name (+ truncated ID), plan badge, status badge,
      user count, MRR ($5 × users for pro plan), created date.
    - Total MRR in header.
    - Inline plan override form (select + "Set plan" button) per row.
    - Inline status override form (select + "Set status" button) per row.
    - actions.ts: updateTenantPlan(), updateTenantStatus() — both call
      assertPlatformAdmin(), use createAdminClient(), revalidatePath + revalidateTag('plan-limits').

    /platform/plan-config (src/app/platform/plan-config/page.tsx):
    - NullableInput component: blank = unlimited, placeholder "∞".
    - 3 cards (free / pro / enterprise), each a form with all 8 limit fields,
      per-card Save button, last-updated timestamp.
    - actions.ts: updatePlanConfig(fd: FormData) — parses nullable ints/floats
      (nullableInt, nullableFloat helpers), updates plan_configs, revalidates
      path + plan-limits tag.

    /platform/ai-overrides (src/app/platform/ai-overrides/page.tsx):
    - Shows enterprise tenants only (joined with tenant_ai_configs).
    - Columns: tenant name, AI enabled badge, credit used / limit, editable
      credit_limit_usd input.
    - actions.ts: updateAIOverride(fd: FormData) — upserts tenant_ai_configs
      on tenant_id conflict.

KNOWN GOTCHA — PowerShell git heredocs with (app) in paths:
Paths containing (app) are parsed as PowerShell subexpressions when unquoted.
Always quote staging paths: git add -- "src/app/(app)/..."

41. PHASE 13 — PRODUCTION HARDENING (COMPLETE ✅)
    Theme: close gaps that real users will hit before onboarding. No new features —
    purely stability, security, and operational visibility.
    Build: clean throughout. All commits on master.

M1 — Error pages ✅ COMPLETE (commit fa53113)

    Created/fixed:
    - src/app/not-found.tsx: global 404 for routes outside (app) shell (login,
      platform, signup, etc.). Two CTAs: "Go home" + "Go to app".
    - src/app/error.tsx: global error boundary with error digest ID shown for
      debugging. "Try again" + "Go to app" buttons.
    - src/app/global-error.tsx: catches crashes in the root layout itself. Uses
      inline styles (Tailwind not available at root layout level).
    - src/app/unauthorized/page.tsx: rewritten with ShieldX icon, consistent
      styling, fixed stale /dashboard link → /tasks, "Sign in with different
      account" CTA.
    - src/app/(app)/not-found.tsx: fixed stale /dashboard link → /tasks.

    KNOWN GOTCHA — global-error.tsx must include its own <html> and <body> tags
    because it replaces the root layout entirely when the root layout itself crashes.
    Tailwind classes are unavailable there — use inline styles.

M2 — Vercel env var audit ✅ COMPLETE (commit 19011b7)

    - .env.example created: documents all required env vars with generation
      instructions, production vs local guidance, and "do NOT set in production"
      notes for dev-only vars.
    - .env.local fixed: RESEND_FROM_EMAIL corrected to noreply@aitomicflow.com
      (was onboarding@resend.dev); CRON_SECRET generated and added.

    Vercel production vars required:
      NEXT_PUBLIC_SITE_URL=https://aitomicflow.com
      RESEND_FROM_EMAIL=noreply@aitomicflow.com
      CRON_SECRET=<64-char hex, copy from .env.local>
      NEXT_PUBLIC_SENTRY_DSN=<from sentry.io>
      SENTRY_AUTH_TOKEN=<optional, for readable stack traces>
      + all others matching .env.local values

M3 — Rate limiting on public endpoints ✅ COMPLETE (commits 61db32d, f2693be)

    Initially implemented with Upstash Redis, then replaced with Supabase-based
    approach (no new service required).

    src/lib/rate-limit.ts:
    - checkSignupRate(ip): 5 signups/hour/IP via rate_limit_log table.
      logAttempt() self-cleans rows older than 2h on every write.
    - checkInviteRate(tenantId): 30 invitations/hour/tenant — reads directly
      from pending_invitations table (count rows in last hour), no extra writes.

    Migration 20260526200000_add_rate_limit_log.sql:
    - rate_limit_log(key TEXT, created_at TIMESTAMPTZ) with index on (key, created_at).
      No RLS — service-role only. Self-cleaning via logAttempt() deletes on write.

    Honeypot field added to src/app/signup/page.tsx:
    - Hidden input (position: absolute, off-screen) named "website".
    - If populated (by bots), createTenantAccount() returns { success: true }
      silently without creating any account.

    Enforcement points:
    - signup-actions.ts: honeypot check → IP rate limit → proceed.
    - invite/actions.ts: tenant rate limit in inviteUser() before email is sent.
    - Login: untouched — Supabase Auth handles login rate limiting natively.

    KNOWN GOTCHA — Supabase rate limiter has a small race window (non-atomic
    check-then-insert). Under normal traffic this is acceptable. If abuse is
    observed in production, replace with Upstash Redis (one-file change in
    rate-limit.ts) for atomic sliding-window counters.

M4 — Sentry error monitoring ✅ COMPLETE (commit b92e3a0)

    - sentry.client.config.ts: client-side init, disabled in development,
      10% traces sample rate, 5% session replay, 100% replay on error.
    - sentry.server.config.ts: server-side init, 10% traces.
    - sentry.edge.config.ts: edge runtime init, 10% traces.
    - src/instrumentation.ts: Next.js instrumentation hook — registers server
      or edge Sentry config based on NEXT_RUNTIME env var.
    - next.config.mjs: wrapped with withSentryConfig (silent build output,
      source map upload, hideSourceMaps, disableLogger for smaller bundle).
    - NEXT_PUBLIC_SENTRY_DSN: empty in .env.local (Sentry inactive locally),
      must be set in Vercel for production error capture.

    KNOWN GOTCHA — Sentry adds ~110KB to the shared JS bundle (includes replay
    integration). If bundle size becomes a concern, remove the replayIntegration()
    from sentry.client.config.ts and drop replaysSessionSampleRate/
    replaysOnErrorSampleRate.

42. PHASE 14 — SECURITY ASSESSMENT (COMPLETE ✅)

    Full automated security review of the entire codebase using a multi-agent
    approach: one agent identified 21 candidate findings; three parallel agents
    applied false-positive filtering; findings below confidence 8/10 were dropped.

─── Assessment Result ────────────────────────────────────────────────────────

    NO high-confidence (≥8/10) exploitable vulnerabilities found.

    Key items confirmed as FALSE POSITIVES (with reasoning):
    - Platform admin actions (plan/status/ai-override): all gated by
      assertPlatformAdmin() + PostgREST parameterized queries; unrecognized
      plan values fall back to FREE_FALLBACK (most restrictive).
    - callAI() caller-supplied tenantId/userId: all call sites (flow-builder,
      form-suggestions, condition-parser, trigger-assistant, text-assist) derive
      tenantId/userId from getSessionClaims(), never from user input.
    - Role claim from getSession() JWT: getUser() already server-validates the
      token; forged JWTs impossible without the server-side signing secret.
    - avatar_url without URL validation: no server-side fetch of the URL (no
      SSRF); no dangerouslySetInnerHTML anywhere in codebase (no XSS).
    - Cron cross-tenant step_instances fetch: intentional system-wide background
      job; per-assignee digest emails never mix tenant data.

─── Defense-in-depth fixes applied (commit b1d96e1) ─────────────────────────

    1. invite/actions.ts — inviteUser() duplicate-email check:
       Replaced createClient() (RLS-scoped, no explicit tenant filter) with
       adminClient + .eq('tenant_id', claims.tenant_id).maybeSingle().
       Matches the correct pattern already used in bulkImportUsers().
       Removed now-unused createClient import.

    2. users/actions.ts — getUsersDeleteImpact():
       Added tenant membership pre-validation: fetches valid user IDs scoped to
       claims.tenant_id before running the four impact count queries. All four
       queries now use validIds instead of raw caller-supplied userIds.
       Mirrors the validation pattern in deleteUsers().

    3. api/test/tenant-isolation/route.ts:
       Added claims.role !== 'admin' check alongside existing NODE_ENV guard.
       Non-admin authenticated users now receive 403 instead of being able to
       run the isolation test and view hardcoded fixture tenant UUIDs.

─── What is working well (security positives) ────────────────────────────────

    - All platform admin server actions double-gated: middleware + assertPlatformAdmin()
    - All AI call sites derive tenantId/userId from getSessionClaims() only
    - Admin client writes always include explicit tenant_id filters
    - AES-256-GCM for BYOK key encryption (authenticated, tamper-evident)
    - JWT role claims server-signed; cannot be forged without Supabase secret
    - No dangerouslySetInnerHTML anywhere in the codebase
    - Rate limiting on signup (honeypot + DB counter) and invite (pending_invitations)
    - CRON_SECRET guards SLA cron route correctly
    - Proper error/unauthorized pages — no raw Next.js error screens exposed

─── Recommended next steps for Option C ─────────────────────────────────────

    - Snyk: npx snyk test — scans package.json for CVEs in dependencies
    - GitHub Dependabot: Repo Settings → Security → Dependabot alerts → Enable

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
POST-SECURITY — INVITE FLOW & SETTINGS FIXES (2026-05-26)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

── Settings: Organisation Name ───────────────────────────────────────────────

Added a "General" tab to /settings (now the default tab) where tenant admins
can rename their organisation. Server action updateTenantName() validates and
updates tenants.name via the admin client, then revalidates the page.

New files: src/lib/settings/tenant-actions.ts
src/components/settings/TenantNameForm.tsx

── Invite Flow: Email Not Sending (Vercel) ───────────────────────────────────

All three sendInviteEmail() call sites (inviteUser, bulkImportUsers,
resendInvitation) used void (fire-and-forget). On Vercel serverless, the
Lambda terminates when the server action returns, killing the HTTP call to
Resend before it leaves the process. Fixed by awaiting all three calls.
Nothing appeared in the Resend dashboard because the request never reached it.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE 17 M1 — ONBOARDING & ACTIVATION (2026-05-28)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Goal: guide new tenants from signup to their first published flow with minimal
friction — admin checklist, user tour, sample data, and a richer welcome email.

── DB: user_onboarding table ─────────────────────────────────────────────────

Migration: supabase/migrations/20260528120000_user_onboarding.sql

user_onboarding (
id uuid PK,
user_id uuid → auth.users CASCADE,
step_key text,
completed_at timestamptz DEFAULT now(),
UNIQUE (user_id, step_key)
)

RLS: users can only read/insert their own rows. Admin client bypasses RLS for
server-side reads (checklist state, layout fetch).

step_key values in use:
tour_completed — user clicked Done on the tooltip tour
checklist_dismissed — admin dismissed the setup checklist card

── Admin Setup Checklist ─────────────────────────────────────────────────────

Component: src/components/onboarding/AdminChecklist.tsx
Actions: src/lib/onboarding/actions.ts → getAdminChecklistState()

Shown on /tasks for admins only. 5 steps passively derived from live DB counts
(no explicit "mark done" — state reflects reality):

1. Create your first flow (flows count > 0)
2. Publish a flow (flows where status='published' > 0)
3. Invite a team member (users in tenant excluding self > 0)
4. Set up a department (departments count > 0)
5. Enable AI features (tenant_ai_configs row exists)

Features:

- Progress bar (completed/total)
- Collapse/expand toggle
- Dismiss button → marks step_key='checklist_dismissed' in user_onboarding
- Dismissed state is optimistic (instant hide) then server-persisted

── User Tooltip Tour ─────────────────────────────────────────────────────────

Component: src/components/onboarding/TourProvider.tsx

Architecture:

- TourContext (startTour, active) shared via React context
- TourProvider wraps the entire app layout (server passes role + completedStepKeys)
- Tour overlay rendered via React.createPortal to document.body
- CSS box-shadow spotlight: 0 0 0 9999px rgba(0,0,0,0.55) around target element
- Target lookup: document.querySelector('[data-tour="<key>"]')
- Rect updates on resize and scroll for accurate spotlight positioning

Auto-start rules:

- Non-admins: auto-starts 800ms after first login if 'tour_completed' not in DB
- Admins: manual only (triggered from "Take the tour" in avatar dropdown)
- Completion marks step_key='tour_completed' in user_onboarding

Tour steps (non-admin):

1. data-tour="task-list" — Pending Tasks tab button
2. data-tour="nav-start-flow" — Start a Flow nav link (sidebar)
3. data-tour="my-flows-tab" — My Flows tab button

Tour steps (admin):

1. data-tour="task-list" — Pending Tasks tab button
2. data-tour="nav-flow-builder" — Flow Builder nav link (sidebar)
3. data-tour="nav-invite" — Invite nav link (sidebar)

"Take the tour" entry added to AvatarDropdown (all roles, always visible).
Uses useTour() hook to call startTour().

── Sample Flow Preload ────────────────────────────────────────────────────────

File: src/lib/onboarding/sample-flow.ts

Called from signup-actions.ts after step 4 (app_metadata stamped).
Finds the "Leave Request" template (ilike match, is_published=true), clones it
as a draft named "<name> (Sample)" with scrubbed tenant-specific assignee rules.
Non-fatal — wrapped in try/catch so signup never fails if template is missing.

── Welcome Email ─────────────────────────────────────────────────────────────

Updated: src/lib/auth/signup-actions.ts → buildConfirmationEmail()

Subject: "Confirm your DragFlow account" (unchanged)
New content: 4-step numbered getting-started guide below the CTA button:

1. Confirm your email (the CTA itself)
2. Explore the sample Leave Request flow in Flow Builder
3. Invite team members from the Invite page
4. Publish a flow and let the team start submitting

── Wire-up changes ───────────────────────────────────────────────────────────

src/app/(app)/layout.tsx

- Fetches getOnboardingSteps(user.id) → completedStepKeys
- Wraps layout in <TourProvider role completedStepKeys>

src/app/(app)/tasks/page.tsx

- Fetches getAdminChecklistState() in parallel (admins only)
- Passes adminChecklist to TasksClient

src/app/(app)/tasks/tasks-client.tsx

- Renders <AdminChecklist> above tabs when state provided and not dismissed
- TabButton accepts optional tourKey → data-tour attribute
- Pending Tasks tab: data-tour="task-list"
- My Flows tab: data-tour="my-flows-tab"

src/components/shell/nav-items.ts

- NavItem interface gains optional tourKey field
- Start a Flow: tourKey="nav-start-flow"
- Flow Builder: tourKey="nav-flow-builder"
- Invite: tourKey="nav-invite"

src/components/shell/sidebar.tsx

- Link renders data-tour={item.tourKey} when present

src/components/shell/AvatarDropdown.tsx

- Imports useTour from TourProvider
- New "Take the tour" menu item (MapPin icon) calls startTour()

── Commit ────────────────────────────────────────────────────────────────────

69bc819 feat(onboarding): Phase 17 M1 — tenant onboarding & activation

── Bug Fix: Tour Auto-Start Skipped for Invited Users ───────────────────────

Symptom: newly invited users completed account setup, were redirected to
/tasks, but the tooltip tour never appeared.

Root cause: TourProvider mounts once in the (app) layout and persists across
client-side navigations. The auto-start useEffect fired while the user was
still on /account-setup — where data-tour elements do not exist. Because the
effect ran and set autoStarted.current = true, by the time the user reached
/tasks the guard had already fired. stepIndex was 0 but the rect-lookup effect
only re-runs when stepIndex changes, so rect stayed null and the portal
rendered nothing.

Fix: added usePathname() to TourProvider.tsx. The auto-start effect now
returns early unless pathname === '/tasks'. pathname added to the effect
dependency array so it re-evaluates on every client-side navigation.

File changed: src/components/onboarding/TourProvider.tsx

Commit: b8f6437 fix(onboarding): gate tour auto-start on /tasks pathname

── Production Migrations Applied (2026-05-28) ───────────────────────────────

All three migrations applied to production project qdngvdffqsnqikqbhkmw
(workflow-saas, ap-southeast-1) via Supabase MCP:

1. 20260528120000_user_onboarding — creates user_onboarding table with RLS
   policies (user can select/insert own rows) and user_id index.

2. 20260415093000_knowledge_base_seed — 22 English help-center articles
   across 8 categories (Getting Started, Flows, Tasks, Users, Departments,
   Reports, Settings, AI Features). 5 updated, 17 inserted on first run.

3. 20260415094000_knowledge_base_vietnamese — 27 Vietnamese translations
   covering the same article set (slug suffix -vi).

── Invite Flow: Pending Users Leaking Into App ───────────────────────────────

Root cause: invited users were created with is_active=true (DB default),
making them indistinguishable from active members.

Fixes applied:

1. Invited users now created with is_active=false in both inviteUser() and
   bulkImportUsers(). The resolve-assignee edge function already filters
   by is_active=true, so pending invitees are automatically excluded from
   step assignment and manager dropdowns.

2. New server action markInvitationAccepted() in src/lib/auth/invitation-actions.ts
   — called at the end of account-setup-form.tsx after the user saves their
   name and password. Sets is_active=true and pending_invitations.status='accepted'.

3. getPendingInvitations() now filters .eq('status','pending') instead of
   .neq('status','revoked'), so accepted invitations no longer appear in
   the pending list.

4. Org chart query now filters .eq('is_active', true) — pending invitees
   are excluded until they complete setup.

5. Users list distinguishes pending (is_active=false + no full_name → amber
   "Pending" badge) from deliberately deactivated (is_active=false + has
   name → grey "Inactive" badge).

── Pending Tasks: slide-in panel instead of modal ───────────────────────────

Previously, clicking a pending task opened `TaskDetailModal` — a centered
dialog with a step form but no comments, activity log, or full instance detail.

Changed to open the same right-side `InstanceDetailClient` slide-in panel
already used by the My Flows and History tabs. The pending tab "Open" button
now calls `openPanel(task.instanceId)` directly. The panel already handles
step form submission for the assigned user so no functionality was lost.
`TaskDetailModal`, `loadingTaskId`, `openTask`, `closeModal`, and
`handleSubmitted` were removed from `tasks-client.tsx` (net −96 lines).

Commit: ba97e59 feat(tasks): open pending flow in slide-in panel instead of modal

── /my-flows route removed — unified into /tasks ────────────────────────────

The `/my-flows` standalone pages had no sidebar nav link and were the only
destination that bypassed the slide-in panel UX (they rendered
InstanceDetailClient as a full page). Notification links and email links both
pointed to `/my-flows/${instanceId}`, causing a jarring context switch.

Changes (commit ac6249c):

- `/tasks` page now reads the `?open` query param (from `searchParams`) and
  passes `initialInstanceId` to `TasksClient`. On mount, `TasksClient` calls
  `openPanel(initialInstanceId)` so the slide-in panel opens automatically.
- All notification link generators updated to `/tasks?open=${instanceId}`:
  `comment-actions.ts`, `actions.ts` (×2 — flow_completed paths),
  `email/templates.ts` (completion email CTA).
- `flows-client.tsx` post-trigger redirect updated to `/tasks?open=${instanceId}`.
- `instance-detail-client.tsx` back links (top + bottom) simplified to `/tasks`
  ("My Tasks") for both triggerer and assignee roles.
- `/my-flows/[id]/page.tsx` converted to a thin redirect:
  `redirect(\`/tasks?open=${id}\`)` — old email links and bookmarks still work.
- `/my-flows/page.tsx` converted to `redirect('/tasks')`.

Old email links and bookmarks continue to work via the redirect. The
`/my-flows/[id]/instance-detail-client.tsx` and related files remain as the
component source used by the panel (imported by `tasks-client.tsx`).

KB updates (migration 20260529200000, applied to production):

- `understanding-notifications` (EN + VI): added 💬 **Comment added** row to
  the notification types table (was missing since Phase 18 M2). Updated
  "navigate to the relevant page" → "open the relevant flow in the detail panel".
- `how-to-use-flow-comments`: replaced "from My Flows → (click a flow)" with
  the full set of entry points (Tasks → Pending, My Flows, History tabs;
  notification bell; Admin → Instances).

── Post-Setup Redirect Fix ───────────────────────────────────────────────────

After completing account setup, invited users (role=user) were redirected to
/dashboard, which immediately bounced them to /unauthorized (dashboard is
admin-only). Fixed in three files:

- src/components/auth/account-setup-form.tsx router.push('/tasks')
- src/app/auth/confirm/page.tsx router.push('/tasks') (×2)
- src/app/(app)/account-setup/page.tsx redirect('/tasks')

/tasks is accessible to all authenticated users regardless of role.

── Production URL Fix ────────────────────────────────────────────────────────

Confirmation email links pointed to localhost:3000 because NEXT_PUBLIC_SITE_URL
was only set in .env.local (not in Vercel). Fix: set NEXT_PUBLIC_SITE_URL to
the production domain in Vercel environment variables, and add the production
/auth/confirm URL to Supabase → Authentication → URL Configuration → Redirect
URLs allowlist. - OWASP ZAP: point at staging URL after deploy, run automated scan

── PHASE 17 M2 — SLACK & TEAMS WEBHOOK NOTIFICATIONS (2026-05-28) ──────────

Goal: deliver step-assignment and SLA alerts to Slack or Teams channels
alongside email, using each platform's Incoming Webhooks.

DB Migration: supabase/migrations/20260528130000_add_webhook_urls_to_tenants.sql

ALTER TABLE tenants
ADD COLUMN slack_webhook_url TEXT,
ADD COLUMN teams_webhook_url TEXT;

Applied to production (qdngvdffqsnqikqbhkmw) via Supabase MCP.

src/lib/notifications/webhook.ts (new):

- WebhookEvent union type: 'step_assigned' | 'sla_overdue'
- detectPlatform(url): 'slack' | 'teams' | null — URL-shape detection
  (hooks.slack.com → Slack; webhook.office.com → Teams)
- buildSlackPayload(event): Block Kit JSON (section + actions button)
- buildTeamsPayload(event): Adaptive Card JSON (TextBlock + FactSet + OpenUrl)
- sendWebhookNotification(tenantId, event): fetches tenant webhook URLs,
  detects platform, fires POSTs concurrently. Fire-and-forget, non-fatal.
- testWebhookUrl(url): sends a sample step_assigned payload — used by the
  settings Test button without needing a real flow.

src/lib/settings/webhook-actions.ts (new, 'use server'):

- getWebhookUrls(): returns current slack_webhook_url + teams_webhook_url
  for the caller's tenant (admin-only).
- saveWebhookUrls(slackUrl, teamsUrl): validates URL shape before persisting
  (null-stores empty strings to allow clearing).
- testWebhook(url): admin-gated wrapper around testWebhookUrl().

src/components/settings/WebhookSettingsCard.tsx (new client component):

- Two URL inputs (Slack + Teams) with monospace font.
- Per-URL "Test" button with independent pending state.
- Save button with optimistic status feedback.

src/app/(app)/settings/page.tsx — added "Integrations" tab (4th tab):

- Fetches getWebhookUrls() when tab=integrations.
- Renders <WebhookSettingsCard> with current URLs.

Wired notification events:

- src/lib/flows/actions.ts (triggerFlow + advanceFlow): fires
  sendWebhookNotification after step assignment, alongside existing
  createNotification + sendAssignmentEmail. Uses NEXT_PUBLIC_SITE_URL
  for the task deep-link.
- src/app/api/cron/sla/route.ts: groups stepInfos by tenant, fires one
  sla_overdue webhook per tenant (overdueCount + dueSoonCount summary)
  before the existing email digest loop.

Also installed: marked + @vercel/functions (missing packages from Phase 17 M1
pull that broke the build).

Commit: 595b61b feat(integrations): Phase 17 M2 — Slack & Teams webhook notifications

43. PHASE 15 — PLATFORM FLOW TEMPLATES (COMPLETE ✅)
    Theme: give the platform owner a template library that tenant admins can
    browse and clone into their workspace with one click — reducing onboarding
    friction and showing best-practice workflow patterns.
    Build: clean throughout. 4 commits on master (initial feature + 3 bug fixes).

─── Database ─────────────────────────────────────────────────────────────────

supabase/migrations/20260527100000_flow_templates.sql:

- flow_templates table (platform-level, no tenant_id): id, name, description,
  category CHECK (hr|finance|it|operations|other), graph (JSONB), is_published
  BOOLEAN DEFAULT false, created_at, updated_at.
- RLS SELECT policy: any authenticated user can read rows WHERE is_published = true
  (tenant browsing + clone). All writes go through service-role server actions —
  no write policies needed.
- Partial index on (is_published, category) WHERE is_published = true for
  efficient gallery queries.

─── Platform admin side (/platform/templates) ────────────────────────────────

src/app/platform/templates/page.tsx (new server page):

- Table of all templates (all statuses): name, description, category badge,
  published/draft status toggle, last-updated date, Edit + Delete actions.
- "New Template" button calls createTemplate() server action → inserts a row
  with name 'Untitled Template' → redirects to the edit canvas.
- Auth: hard-redirect to /unauthorized if caller is not PLATFORM_ADMIN_EMAIL
  (same assertPlatformAdmin pattern used in other /platform routes).

src/app/platform/templates/[id]/edit/page.tsx (new server page):

- Loads the template row; renders the full React Flow canvas (FlowCanvas) with
  a new templateId prop to route saves through the template save path instead
  of the flow-version save path.
- ConfigSidebar: Publish panel and Version list panel are hidden in template
  mode (templateId present) — the sidebar shows only node config controls.
- AssigneePanel: remains fully available so platform admin can set suggested
  assignee rules as a default starting point for tenants.

src/app/platform/templates/actions.ts (new 'use server'):

- assertPlatformAdmin(): checks user.email === PLATFORM_ADMIN_EMAIL; throws
  Forbidden otherwise. Called at the top of every mutating action.
- createTemplate(): inserts a default row, redirects to edit page.
- saveTemplateGraph(templateId, graph): UPDATE flow_templates SET graph, updated_at.
  Returns { versionId: templateId } — versionId is re-used from the canvas
  save contract; for templates it is the template id itself (no version history).
- updateTemplateMeta(templateId, { name?, description?, category? }): PATCH +
  revalidatePath('/platform/templates').
- toggleTemplatePublished(templateId, published): flips is_published + revalidates.
- deleteTemplate(templateId): hard-deletes + revalidatePath + redirects to list.

src/components/platform/TemplateTopBar.tsx (new 'use client'):

- Inline editable name (click-to-edit input, Enter/Blur commits, Escape reverts).
- Category select (auto-saves on change via updateTemplateMeta).
- Publish toggle button (emerald "Published" / slate "Draft — click to publish",
  optimistic update with revert on error).

src/components/platform/DeleteTemplateButton.tsx (new 'use client'):

- Extracted from the server page to fix a serialization crash: onClick handlers
  in Server Components are not serializable to the client. Shows a confirm()
  dialog before calling deleteTemplate() via useTransition.

src/app/platform/layout.tsx:

- "Templates" nav item added to the platform admin sidebar nav.

─── Canvas integration ───────────────────────────────────────────────────────

src/store/canvas-store.ts:

- templateId?: string added to canvas store state. When set, triggerSave()
  calls saveTemplateGraph(templateId, graph) instead of saveDraftVersion().
  triggerPositionSave() is a no-op in template mode (templates don't track
  position-only saves separately).
- setTemplateId(id) action added; called by the template edit page on mount.

src/components/canvas/FlowCanvas.tsx:

- Accepts optional templateId prop. Calls store.setTemplateId(templateId) in
  a useEffect on mount.

src/components/canvas/panels/ConfigSidebar.tsx:

- PublishPanel and VersionListPanel are skipped when templateId is truthy
  — template canvases have no publish lifecycle or version history.

─── Tenant gallery side ──────────────────────────────────────────────────────

src/lib/flows/template-actions.ts (new 'use server'):

- getPublishedTemplates(): admin client SELECT from flow_templates WHERE
  is_published = true, ordered by category. Returns PublishedTemplate[]:
  { id, name, description, category, graph }.
- createFlowFromTemplate(templateId):
  1. Auth: getSessionClaims() — admin role only.
  2. Plan limit: counts existing flows; redirects with ?error= param if at cap
     (same pattern as manual flow creation).
  3. Fetches template (name + graph).
  4. scrubAssigneeRules(graph): strips assignee rules of types 'fixed',
     'department_head', and 'role_in_dept' — these are tenant-specific and
     meaningless in a new tenant's workspace. 'requester', 'manager_of_requestor',
     and 'skip_level' are kept as they work generically.
  5. Inserts a new flow row (status: 'draft').
  6. Inserts a flow_versions row (version_number: 1, published_at: null) and
     immediately updates flows.latest_version_id to point at it.
  7. Redirects to /flows/{id}/edit.

src/components/flows/TemplateGalleryModal.tsx (new 'use client'):

- Full-screen overlay (fixed inset, backdrop, max-w-3xl dialog, max-h-80vh
  scrollable body).
- Category tab bar: "All" + one tab per distinct category in the returned
  template list (sorted, derived at render time with Array.from(new Set(...))).
- Template grid (1–3 columns responsive): card per template showing name,
  category badge, optional description (line-clamp-2), "Use template" button.
- "Use template" calls createFlowFromTemplate() via useTransition; spinner on
  the active card while pending.

src/app/(app)/flows/page.tsx:

- Fetches getPublishedTemplates() in parallel with the flows list.
- Passes templates down to FlowsClient.

src/components/flows/flows-client.tsx:

- "Templates" button in the toolbar (admin only) opens TemplateGalleryModal.
- templates prop added (PublishedTemplate[]) — button hidden when empty.
- onDeleted callback added to FlowRowActions: filters the deleted flow out of
  local flows state immediately so the row disappears without a manual refresh.
  (Root cause: router.refresh() re-fetches server data but FlowsClient holds its
  own initialFlows state initialised once from props — it never re-syncs on
  refresh.)

─── Bug fixes ────────────────────────────────────────────────────────────────

Bug 1 — onClick in Server Component (commit 9fb6608):
DeleteTemplateButton was originally an inline JSX button inside the server page,
with an onClick calling deleteTemplate(). Next.js serialization fails on event
handlers in Server Components at runtime. Fix: extracted to
src/components/platform/DeleteTemplateButton.tsx ('use client') with useTransition

- confirm() dialog.

Bug 2 — Cloned flow opened blank (commit 9a8c71c):
Two issues in createFlowFromTemplate(): (a) the flow_versions INSERT included
is_draft: true — is_draft is not a column on flow_versions; the insert was
silently failing, leaving the flow with no version row at all. (b) Even if the
insert had succeeded, flows.latest_version_id was never updated, so
getLatestDraftGraph() returned null. Fix: removed is_draft, used published_at: null
(matching the saveDraftVersion insert shape), and added the UPDATE flows SET
latest_version_id after the version insert.

Bug 3 — Deleted flow stayed in list (commit 251dca9):
After deleteFlow(), router.refresh() was called but FlowsClient never re-synced
its local flows state from the server props. Fix: added an onDeleted(flowId)
callback prop from FlowsClient → FlowRowActions that filters the deleted id out
of local state immediately on success.

KNOWN GOTCHA — onClick in Server Components:
Any interactive action in a Server Component (like a delete button) must be
wrapped in a 'use client' child component. Inlining an event handler directly
in the server page compiles without error but crashes at runtime with a
serialization failure. Use a Server Action inside a <form action={...}> for
zero-JS interactions, or a 'use client' component with useTransition for
confirm-guarded destructive actions.

44. PHASE 16 — AI CUSTOMER SUPPORT SYSTEM (IN PROGRESS)
    Theme: handle inbound customer email to contact@aitomicflow.com automatically.
    Emails are logged as tickets in Supabase, Claude AI drafts a reply using a
    markdown knowledge base, and a human agent can review / reply / close tickets
    from a dedicated inbox inside the /platform admin area.
    All support tables are platform-level (no tenant_id) — this is Aitomic Flow's own
    customer support, not a tenant-facing feature.

    Milestones:
    M1 — Database schema ✅ COMPLETE
    M2 — Inbound email webhook ✅ COMPLETE (Postmark, deployed)
    M3 — AI response engine 🔜 NEXT
    M4 — Admin support inbox UI (/platform/support) 🔜 PLANNED
    M5 — Knowledge base management UI (/platform/support/knowledge) 🔜 PLANNED

─── M1 — Database Schema (COMPLETE) ─────────────────────────────────────────

supabase/migrations/20260527200000_support_system.sql:

support_tickets: id, subject, sender_email, sender_name,
status CHECK (open|pending_human|ai_replied|closed) DEFAULT 'open',
priority CHECK (low|normal|high|urgent) DEFAULT 'normal',
category (ai-inferred: billing|how-to|account|technical|general),
ai_confidence CHECK (high|low), assigned_to FK→users ON DELETE SET NULL,
last_message_at, created_at, updated_at (auto-updated by trigger).
RLS enabled, no public policies — all access via service-role admin client.

support_messages: id, ticket_id FK→support_tickets CASCADE, direction
CHECK (inbound|outbound), from_email, from_name, body_text, body_html,
is_ai_generated BOOL, email_message_id (Message-ID header), in_reply_to
(In-Reply-To header), resend_id (outbound Resend delivery ID), created_at.

knowledge_base: id, title, slug UNIQUE, content_markdown, category CHECK
(general|billing|how-to|account|technical), is_active BOOL,
search_vector TSVECTOR (auto-updated by trigger using setweight A=title,
B=content_markdown for Postgres full-text search), created_at, updated_at.
Seeded with 5 starter articles: What is Aitomic Flow, Pricing & Plans,
How to Invite Users, How to Create a Workflow, Resetting Your Password.

Nav: 'Support' item (Headphones icon) added to /platform layout nav.

─── M2 — Inbound Email Webhook (COMPLETE) ────────────────────────────────────

INBOUND PROVIDER: Postmark (not Resend).
Resend was evaluated first but dropped — its inbound webhook intentionally
omits text/html body and its Emails API is restricted to outbound retrieval.
Postmark includes TextBody + HtmlBody directly in the webhook payload.

DNS: aitomicflow.com MX 10 inbound.postmarkapp.com
Postmark dashboard → Server → Settings → Inbound → Webhook URL:
https://www.aitomicflow.com/api/webhooks/email-inbound?secret=<SUPPORT_INBOUND_SECRET>

src/lib/support/inbound.ts:

- ResendInboundPayload type updated to actual Resend envelope shape
  { type, created_at, data: { from, to, subject, message_id, email_id, ... } }
  (kept for reference; active processor uses PostmarkInboundPayload).
- parseEmailAddress(): handles "Name <email>" and plain address formats.
- normaliseSubject(): strips Re:/Fwd: prefixes for subject-based threading.
- getHeader(): handles both header formats — object map or [{name,value}] array.
- processInboundEmail(payload): core processor.
  Threading detection (priority order):
  1. Match In-Reply-To / References headers against email_message_id in
     support_messages (exact header match).
  2. Fallback: same sender_email + normalised subject in a non-closed ticket
     (scans last 20 open/ai_replied tickets from the sender).
     Reopens 'closed' or 'ai_replied' tickets when a new reply arrives.
     Returns { ticketId, messageId, isNewTicket }.

src/app/api/webhooks/email-inbound/route.ts:

POST /api/webhooks/email-inbound?secret=<SUPPORT_INBOUND_SECRET>

- Validates shared secret from query param (embedded in Postmark webhook URL).
- Calls processInboundEmail() and returns { ok, ticketId, messageId, isNewTicket }.
- GET returns { ok: true } for health checks.

Bug fixes applied during M2 testing (commits 830a936, 42e3d10):

1. Middleware blocked the webhook — /api/webhooks added to PUBLIC_ROUTES in
   src/middleware.ts so Postmark's POST reaches the handler without a session.
2. Vercel www-redirect — aitomicflow.com issues a 307 to www.aitomicflow.com;
   Postmark/Resend do not follow 307s. Webhook URL must use www.aitomicflow.com.
3. Resend payload envelope — Resend wraps fields in { type, data: {...} };
   ResendInboundPayload type and processInboundEmail updated to match.

─── Environment Variables ────────────────────────────────────────────────────

SUPPORT_INBOUND_SECRET — 64-char hex shared secret embedded in the webhook URL.
Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
Set in .env.local and in Vercel → Environment Variables → Production.

─── Architecture Decisions ───────────────────────────────────────────────────

- All support tables are platform-level (no tenant_id). The /platform
  middleware email guard is the primary auth layer; all DB writes use
  createAdminClient() (service role).
- Inbound provider: Postmark. Outbound (notifications, invites) remains Resend.
- AI response (M3): Claude reads relevant knowledge_base articles via
  Postgres full-text search (tsvector), generates a reply with confidence
  rating and category. High-confidence → auto-send via Resend and mark
  'ai_replied'. Low-confidence / billing / complaint → email-notify agent,
  mark 'pending_human'.
- Human inbox (M4): /platform/support ticket list + /platform/support/[id]
  thread view. Agent reply sends via Resend and logs to support_messages.
- Knowledge base (M5): CRUD markdown articles in /platform/support/knowledge.
  Full-text search via GIN index on search_vector (auto-updated by trigger).

KNOWN GOTCHA — Webhook URL must be www.aitomicflow.com (not bare domain).
Vercel redirects the bare domain to www; webhook providers do not follow
the redirect and log the 307 body ("Redirecting...") as a failed delivery.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE 16 — SESSION 2 (2026-05-28) — COMPLETED MILESTONES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

─── M4 — Admin Support Inbox UI (COMPLETE) ──────────────────────────────────

/platform/support — ticket list with 4 stat cards (open / needs review /
ai_replied / closed), status filter tabs (URL-based), table with subject,
sender, status/priority/category/AI-confidence badges, last activity.

/platform/support/[id] — thread detail: full inbound+outbound message
history, Customer/Support/AI badges per message, metadata sidebar.
Agent reply form (client component): textarea → sendAgentReply() server
action → Resend email → outbound row logged to support_messages → ticket
closed. Standalone status dropdown changes ticket status independently.

Server actions (src/app/platform/support/actions.ts):
getTickets(statusFilter?) | getTicketWithMessages(ticketId)
updateTicketStatus(ticketId, status) | sendAgentReply(ticketId, replyText)
All guarded by assertPlatformAdmin().

─── Public Help Center (COMPLETE) ────────────────────────────────────────────

/help — public page (no auth), shows all English KB articles grouped by
category. Category overview cards with article counts. "Contact Support"
CTA. Filters out -vi slug articles.

/help/[slug] — individual article rendered from content_markdown using
marked (markdown→HTML) + @tailwindcss/typography prose styles. Breadcrumb
nav, "View on Help Center" link from admin edit page. generateStaticParams
for build-time generation.

Nav wired: "Help" link added to landing page nav + app sidebar (all roles,
BookOpen icon, Support group). Dependencies: marked@18, @tailwindcss/typography.

─── M5 — Knowledge Base Management UI (COMPLETE) ────────────────────────────

/platform/support/knowledge — article list: active/inactive counts,
category badges, toggle active (useTransition), delete with confirm.
"Knowledge Base" nav item added to /platform layout.

/platform/support/knowledge/new — create form.
/platform/support/knowledge/[id] — edit form with live markdown preview
toggle and "View on Help Center ↗" link.

ArticleForm (client component): title→auto-slug until manually edited,
slug sanitised via slugify() (extracted to utils.ts — 'use server' files
may only export async functions). Markdown stored in React state so content
survives preview/edit toggle; submitted via hidden input. Category select.
Save revalidates /platform/support/knowledge and /help.

TRAP — 'use server' sync export: slugify() was initially exported from
actions.ts (a 'use server' file). Next.js 14 rejects non-async exports from
'use server' files at build time. Fix: moved to utils.ts (no directive).

─── AI Context Enrichment (COMPLETE) ────────────────────────────────────────

src/lib/support/user-context.ts — fetchUserContext(senderEmail):

- Looks up sender in users table by email.
- Returns '' immediately if not found (prospective/unknown sender —
  KB-only mode unchanged, zero behaviour change).
- If found: fetches tenant, department, manager in parallel.
- Fetches pending step_instances assigned to user (up to 5); extracts
  step label from flow_versions.graph JSON nodes array.
- Fetches recent flow_instances triggered by user (up to 5); resolves
  current step label from graph.
- Marks overdue steps (due_at < now) with ⚠ flag.
- Formats as ACCOUNT CONTEXT / STEPS WAITING / FLOWS RECENTLY STARTED block.

generateAiResponse() updated: KB search + fetchUserContext run in parallel
(Promise.all). User context block injected after KB articles in Claude prompt.
System prompt updated to instruct Claude to use account data for specific
personalised answers (name the actual flow/step).

─── AI Confidence & Auto-reply Improvements (COMPLETE) ──────────────────────

Problem: "high" confidence was gated on KB articles fully answering the
question → most tickets routed to pending_human even for simple queries.

Fix 1 — System prompt confidence redefinition:
"high" = Claude can give a complete, accurate answer from any source
(KB, account context, or general product knowledge).
"low" = ONLY for billing/financial questions requiring data Claude cannot see.
Claude no longer penalises itself for sparse KB results.

Fix 2 — KB search pass 3 fallback:
When both text-search passes (AND + OR) return nothing, a broad
cross-category sample of 6 English articles is returned so Claude always
has product context. Article limits on passes 1 & 2 raised 3 → 5.

Fix 3 — Loosened auto-reply gate:
Before: low confidence → no reply sent, pending_human.
After: low confidence + non-billing → reply sent (reply_text as-is) +
ticket stays pending_human + agent alerted to monitor.
Only billing routes straight to human without sending.
Claude signs off in the same language as the reply (no hardcoded EN footer).

Routing table:
high + non-billing → auto-reply, ticket → ai_replied
low + non-billing → auto-reply, ticket → pending_human, agent alerted
low + billing → no reply, ticket → pending_human, agent alerted

─── Google OAuth Login Fix (COMPLETE) ───────────────────────────────────────

Symptom: clicking "Continue with Google" completed the Google auth flow but
redirected to the landing page (https://www.aitomicflow.com/?code=...) instead
of the app.

Root cause: Supabase falls back to the Site URL when the redirectTo URL passed
by signInWithOAuth is not in its Redirect URLs allowlist. The PKCE code was
appended to the site root (/?code=...) instead of /auth/callback?code=...
The /auth/callback Route Handler never ran, so exchangeCodeForSession was
never called. The landing page's `if (user) redirect('/tasks')` check ran
instead, making it appear the user was sent to the "home page."

Fix 1 — middleware intercept (src/middleware.ts):
Added a check at the top of the middleware function: if the request hits '/'
with a 'code' query param present, immediately redirect to /auth/callback
preserving all query params. The PKCE code_verifier cookie travels with the
redirect so exchangeCodeForSession succeeds.

Fix 2 — platform admin bypass in callback (src/app/auth/callback/route.ts):
After a successful exchangeCodeForSession, if the authenticated user's email
matches PLATFORM_ADMIN_EMAIL, redirect straight to /platform, bypassing the
public.users profile check that normal users go through. Platform admin always
lands at /platform after any OAuth login.

KNOWN GOTCHA — Supabase Redirect URL allowlist:
signInWithOAuth passes redirectTo: `${window.location.origin}/auth/callback`.
If that exact URL is not in Supabase → Auth → URL Configuration → Redirect
URLs, Supabase silently falls back to the Site URL. Add all variants to avoid
relying on the middleware intercept:
https://www.aitomicflow.com/auth/callback
https://aitomicflow.com/auth/callback
http://localhost:3000/auth/callback

─── Terms of Service & Privacy Policy Pages (COMPLETE) ──────────────────────

Two public legal pages added (commit 2d8e7c9). Both fully accessible without
login — added to PUBLIC_ROUTES in middleware.ts (/terms, /privacy, /help).

src/app/terms/page.tsx:

- 14-section Terms of Service (acceptance, service, accounts, billing,
  acceptable use, IP, privacy, disclaimers, liability, indemnification,
  termination, governing law, changes, contact).
- Sticky desktop ToC sidebar (lg:grid lg:grid-cols-[220px_1fr]).
- GDPR-compatible governing-law clause, EU ODR platform link.
- USD 100 aggregate liability cap. 30-day data retention post-termination.
- eslint-disable react/no-unescaped-entities (legal text contains many
  quoted terms and contractions in JSX).

src/app/privacy/page.tsx:

- 13-section Privacy Policy covering GDPR + CCPA compliance.
- Legal bases: Art. 6(1)(b) contract, (f) legitimate interests,
  (c) legal obligation, (a) consent.
- Full GDPR rights (Art. 15-22): access, rectification, erasure,
  restriction, portability, objection, automated decision-making.
- CCPA rights: know, delete, correct, opt-out of sale, non-discrimination.
- Third-party processors listed: Supabase/AWS, Resend, Postmark, Stripe,
  Sentry, Anthropic.
- International data transfers: SCCs + UK IDTAs.
- Sub-grouped ToC entries for rights sub-sections (GDPR / CCPA).

Surface area wired:

- Landing page footer: href="#" links replaced with <Link> to /privacy
  and /terms; Help Center link added to account nav column.
- App sidebar (sidebar.tsx): Privacy / Terms micro-links at bottom,
  shown only when sidebar is not collapsed.
- Both pages share the same sticky header nav pattern as the landing page
  (logo + Privacy Policy, Help Center, Log in links).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 45. PHASE 17 — ONBOARDING & NOTIFICATIONS (ROADMAP)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

M1 — Tenant Onboarding & Activation ✅ COMPLETE
M2 — Slack & Teams Webhook Notifications ✅ COMPLETE

─── M1 — Tenant Onboarding & Activation ────────────────────────────────────

Theme: new tenants sign up and hit a blank slate. A guided first-run
experience reduces drop-off and gets the first workflow live faster.

Components:

Onboarding checklist widget (persistent, dismissible):

- Rendered in the (app) layout or /tasks page for admin users only.
- 4–5 steps: ① Invite your first user ② Create your first flow
  ③ Publish and trigger a flow ④ Set up your team (departments) ⑤ Explore AI.
- Progress stored in a new tenant_onboarding table (or JSONB column on tenants)
  so it persists across sessions and auto-ticks when the action is completed.
- "Dismiss" hides permanently once all steps are done or the user opts out.
- Each step has a CTA button that deep-links to the relevant page.

Empty states:

- /flows — when no flows exist: illustration + "Create your first flow" button
  - optional "Use a template" shortcut.
- /tasks — when no pending tasks: friendly zero-state message, not a blank table.
- /users — when only the admin exists: "Invite your first team member" CTA.

Welcome email:

- Triggered automatically after createTenantAccount() completes (signup flow).
- Sent via Resend with subject "Welcome to Aitomic Flow — here's how to get started".
- Body: 3-step quick-start guide (create flow, invite user, trigger flow) with
  deep-link buttons. Uses the same branded email template shell as invite emails.

Sample flow pre-load (optional, toggle):

- After signup, offer "Load a sample Leave Request flow?" — one click to clone
  the Leave Request template from the platform template library into the new
  tenant's workspace, so they can see a real flow immediately.

─── M2 — Slack & Teams Webhook Notifications ────────────────────────────────

Theme: step assignment and SLA alerts delivered to Slack or Teams channels
alongside (or instead of) email, using each platform's Incoming Webhooks.

How it works:

Slack Incoming Webhooks — admin goes to api.slack.com/apps → creates an app
→ enables Incoming Webhooks → installs to a channel → copies the webhook URL
(https://hooks.slack.com/services/T.../B.../xxx). Aitomic Flow POSTs a Block Kit
message with the task name, flow name, assignee, due date, and an "Open Task"
button linking to https://www.aitomicflow.com/tasks/[id].

Microsoft Teams — admin goes to a Teams channel → Manage Channel →
Connectors → Incoming Webhook → configure → copies the webhook URL
(https://xxx.webhook.office.com/webhookb2/...). Aitomic Flow POSTs an Adaptive
Card payload with the same information.

URL shape detection: if the URL contains hooks.slack.com → Slack format;
if it contains webhook.office.com → Teams format.

Components:

supabase/migrations — add slack_webhook_url TEXT and teams_webhook_url TEXT
to the tenants table (nullable).

src/lib/notifications/webhook.ts (new):

- sendSlackNotification(url, payload): POST Block Kit JSON.
- sendTeamsNotification(url, payload): POST Adaptive Card JSON.
- sendWebhookNotification(tenantId, event): resolves tenant webhook URL,
  detects platform, formats payload, fires the POST. Fire-and-forget
  (await-ed to avoid Vercel Lambda cut-off, but errors are non-fatal).

Notification events wired (in src/lib/flows/actions.ts):

- Step assigned (triggerFlow / advanceFlow): notify assignee's tenant channel.
- SLA overdue (src/app/api/cron/sla/route.ts): notify channel alongside
  existing email digest.

Settings UI — new "Integrations" card in /settings (admin only):

- Two URL inputs: Slack Webhook URL + Teams Webhook URL (mutually exclusive
  or both allowed — tenant's choice).
- "Test" button fires a sample notification so the admin can confirm it works
  before saving.
- Server action saveWebhookUrls() validates URL shape before persisting.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 46. PHASE 17 — ONBOARDING & NOTIFICATIONS (COMPLETE ✅)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Theme: guide new tenants from signup to first workflow, and deliver real-time
alerts to Slack/Teams so assignees never miss a task. Both milestones shipped
in one session (2026-05-28). Build: clean, 103 routes, npm run build passes.

── Session log (2026-05-28) ──────────────────────────────────────────────────

git pull origin master — pulled Phase 17 M1 + related fixes from origin:

- AdminChecklist, TourProvider, sample flow preload, welcome email update
- user_onboarding migration, knowledge base seed migrations
- Help center pages (/help, /help/[slug]), Privacy & Terms pages
- Support system updates (AI responder, user context, inbound webhook)
- Onboarding wired into layout, tasks page, sidebar, AvatarDropdown
  Missing packages from M1 pull (marked, @vercel/functions) installed and
  committed alongside M2.

Phase 17 M2 — Slack & Teams Webhook Notifications implemented and shipped:

DB: 20260528130000_add_webhook_urls_to_tenants.sql — slack_webhook_url TEXT
and teams_webhook_url TEXT added to tenants. Applied to production via MCP.

src/lib/notifications/webhook.ts (new) — WebhookEvent union type
(step_assigned | sla_overdue), URL-shape platform detection, Slack Block Kit
and Teams Adaptive Card payload builders, sendWebhookNotification(tenantId,
event) fire-and-forget helper, testWebhookUrl(url) for settings Test button.

src/lib/settings/webhook-actions.ts (new, 'use server') — getWebhookUrls(),
saveWebhookUrls() with URL shape validation, testWebhook() admin gate.

src/components/settings/WebhookSettingsCard.tsx (new) — Slack + Teams URL
inputs, per-URL Test button, Save with status feedback.

src/app/(app)/settings/page.tsx — "Integrations" tab added (4th tab).
Fetches webhook URLs server-side, renders WebhookSettingsCard.

src/lib/flows/actions.ts — sendWebhookNotification fired in triggerFlow and
advanceFlow after step assignment (alongside existing email + in-app notification).

src/app/api/cron/sla/route.ts — one sla_overdue webhook per tenant
(overdueCount + dueSoonCount summary) fired before email digest loop.

Commits:
595b61b feat(integrations): Phase 17 M2 — Slack & Teams webhook notifications
5355628 docs(summary): update Phase 17 M2 — Slack & Teams webhook notifications complete

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 47. PHASE 18 — MOBILE UX & COLLABORATION (ROADMAP)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

M1 — Mobile-Responsive Polish ✅ COMPLETE
M2 — Flow Instance Comments / Thread ✅ COMPLETE

─── M1 — Mobile-Responsive Polish ───────────────────────────────────────────

Theme: the app was built desktop-first. The core assignee workflow (/tasks,
sidebar nav, step detail panels, flow trigger) must be fully usable on a phone
so field teams and non-desk workers can participate without a laptop.

Scope (core assignee paths only — canvas/admin excluded):

Sidebar navigation:

- Collapse to a bottom tab bar or hamburger drawer on mobile (sm breakpoint).
- Active tab indicator, touch-friendly tap targets (min 44px).

/tasks page:

- Tab bar (Pending / My Flows / History) wraps correctly on narrow screens.
- AdminChecklist collapses cleanly or stacks vertically.
- Task cards in the list are full-width, readable without horizontal scroll.

Step detail / task form (tasks-client.tsx + instance detail panel):

- Slide-in panel becomes full-screen sheet on mobile instead of 50vw side panel.
- Form fields (text, select, file upload) are touch-friendly.
- Submit / Save Draft buttons fixed to bottom of screen on mobile.

/flows list page:

- Flow cards stack to single column.
- Filter bar collapses into a dropdown or sheet.

/my-flows/[id] (flow instance timeline):

- Timeline cards stack cleanly, step badges wrap.

─── M2 — Flow Instance Comments / Thread ────────────────────────────────────

Theme: assignees and admins currently have no in-app channel to ask questions
or leave notes on a running flow instance — all back-channel happens via email.
A simple comment thread per flow instance reduces noise and creates an audit
trail of decisions.

DB:

instance_comments table:
id uuid PK
tenant_id uuid FK → tenants
instance_id uuid FK → flow_instances ON DELETE CASCADE
user_id uuid FK → users
body text NOT NULL
created_at timestamptz DEFAULT now()

RLS: tenant isolation on tenant_id + only users with access to the instance
can read/write (same access rule as getFlowTimeline: triggerer, any assignee,
or tenant admin).

API / server actions (src/lib/flows/comment-actions.ts):

- addComment(instanceId, body): validates access, inserts row, returns comment.
- getComments(instanceId): returns thread sorted oldest→newest.

UI:

- Comment thread rendered below the step timeline in the instance detail panel
  (my-flows/[id] and admin/instances slide-in panel).
- Simple textarea + "Send" button; optimistic append on submit.
- Avatar + name + relative timestamp per message.
- Real-time optional: poll every 30s or use Supabase Realtime channel on
  instance_comments for live updates.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 48. PHASE 18 — MOBILE UX & COLLABORATION (COMPLETE ✅)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Theme: make the app usable on mobile for field teams, and give all flow
participants an in-app comment thread so decisions are captured where the work
happens. Both milestones shipped in one session (2026-05-28). Build: clean,
103 routes, npm run build passes.

── M1 — Mobile-Responsive Sidebar & Core Nav (2026-05-28) ───────────────────

Commit: 3a82aa2 feat(mobile): Phase 18 M1 — mobile-responsive sidebar + core nav

src/components/shell/sidebar.tsx:

- On mobile (< md): sidebar becomes a fixed full-height left drawer (z-50,
  w-72) hidden off-screen by default. A hamburger button (Menu icon, fixed
  top-left, md:hidden) opens it; an X button inside the header closes it.
  Backdrop overlay (z-40, bg-black/50) closes on tap. Auto-closes on navigation
  via useEffect watching usePathname().
- Desktop (md+): existing collapsible behavior unchanged (w-56 / w-14).

src/components/shell/topbar.tsx:

- pr-6 pl-16 md:pl-6 — reserves 64px on the left on mobile to clear the
  fixed hamburger button; reverts to 24px on desktop.

src/app/(app)/layout.tsx:

- p-4 md:p-6 on main — tighter content padding on narrow screens.

src/app/(app)/tasks/tasks-client.tsx:

- Tab bar: px-3 sm:px-5 so all three tabs fit on a 375px phone without
  horizontal scroll.

── M2 — Flow Instance Comment Thread (2026-05-28) ────────────────────────────

Commit: 9374e9e feat(comments): Phase 18 M2 — flow instance comment thread

DB (applied to production qdngvdffqsnqikqbhkmw):

instance_comments (id, tenant_id, instance_id, user_id, body, created_at)

- body CHECK: 1–2000 chars, trimmed
- Indexes: (instance_id, created_at), (tenant_id)
- RLS: tenant_id isolation policy

flows.show_full_comment_history boolean NOT NULL DEFAULT true

Access rules:

- Read/write: flow triggerer + any user who has ever been assigned a step on
  this instance (past or current, i.e., has a step_instances row) + admin.
- Future assignees (no step_instances row yet) are excluded automatically —
  they gain access the moment advanceFlow assigns their step.
- Admin always has read access but does NOT receive comment notifications
  unless also triggerer or step assignee.

History toggle (show_full_comment_history):

- Stored on the flows table (per-flow, not global).
- When OFF: regular assignees only see comments whose created_at >=
  their earliest step_instance.created_at for that instance.
- Triggerer and admin always see full history regardless.
- Toggle lives in the flow builder Publish panel (alongside dept restriction).
- Server action: updateFlowCommentHistory(flowId, bool).

src/lib/flows/comment-actions.ts (new 'use server'):

- checkAccess(): resolves triggerer / step-assignee / admin, returns flow
  metadata including showFullHistory.
- getComments(instanceId): access-gated, history-filtered. Called on page
  load (server) and client-side after each successful addComment.
- addComment(instanceId, body): insert → in-app notifications for all
  participants except the poster → Slack/Teams webhook (comment_added event).

Notifications:

- src/lib/notifications/create.ts: added 'comment_added' to NotificationType.
- src/lib/notifications/webhook.ts: added 'comment_added' WebhookEvent with
  Slack Block Kit and Teams Adaptive Card payloads. Slack shows commenter
  name + truncated body + "View Flow" button.

UI — CommentThread (inline component in instance-detail-client.tsx):

- Bubble layout: own messages right (primary bg), others left (muted bg).
- Optimistic append on send; server refresh on success to sync IDs.
- Ctrl+Enter keyboard shortcut to submit; 2000-char textarea maxLength.
- Amber notice banner when show_full_comment_history = false.
- Rendered below Activity Log in both /my-flows/[id] full page and the
  tasks slide-in panel (initialComments threaded through
  getInstanceDetailForPanel → InstanceDetailForPanel → tasks-client).

Prop threading for history toggle (edit/page → FlowCanvas → ConfigSidebar
→ IdlePanel → PublishPanel): initialShowFullHistory optional (default true)
so platform template editor is unaffected.

KNOWN GOTCHA — Set iteration: tsconfig default target (ES3) does not support
for...of on Set. Fixed with Array.from(participantIds) in addComment.

───────────────────────────────────────────────────────────────────────────── 49. POST-PHASE 18 BUG FIXES — Comment FK & Notification Type (2026-05-28)
─────────────────────────────────────────────────────────────────────────────

Two silent failures discovered after Phase 18 M2 shipped:

BUG 1 — Comment thread showed empty despite rows in DB
Root cause: instance_comments.user_id was defined as REFERENCES auth.users(id).
PostgREST resolves the `users!user_id` join hint by looking for a FK to the
public `users` table, not auth.users. With no matching FK, the join silently
errored and getComments() returned { comments: [], error: "..." }, which callers
discarded — so the CommentThread always rendered "No comments yet."
Fix: Migration 20260528150000 drops the old FK and re-adds it as
REFERENCES users(id) (public schema), matching the pattern used by
flow_event_logs.actor_id and audit_logs.actor_id.

BUG 2 — comment_added notifications never appeared in the bell
Root cause: The notifications table had a CHECK constraint
(notifications_type_check) locking the type column to exactly four values:
step_assigned, flow_completed, sla_reminder, step_escalated. Any insert with
type = 'comment_added' violated the constraint and was silently swallowed by
the try/catch in createNotification().
Fix: Same migration drops and recreates the constraint with comment_added added.

Code fix: NotificationBell.tsx TYPE_ICON map updated — comment_added now
maps to 💬 instead of falling through to the generic 🔔 fallback.

Migration applied to production (qdngvdffqsnqikqbhkmw) and committed:
supabase/migrations/20260528150000_fix_comment_fk_and_notification_type.sql
src/components/shell/NotificationBell.tsx

LESSON: When adding a new notification type in TypeScript (NotificationType
union), always check for a corresponding DB CHECK constraint on
notifications.type and update it in the same migration.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 50. FLOW TEMPLATE LIBRARY EXPANSION (2026-05-30)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Migration: supabase/migrations/20260530100000_flow_templates_seed.sql
Commit: 4e6b9c9 feat(templates): seed 20 published flow templates across all categories

Seeded 20 additional published flow templates covering all five categories.
Total published templates in production is now 22 (2 pre-existing + 20 new).

─── HR (6 templates) ────────────────────────────────────────────────────────

Leave Request — Branch flow. Requester submits leave type + dates; manager
approves/rejects via a branch node; approved path goes to HR processing
(confirmation number); rejected path routes back to requester for acknowledgment.

Employee Onboarding — Two-step linear. IT dept head sets up equipment and
accounts (checkbox field for equipment list); manager completes orientation
checklist and assigns a buddy.

Performance Review — Three-step linear. Employee self-assessment (ratings +
goals); manager review (performance rating + promotion recommendation);
HR sign-off (acknowledgment).

Remote Work Request — Branch flow. Employee submits dates and tasks; manager
approves or rejects; both paths route back to the requester for acknowledgment.

Training & Development Request — Branch flow. Employee submits program details
and cost; manager approves or rejects; approved path goes to finance for budget
code and amount; rejected path routes to requester.

Employee Offboarding — Two-step linear. IT dept head records asset returns and
access revocation; manager conducts exit interview (reason for leaving, rehire
eligibility, feedback).

─── Finance (5 templates) ───────────────────────────────────────────────────

Purchase Order Request — Branch flow. Requester submits vendor, items, quantity,
unit price, and justification; manager approves/rejects; approved path goes to
finance for PO number and payment terms.

Expense Reimbursement — Branch flow. Employee submits date, category, amount,
and receipt status; manager approves with an approved amount; finance processes
payment via bank transfer, card credit, or check.

Invoice Approval — Branch flow. Finance submits invoice details (number, vendor,
amount, due date, PO reference); finance dept head reviews and approves/rejects;
approved path goes to manager for payment scheduling.

Budget Request — Two-step linear. Requester submits budget category, period,
amount, and expected outcomes; dept head approves (with optional conditions and
adjusted amount).

Contract Review & Approval — Three-step linear. Requester submits contract with
document upload; legal reviews (approved / approved with redlines / rejected);
skip-level management provides final sign-off.

─── IT (4 templates) ────────────────────────────────────────────────────────

IT Equipment Request — Branch flow. Employee selects equipment type and provides
justification; IT dept head approves/rejects; approved path records asset tag,
serial number, and delivery date.

Software Access Request — Two-step linear. Employee requests system and access
level (read only → admin) with urgency flag; IT provisions and records licence
details.

IT Incident Report — Two-step linear. Staff reports incident type, severity,
affected system, and user count; IT records resolution status, root cause, and
resolution steps.

New Employee IT Provisioning — Two-step linear. HR submits employee details and
checks accounts to create (Email, VPN, Slack, GitHub, CRM, ERP); IT confirms
full or partial provisioning.

─── Operations (3 templates) ────────────────────────────────────────────────

Vendor Onboarding — Three-step linear. Procurement submits vendor details and
type; legal reviews NDA, background check, and compliance status; finance creates
the vendor in-system and verifies banking details.

Business Travel Request — Branch flow. Employee submits destination, dates,
purpose, and budget; manager approves/rejects; approved path books flights and
hotel with a booking reference.

Asset Transfer Request — Two-step linear. Requester specifies asset, current
location, transfer destination, and reason; dept head confirms the transfer
with actual date and name.

─── Other (2 templates) ─────────────────────────────────────────────────────

New Project Proposal — Branch flow. Proposer submits project name, type, budget,
dates, benefits, and risks; skip-level sponsor approves/rejects; approved path
allocates project code, budget, and resources.

Document Review & Sign-off — Three-step linear. Author submits document with
file upload; manager conducts peer review (approved / approved with changes /
requires revision); skip-level provides final publication sign-off.

─── Design decisions ─────────────────────────────────────────────────────────

- All 20 templates use only portable assignee rule types (requester,
  manager_of_requestor, skip_level, requester_dept_head). The three
  tenant-specific types (fixed, department_head, role_in_dept) are
  scrubbed on clone (scrubAssigneeRules in template-actions.ts) so they
  are never used here.
- Branch templates: the branch node's own formSchema contains a radio
  "Decision [Approve / Reject]" field (id: f1). The branchCondition
  evaluates f1 eq "Approve" → yes handle. This means the branch works
  immediately after cloning with no further configuration required.
- Rejection paths: all use a single acknowledgment radio field
  "I acknowledge the rejection [Acknowledged]" assigned back to the
  requester, giving the loop a clean close without leaving the requester
  with no notification.
- ON CONFLICT DO NOTHING: the migration is safe to re-run; it will skip
  rows if the table is ever repopulated (no unique constraint on name,
  so re-running on a fresh DB will insert again — use with care).

45. DOMAIN MIGRATION & REBRAND — aitomicflow.com (COMPLETE ✅)

New domain purchased: aitomicflow.com ("AI" + "tomic" portmanteau of atomic).
Brand name changed from DragFlow / Aitomic Flow → Aitomic Flow across the entire
codebase, database, and all platform settings.

─── Code changes (2 commits on master) ──────────────────────────────────────

Commit d1074b9 — 16 source files updated:

- src/app/layout.tsx: page title + description
- src/app/page.tsx: all brand names, hello@dragflow.io, app.dragflow.io,
  support@aitomicflow.com
- src/app/signup/page.tsx: brand name in nav
- src/lib/auth/signup-actions.ts: confirmation email brand + footer link
- src/app/privacy/page.tsx + terms/page.tsx: all brand names + email addresses
  (privacy@, support@, legal@)
- src/app/help/page.tsx + help/[slug]/page.tsx: brand + support email
- src/lib/email/templates.ts: support team sign-off, contact email
- src/lib/email/resend.ts: Reply-To fallback
- src/lib/support/ai-responder.ts: system prompt, KB URL format, outbound
  message ID domain, from_email fallback
- src/app/platform/support/actions.ts: from_email, from_name, message ID domain
- src/app/api/cron/sla/route.ts + lib/flows/actions.ts +
  lib/flows/comment-actions.ts + lib/notifications/webhook.ts:
  siteUrl fallback (https://www.aitomicflow.com → https://www.aitomicflow.com)

Commit 06d4dd8 — email template shell:

- Email header brand: "Workflow" → "Aitomic Flow"
- Email footer: "This email was sent by Workflow" → "...by Aitomic Flow"
- Invite subject + body: "on Workflow" → "on Aitomic Flow"

─── Database changes (Supabase — project qdngvdffqsnqikqbhkmw) ──────────────

44 knowledge_base rows updated via direct SQL:

- content_markdown: Aitomic Flow → Aitomic Flow, aitomicflow.com → aitomicflow.com
- title: Aitomic Flow → Aitomic Flow
- slug: bizflow → aitomic-flow (4 slugs: what-is-bizflow,
  what-is-bizflow-vi, user-roles-in-bizflow, user-roles-in-bizflow-vi)

─── Platform settings updated ────────────────────────────────────────────────

Vercel: aitomicflow.com + www.aitomicflow.com added as custom domains.
Env vars updated in Vercel production: NEXT_PUBLIC_SITE_URL, RESEND_FROM_EMAIL,
SUPPORT_FROM_EMAIL, SUPPORT_REPLY_TO_EMAIL.

Supabase Auth (Authentication → URL Configuration):

- Site URL: https://www.aitomicflow.com
- Redirect URLs: https://aitomicflow.com/auth/callback,
  https://www.aitomicflow.com/auth/callback

Google Cloud Console (OAuth 2.0 Client):

- Authorized JavaScript Origins: aitomicflow.com, www.aitomicflow.com
- Authorized Redirect URIs: aitomicflow.com/auth/callback,
  www.aitomicflow.com/auth/callback

Resend: aitomicflow.com domain verified. noreply@aitomicflow.com confirmed
sending (DKIM record resend.\_domainkey.aitomicflow.com active).
DMARC: v=DMARC1; p=none on \_dmarc.aitomicflow.com.
SPF TXT record added: v=spf1 include:spf.resend.com ~all.

Postmark (inbound email):

- MX record on aitomicflow.com → inbound.postmarkapp.com (priority 10).
- Webhook URL updated in Postmark dashboard to:
  https://www.aitomicflow.com/api/webhooks/email-inbound?secret=<SUPPORT_INBOUND_SECRET>

─── Verification tests run ───────────────────────────────────────────────────

- Resend outbound: test email to ducnv.hn@gmail.com accepted (id 706373ae),
  delivered successfully.
- Postmark inbound webhook: simulated POST with full payload returned
  {"ok":true,"ticketId":"c6f6ade6-..."} — ticket created in DB.
- Google OAuth flow: Supabase authorize URL resolves to accounts.google.com
  with redirect_to=https://www.aitomicflow.com/auth/callback. Auth callback
  redirects to www.aitomicflow.com/login (no old domain in chain).
- DNS: MX, DKIM, DMARC, A, www CNAME all confirmed via nslookup.

─── KNOWN GOTCHA — two brand names in legacy code ───────────────────────────

The codebase previously used both "DragFlow" (landing page, metadata) and
"Aitomic Flow" (legal pages, email templates, support). Both are now replaced with
"Aitomic Flow". If old brand names appear anywhere new, grep for both:
grep -rn "bizflow\|dragflow\|Aitomic Flow\|DragFlow" src/

39. PLATFORM AI SETTINGS — CONFIGURABLE INBOUND EMAIL RESPONDER (COMPLETE ✅)
    Build: clean (commit 79d4a60). Migration applied to remote DB.

─── Overview ─────────────────────────────────────────────────────────────────

The AI model used to auto-respond to inbound support emails is now configurable
by the platform owner via /platform/ai-settings. Previously hardcoded to
claude-sonnet-4-6 + ANTHROPIC_API_KEY env var; now driven entirely from the DB.
Supports both Anthropic (Claude) and OpenAI (GPT) with all available models.
This is platform-owner only — no tenant involvement.

─── Database ─────────────────────────────────────────────────────────────────

supabase/migrations/20260602000000_platform_ai_config.sql

platform_ai_config (singleton — boolean PRIMARY KEY + CHECK singleton = TRUE):
ai_enabled bool (default false), provider text ('anthropic'|'openai'),
model text (default 'claude-sonnet-4-6'),
anthropic_key_encrypted text | null,
openai_key_encrypted text | null.
Both keys stored independently (AES-256-GCM via existing crypto.ts) so the
owner can pre-enter both and switch providers without re-entering keys.
No RLS — accessed via service role only.

platform_ai_usage_logs (append-only):
feature text (default 'support_email'), provider, model,
input_tokens, output_tokens, cost_usd numeric(10,6), created_at.
Indexed on created_at DESC. No RLS — service role only.

─── Files ────────────────────────────────────────────────────────────────────

src/lib/platform/ai-config-actions.ts (new — 'use server')

requirePlatformAdmin(): checks user email against PLATFORM_ADMIN_EMAIL env var
(same guard as middleware). Throws on mismatch.

getPlatformAIConfig() → PlatformAIConfigData
updatePlatformAIConfig({ aiEnabled?, provider?, model? }) — upserts on singleton
savePlatformAPIKey(provider, key) — encrypts + upserts the correct key column
removePlatformAPIKey(provider) — nulls the correct key column
getPlatformAIUsageLogs(limit=50) → PlatformAIUsageEntry[]

src/lib/support/ai-responder.ts (updated)

Removed: hardcoded model string, ANTHROPIC_API_KEY env var check, direct
Anthropic-only SDK instantiation.
Added:

- Loads platform_ai_config row; falls back to pending_human if ai_enabled=false
  or the active provider's key is missing/unset.
- Calls Anthropic or OpenAI based on provider column (OpenAI via openai@6 SDK,
  already installed as a dependency of the tenant AI gateway).
- Logs every call to platform_ai_usage_logs with tokens + computed cost.

src/app/platform/ai-settings/page.tsx (new)
src/components/platform/PlatformAISettingsCard.tsx (new — 'use client')

Three sections:

1. AI Email Responder — enable/disable toggle; provider dropdown
   (Anthropic/OpenAI); model radio cards showing name, description, pricing
   (all models from pricing.ts MODELS_BY_PROVIDER).
2. API Keys — independent Anthropic + OpenAI key inputs; each shows an
   "Active" badge when that provider is selected; Change/Remove buttons; both
   keys can be stored simultaneously.
3. Recent Usage — table of last 50 calls: date, provider/model, input tokens,
   output tokens, cost in USD; aggregate total shown in header.

src/app/platform/layout.tsx (updated)
"AI Settings" nav item added (Bot icon from lucide-react), between
"AI Overrides" and "Templates".

─── Behaviour when AI is disabled or misconfigured ──────────────────────────

If platform_ai_config row does not exist, ai_enabled=false, or the active
provider has no key stored, ai-responder.ts sets the ticket to pending_human
and returns early — no crash, no silent drop.

─── KNOWN GOTCHA — singleton upsert ─────────────────────────────────────────

platform_ai_config uses onConflict: 'singleton' for all upserts. The singleton
column is the boolean PRIMARY KEY; its value is always TRUE. This pattern
guarantees exactly one row without needing a sequence or known UUID.

40. PASSWORD RESET FLOW (COMPLETE ✅)
    Build: clean. Commits: e882773 (initial), b744181 (PKCE fix),
    551da58 (rate-limit message), 90aa237 (Resend delivery).

─── Overview ─────────────────────────────────────────────────────────────────

Users can reset forgotten passwords via a "Forgot password?" link on the login
page. Email is sent through Resend (same as invite emails) — Supabase's
built-in SMTP is not used at all, avoiding rate limits and deliverability issues.

─── Files ────────────────────────────────────────────────────────────────────

src/app/auth/forgot-password/page.tsx (new)
Email form → calls requestPasswordReset() server action → shows generic
success state regardless of outcome (prevents user enumeration).
No client-side Supabase auth calls; no error states shown to user.

src/app/auth/forgot-password/actions.ts (new — 'use server')
requestPasswordReset(email): calls admin.auth.admin.generateLink({ type:
'recovery', redirectTo: SITE_URL/auth/reset-password }) → sends action_link
via sendPasswordResetEmail() (Resend). Always returns { success: true }.
If email not found, silently no-ops (logged server-side only).

src/app/auth/reset-password/page.tsx (new)
Handles the recovery session on page load — two flows supported:

- PKCE (default for @supabase/ssr): reads ?code= from query string →
  supabase.auth.exchangeCodeForSession(code)
- Implicit fallback: reads #access_token= from hash → setSession()
  Four states: loading → ready (password form) → success → error.
  On success: calls updateUser({ password }), signs out, redirects to /login.
  On error (expired/invalid link): shows "Request a new reset link" button.

src/lib/email/templates.ts
buildPasswordResetEmail({ actionLink }): branded HTML template with
"Reset password" CTA button, 1-hour expiry note, and "didn't request
this" safety copy.

src/lib/email/resend.ts
sendPasswordResetEmail({ recipientEmail, actionLink }): sends via
ACCOUNT_EMAIL (noreply@aitomicflow.com). Returns bool, never throws.

src/components/auth/login-form.tsx
"Forgot password?" link added to the right of the Password label.

src/middleware.ts
/auth/forgot-password and /auth/reset-password added to PUBLIC_ROUTES.

scripts/verify-password-reset.mjs (new)
End-to-end verification script (no email required):

- Admin generates a real recovery link
- Tests PKCE path via verifyOtp(token_hash)
- Tests implicit path via setSession(access_token, refresh_token)
  Usage: node --env-file=.env.local scripts/verify-password-reset.mjs <email>

41. REPORTING ENRICHMENT — USER PERFORMANCE, VOLUME TREND, FLOW ADOPTION (COMPLETE ✅)
    Build: clean (commit fd8f8b1). Three new reporting features added without breaking existing reports.

─── Overview ─────────────────────────────────────────────────────────────────

Three reporting gaps identified and filled in one session:

1. No per-user performance data (only "pending at who" snapshot on dashboard).
2. No visual trend showing whether volume is growing or declining over time.
3. No way to see which flows are stale / never triggered.

─── Feature 1: User Performance Report (/admin/reports/users) ───────────────

New admin-only route following the same server + client component pattern as
the existing Flow Performance and SLA Adherence reports.

Data: step_instances for the tenant (1-year lookback for tenant isolation;
period-filtered on step.created_at). Aggregated per user:

- Total assigned, completed, currently pending
- Avg completion time (hours from created_at to completed_at)
- On-time rate (completed before due_at / total with due_at set)
- Last active date (max completed_at in period)

UI (users-report-client.tsx — 'use client'):

- 4 summary stat cards: Active Users, Tasks Completed, Avg Completion Time,
  On-time Rate (colour-coded green/amber/red by threshold).
- Period tabs (7d / 30d / 90d / all-time) with plan lock gates matching other reports.
- Per-user table: sortable by Most Done / Fastest / Late Rate.
  Columns: User (name + email), Assigned, Completed (with %), Pending
  (red ≥5 / amber ≥3), Avg Time, On-time %, Last Active.

Nav: "User Performance" item added to the Reports group in nav-items.ts (Users icon).

─── Feature 2: Dashboard Volume Trend Chart ─────────────────────────────────

SVG line chart inserted between the stat cards and the Flow Breakdown table
on the /dashboard page. No client component needed — rendered server-side as
inline SVG math.

Two series: Triggered (amber #f59e0b) and Completed (green #10b981).

- 7d / month / 30d periods: daily buckets.
- 90d period: weekly buckets (13 data points).
- X-axis: smart label interval (≤6 labels regardless of bucket count).
- Subtle area fill under the completed line for visual depth.
- Hidden entirely when all data is zero (avoids flat-line noise).

Implementation: computeDailyTrend() helper + TrendChart() component, both
added to dashboard/page.tsx. dailyTrend is returned from getDashboardData()
alongside the existing stat card data.

─── Feature 3: Flow Adoption in Flow Performance Report ─────────────────────

Two enhancements to /admin/reports/flows:

1. Last Triggered column added to the per-flow table.
   - All-time last triggered date fetched via a parallel query (1-year lookback,
     ordered DESC — first occurrence per flow = most recent).
   - Falls back to periodLastCreatedAt if the all-time query has no data for the
     flow within the year window.
   - Staleness colour coding: grey = < 7 days, amber = 7–29 days,
     red = 30+ days, red "Never" for flows never triggered in 12 months.

2. Zero-instance flows included. The per-flow table previously only showed
   flows that had at least one instance in the selected period. Now all tenant
   flows are fetched (allFlowsData query) and flows with no period activity are
   added as rows with total=0, sorted last by run count. Admins can see stale /
   unused flows even when filtering to a short period.

FlowStat interface extended: lastTriggeredAt: string | null.
FlowAccum extended: periodLastCreatedAt: string | null.
flows-report-client.tsx: LastTriggeredCell component, colspan 7 → 8.

─── Files changed ────────────────────────────────────────────────────────────

New: src/app/(app)/admin/reports/users/page.tsx
New: src/app/(app)/admin/reports/users/users-report-client.tsx
Modified: src/components/shell/nav-items.ts
Modified: src/app/(app)/dashboard/page.tsx
Modified: src/app/(app)/admin/reports/flows/page.tsx
Modified: src/app/(app)/admin/reports/flows/flows-report-client.tsx

42. KB: STEP REFERENCE ARTICLES — 10 TOPICS EN + VI (COMPLETE ✅)
    Migration: supabase/migrations/20260602010000_kb_steps.sql
    Applied to production (qdngvdffqsnqikqbhkmw) via Supabase MCP.
    Committed: 2898278.

─── Gap filled ───────────────────────────────────────────────────────────────

The knowledge base had zero articles explaining Steps — the core building block
of every workflow. Users could not self-serve answers to: "What types of steps
exist?", "What is a radio field vs dropdown?", "Why does my branch always take
the No path?", "What does escalation do?", "Who gets assigned this step?"

─── 10 articles added (EN + VI = 20 DB rows) ────────────────────────────────

| Slug                           | Category  | Topic                                                                                       |
| ------------------------------ | --------- | ------------------------------------------------------------------------------------------- |
| understanding-step-types       | technical | Trigger, Action, Branch, Complete — what each is, config options, typical patterns          |
| step-form-field-types          | technical | All 8 field types with use-case guidance and quick-reference table                          |
| required-vs-optional-fields    | how-to    | Required flag behaviour, impact on branch routing (empty = false = No path), best practices |
| choice-fields-guide            | how-to    | Dropdown vs Radio vs Checkbox — differences, branch operators, common mistakes              |
| date-and-datetime-fields       | how-to    | Date-only vs date-time, branch operators (static values only), SLA independence             |
| step-escalation-guide          | how-to    | Escalation vs SLA, config, fires-once behaviour, manager requirement, FAQ                   |
| assignee-rule-types-reference  | technical | All 7 rule types with requirements, use cases, and failure troubleshooting table            |
| how-branch-conditions-work     | technical | All operators, AND logic, empty field behaviour, testing before publish                     |
| step-naming-best-practices     | how-to    | Label vs description, verb-noun format, naming Branch/Complete nodes                        |
| form-data-in-branch-conditions | technical | Upstream data model, which field types evaluate in branches, design-first pattern           |

Each article cross-links to related ones. VI counterparts use `-vi` slug suffix.
All inserted with ON CONFLICT (slug) DO NOTHING (safe to re-run).

43. KB: FLOW LOOP NOT SUPPORTED — CORRECTION & NEW ARTICLE (COMPLETE ✅)
    Migration: supabase/migrations/20260602020000_kb_flow_loop_not_supported.sql
    Applied to production (qdngvdffqsnqikqbhkmw) via Supabase MCP.
    Committed: 43f5e9d.

─── Background ───────────────────────────────────────────────────────────────

User emailed support@aitomicflow.com asking whether loop/cycle flows were
possible. The AI responder replied twice with detailed incorrect instructions
saying loops ARE supported and explaining how to route a step back to an earlier
node. The conversation (ticket f2d2689f) confirmed the bad answers.

Root cause: no KB article existed covering this topic. The AI had no grounding
and confabulated a plausible-sounding but wrong answer.

─── What was verified in the codebase ───────────────────────────────────────

FlowCanvas.tsx:173–187 — Rule 2 of isValidConnection runs BFS from the target
node before accepting any new connection. If the BFS reaches the source node,
the connection is rejected. This makes it impossible to draw a cycle in the UI.

The runtime (advanceFlow in actions.ts) reads graph.edges to find the next step
with no visited-node tracking — a cycle in the stored graph would produce
infinite step_instance inserts until timeout. The data model (single
current_step_id, append-only step_instances, no iteration counter) provides no
support for loop semantics either.

─── KB articles added (EN + VI) ─────────────────────────────────────────────

slug: flow-loop-not-supported / flow-loop-not-supported-vi
category: technical

Content:

- Clear "No" answer up front
- Three-level explanation: canvas BFS check, runtime engine, data model
- Three alternative patterns with canvas diagrams:
  1. Rejection → Revise → Re-submit (explicit revision steps, recommended)
  2. Re-trigger a new flow instance on rejection
  3. Multi-round review as explicit steps on the same canvas

─── Ticket correction ────────────────────────────────────────────────────────

Ticket f2d2689f ("how to setup a flow with looping?", status was ai_replied):

- Corrective outbound message inserted into the thread, apologising for both
  incorrect AI replies and giving the correct answer with link to the new article
- Ticket status set to pending_human so the admin can review before closing

─── KNOWN GOTCHA — AI hallucination on missing KB topics ────────────────────

When no KB article covers a topic and the AI cannot find a match via full-text
search, it may fall through to its training-data knowledge and produce a
plausible but incorrect answer. The fix is always to add a KB article — not to
tune the confidence threshold. A "high confidence wrong answer" is worse than
"low confidence routed to human".

Pattern to follow when a bad AI reply is discovered:

1. Read FlowCanvas / actions.ts to confirm the true behaviour
2. Add a KB article with the correct answer + alternatives
3. Correct the ticket thread and set status = pending_human
4. Commit the migration so the correction is reproducible

─── KNOWN GOTCHAS ────────────────────────────────────────────────────────────

PKCE vs implicit: @supabase/ssr uses PKCE by default — recovery URLs contain
?code=xxx, not #access_token=xxx. The reset-password page handles both.
Checking only the hash (old approach) causes "invalid reset link" on every
real email link.

User enumeration: server action always returns { success: true } and shows
a generic "if this email has an account…" message. Never reveal whether an
email exists.

Supabase redirect URL allowlist: https://www.aitomicflow.com/auth/reset-password
must be in Supabase Dashboard → Authentication → URL Configuration → Redirect
URLs, otherwise the recovery link redirect is blocked by Supabase.

45. KB: FLOW LIFECYCLE ARTICLES — 8 TOPICS EN + VI (COMPLETE ✅)
    Migration: supabase/migrations/20260603010000_kb_flow_lifecycle.sql
    Applied to production (qdngvdffqsnqikqbhkmw) via Supabase MCP.

─── Gap filled ───────────────────────────────────────────────────────────────

The AI support responder self-rates "high" confidence even when KB articles are
sparse, falling back to general workflow-tool knowledge. These 8 articles cover
the highest-risk app-specific behaviours where that general knowledge produces
wrong or misleading answers.

─── 8 articles added (EN + VI = 16 DB rows) ─────────────────────────────────

| Slug                              | Category  | Topic                                                               |
| --------------------------------- | --------- | ------------------------------------------------------------------- |
| flow-draft-vs-published           | how-to    | Draft vs Published state; why a flow can't be triggered             |
| flow-instance-statuses            | technical | Pending/Completed/Cancelled/Error — what each means, what to do     |
| flow-editing-and-active-instances | technical | Republishing never affects running instances (versioning behaviour) |
| how-to-cancel-a-flow-instance     | how-to    | Admin-only; permanent; what happens to pending steps                |
| how-to-reassign-a-pending-step    | how-to    | Single-step and bulk reassign; admin-only; offboarding pattern      |
| why-flow-not-visible              | how-to    | Draft / dept restriction / no dept / deactivated / wrong page       |
| export-instance-data-csv          | how-to    | Instances + attachments export; filters; 7-day signed URLs          |
| sla-calendar-hours                | technical | Calendar hours 24/7; UTC storage; planning table; escalation same   |

KNOWN GOTCHA — AI hallucination on app-specific behaviour: the responder's
system prompt instructs Claude to rate "high" confidence whenever it believes it
knows the answer — even with no KB match. Articles must exist for every
non-obvious, app-specific behaviour. "No KB article" is never the right fix;
adding the article is.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 46. KNOWLEDGE BASE — COMPLETE ARTICLE INVENTORY (CURRENT STATE)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

118 total rows in production (59 EN + 59 VI counterparts, suffix -vi).
All articles active. Full-text search via GIN index on search_vector.
Managed at /platform/support/knowledge. Public at /help/[slug].

── account (9 EN) ────────────────────────────────────────────────────────────

how-to-sign-up How to Sign Up
how-to-accept-invitation How to Accept an Invitation
how-to-update-profile How to Update Your Profile
how-to-enable-mfa How to Enable Two-Factor Authentication
how-to-sign-in-with-google How to Sign In with Google
how-to-invite-users How to Invite Users
reset-password Resetting Your Password
onboarding-emails-explained Why Am I Receiving Onboarding Emails? ← §49
getting-started-checklist Getting Started Checklist (admin) ← §47

── billing (3 EN) ────────────────────────────────────────────────────────────

pricing-and-plans Pricing and Plans
how-to-check-plan-usage How to Check Your Plan and Usage
ai-features-and-credit-usage AI Features and Credit Usage

── general (3 EN) ────────────────────────────────────────────────────────────

what-is-aitomic-flow What is Aitomic Flow?
user-roles-in-aitomic-flow User Roles in Aitomic Flow
how-to-rename-organisation How to Rename Your Organisation

── how-to (34 EN) ────────────────────────────────────────────────────────────

how-to-create-workflow How to Create a Workflow
how-to-start-workflow How to Start (Trigger) a Workflow
how-to-complete-task How to Complete a Task
how-to-view-flow-history How to View Your Flow History
how-to-use-ai-flow-builder How to Use the AI Flow Builder
how-to-manage-departments How to Manage Departments
how-to-set-sla-deadlines How to Set Deadlines (SLA) on Workflow Steps
how-to-view-reports How to View Analytics and Reports
how-to-use-org-chart How to Use the Org Chart
how-to-deactivate-user How to Deactivate and Reactivate a User
how-to-use-flow-templates How to Use Flow Templates
how-to-bulk-import-users How to Bulk Import Users via CSV
how-to-configure-assignee-rules How to Configure Assignee Rules
how-to-configure-branch-conditions How to Configure Branch Conditions
how-to-setup-webhook-notifications How to Set Up Slack and Teams Notifications
how-to-use-flow-comments How to Use Flow Instance Comments
how-to-configure-ai-settings How to Configure AI Settings
available-flow-templates Available Flow Templates (catalog of 20 templates)
file-uploads-in-workflow-steps File Uploads in Workflow Steps
required-vs-optional-fields Required vs Optional Form Fields ← §42
choice-fields-guide Choice Fields: Dropdown, Radio, Checkbox ← §42
date-and-datetime-fields Date and Date-Time Fields ← §42
step-escalation-guide Step Escalation: Automatic Manager Notifications ← §42
step-naming-best-practices Step Names and Descriptions: Best Practices ← §42
flow-draft-vs-published Flow Draft vs Published: Why Can't I Trigger My Flow? ← §45
how-to-cancel-a-flow-instance How to Cancel a Running Flow Instance ← §45
how-to-reassign-a-pending-step How to Reassign a Pending Step to Another User ← §45
why-flow-not-visible Why a Flow Is Not Visible or Not Available to Trigger ← §45
export-instance-data-csv How to Export Flow Instance Data to CSV ← §45
getting-started-as-a-team-member Getting Started as a New Team Member ← §47
how-to-offboard-user How to Offboard a Team Member ← §50

── technical (14 EN) ─────────────────────────────────────────────────────────

understanding-workflow-versions Understanding Workflow Versions
understanding-audit-trail Understanding the Audit Trail
understanding-notifications Understanding Notifications
workflow-step-stuck-or-error What to Do If a Workflow Step is Stuck or Errors
understanding-step-types Understanding the Four Step Types ← §42
step-form-field-types Form Field Types Reference ← §42
assignee-rule-types-reference All Assignee Rule Types Explained ← §42
how-branch-conditions-work How Branch Conditions Work ← §42
form-data-in-branch-conditions How Form Data Flows to Branch Conditions ← §42
flow-loop-not-supported Can I Create a Loop in a Workflow? ← §43
flow-instance-statuses Understanding Flow Instance Statuses ← §45
flow-editing-and-active-instances What Happens to Running Flows When You Edit and Republish ← §45
sla-calendar-hours How SLA Due Dates Are Calculated (Calendar Hours) ← §45

── Migration history ─────────────────────────────────────────────────────────

20260415093000_knowledge_base_seed.sql Initial 22 EN articles
20260415094000_knowledge_base_vietnamese.sql 27 VI translations
20260529100000_knowledge_base_new_articles.sql Additional how-to articles
20260529200000_kb_update_notifications_and_comments.sql Updates to notification/comments articles
20260529210000_kb_vietnamese_missing_articles.sql Missing VI translations
20260530110000_kb_flow_templates.sql Flow templates how-to + catalog article (EN + VI)
20260602010000_kb_steps.sql 10 step reference articles (EN + VI) — §42
20260602020000_kb_flow_loop_not_supported.sql Loop not supported correction (EN + VI) — §43
20260603010000_kb_flow_lifecycle.sql 8 flow lifecycle articles (EN + VI) — §45
20260603020000_kb_onboarding_checklist.sql Getting started checklist article (EN + VI) — §47
20260603040000_kb_milestone_moments.sql Getting started as a team member (EN + VI) — §47
20260604020000_kb_onboarding_emails.sql Onboarding drip emails explained (EN + VI) — §49
20260604030000_kb_user_offboarding.sql User offboarding wizard guide (EN + VI) — §50

47. TENANT ONBOARDING — SETUP CHECKLIST & MILESTONE MOMENTS (COMPLETE ✅)
    Commits: 10e4171 (checklist), 98efda2 (M3 milestone moments)
    Migrations applied: 20260603020000, 20260603030000, 20260603040000

─── Admin setup checklist (M1) ──────────────────────────────────────────────

Component: src/components/onboarding/AdminChecklist.tsx
Actions: src/lib/onboarding/actions.ts → getAdminChecklistState()

7-step checklist shown to admins on /tasks and /flows pages until dismissed.
Steps are live-derived from DB counts — no stored boolean flags.

| #   | step_key      | Label                   | Destination  |
| --- | ------------- | ----------------------- | ------------ |
| 1   | renamedOrg    | Name your organisation  | /settings    |
| 2   | createdFlow   | Create your first flow  | /flows       |
| 3   | publishedFlow | Publish a flow          | /flows       |
| 4   | invitedUser   | Invite a team member    | /invite      |
| 5   | triggeredFlow | Trigger your first flow | /flows       |
| 6   | setupDept     | Set up a department     | /departments |
| 7   | enabledAi     | Enable AI features      | /settings    |

Dismiss button writes step_key='checklist_dismissed' to user_onboarding.
renamedOrg: checks tenants.name !== 'My Organization'.
triggeredFlow: checks flow_instances.triggered_by = current user id.

Sample flow banner: shown on /flows when all flows have "(Sample)" in name.
Disappears automatically when admin creates a real flow.

─── Milestone moments (M3) ──────────────────────────────────────────────────

Three one-time hooks that fire at meaningful lifecycle moments:

M3-1 — First user joins (src/lib/auth/invitation-actions.ts)
After markInvitationAccepted() completes, count active users in tenant
excluding the new joiner. If count === 1 (only the original admin), this is
the first team member — fire 'first_user_joined' notification to all admins.
Dedup: count is naturally 1 only once.

M3-2 — First flow completes (src/lib/flows/actions.ts)
notifyFirstFlowCompletion() helper wired into both completion paths in
advanceFlow(). Before firing, queries notification_logs for any existing
'flow_first_completed' row for the tenant. If count > 0, skip.
Admins see: "🎉 [FlowName] just ran end-to-end successfully. Your workspace is live!"

M3-3 — Non-admin first task (src/lib/flows/actions.ts + TaskDetailModal/StepFormModal)
submitStep() checks user_onboarding for step_key='first_task_completed'.
If absent, inserts it and returns milestone: 'first_task' in the response.
Both modal components detect milestone and show: "🎉 You completed your first task!"
Admin users are excluded (role check before the upsert).

New notification types: 'first_user_joined', 'flow_first_completed'
Migration 20260603030000: DROP + re-ADD notifications.type CHECK constraint.
KB article: getting-started-as-a-team-member (EN + VI) — non-admin first-session guide.

48. SECURITY — RLS ENABLED ON ADMIN-ONLY TABLES (COMPLETE ✅)
    Migration: supabase/migrations/20260604000000_enable_rls_admin_only_tables.sql
    Applied to production (qdngvdffqsnqikqbhkmw) via Supabase MCP.
    Commit: 6ef40e0

Three tables exposed to PostgREST without RLS — flagged as ERROR by Supabase
security advisor.

All three are accessed exclusively via createAdminClient() (service role),
which bypasses RLS entirely. Fix: enable RLS with no policies.
Result: service role access unchanged; direct PostgREST access via anon/
authenticated roles now returns 403.

| Table                  | Used by                                                 |
| ---------------------- | ------------------------------------------------------- |
| rate_limit_log         | src/lib/rate-limit.ts                                   |
| platform_ai_config     | src/lib/platform/ai-config-actions.ts + ai-responder.ts |
| platform_ai_usage_logs | src/lib/platform/ai-config-actions.ts + ai-responder.ts |

KNOWN PATTERN: any table accessed only via the admin/service-role client
should have RLS enabled with zero policies. Never leave public tables
without RLS even if they are "write-only" or "internal-only".

49. M2 — ONBOARDING EMAIL DRIP SEQUENCE (COMPLETE ✅)
    Commit: 4b66f41
    Migrations applied: 20260604010000, 20260604020000

Four timed emails sent to the workspace admin after signup. Each fires at
most once per tenant, deduped via notification*logs (email_type LIKE 'drip*%').
Cron route: GET /api/cron/drip — same CRON_SECRET guard as /api/cron/sla.
Runs daily at 1am UTC (added to vercel.json alongside SLA cron).

─── Email schedule ──────────────────────────────────────────────────────────

| email_type              | Window     | Condition                                        |
| ----------------------- | ---------- | ------------------------------------------------ |
| drip_day1_confirm_email | Days 1–3   | Admin's email_confirmed_at IS NULL in auth.users |
| drip_day2_team_waiting  | Days 2–5   | ≥1 pending invitation AND only 1 active user     |
| drip_day5_go_live       | Days 5–9   | ≥1 published flow AND zero flow_instances ever   |
| drip_week2_tips         | Days 14–20 | Unconditional — any active tenant                |

─── Implementation ───────────────────────────────────────────────────────────

Cron route: src/app/api/cron/drip/route.ts

- Fetches only tenants created within the last 20 days (windowStart filter)
- 7 parallel bulk queries upfront — no N+1 per tenant
- Builds in-memory Maps for: sentSet, adminByTenant, confirmMap,
  pendingInviteCount, activeUserCount, firstPublishedFlow, hasInstances
- auth.users email confirmation checked via db.auth.admin.listUsers()
  (service-role admin client only)

Templates: src/lib/email/templates.ts — 4 new builder functions:
buildDripConfirmEmail, buildDripTeamWaitingEmail,
buildDripGoLiveEmail, buildDripWeekTwoTipsEmail

Send functions: src/lib/email/resend.ts — 4 new sendDrip\*Email() functions.
logEmail() emailType union extended to include all 4 drip types.
All use ACCOUNT_EMAIL (not NOTIFICATION_EMAIL) — onboarding sender.

Migration 20260604010000: DROP + re-ADD notification_logs.email_type CHECK
to include drip_day1_confirm_email, drip_day2_team_waiting,
drip_day5_go_live, drip_week2_tips.

KB article: onboarding-emails-explained (EN + VI) — explains what each email
is, when it fires, and that each is sent at most once.

─── KNOWN GOTCHA — notification_logs.email_type CHECK ───────────────────────

Every new email type requires both a TypeScript type update (logEmail
interface in resend.ts) AND a SQL migration to DROP + re-ADD the CHECK
constraint on notification_logs.email_type. Adding the type in code without
the migration causes a DB constraint violation at send time (silent failure
logged to console, not surfaced to user).

50. USER OFFBOARDING — LEVEL 1 (COMPLETE ✅)
    Migration: supabase/migrations/20260604030000_kb_user_offboarding.sql
    Applied to production (qdngvdffqsnqikqbhkmw) via Supabase MCP.

The full offboarding wizard was already implemented in the codebase.
This section documents it for completeness.

─── What was already built ───────────────────────────────────────────────────

Component: src/components/users/offboarding-wizard.tsx
Entry point: src/components/users/user-profile-actions.tsx → "Offboard" button
Wired in: src/app/(app)/users/[id]/page.tsx

The wizard is shown on each user's profile page to admins when the target
user is active and is not the current admin themselves.

Steps (dynamic — only shown when applicable):

1. Overview — summary of all actions, confirm to start
2. Reassign pending tasks — pick replacement; calls bulkReassignTasks()
   from src/lib/flows/actions.ts; logs tasks_bulk_reassigned in audit_log
3. Clear direct reports — calls clearManagerRelationships() in users/actions.ts
4. Remove dept head roles — calls removeDeptHeadRoles() in users/actions.ts
5. Deactivate — calls deactivateUser() which: bans in Supabase Auth
   (876000h), sets is_active = false, logs user_deactivated in audit_log

Wizard snapshots the step list on open to prevent prop updates from
revalidatePath mid-flow shrinking the array and stranding currentStepIdx.

─── What was added in this session ──────────────────────────────────────────

KB article: how-to-offboard-user (EN + VI)

- Step-by-step wizard walkthrough
- "After offboarding" behaviour (flows continue, history preserved, reactivate anytime)
- Offboarding checklist including out-of-band steps (Slack, email access revocation)

─── KNOWN BEHAVIOUR ──────────────────────────────────────────────────────────

Flows triggered by the offboarded user that are still running continue to
completion. The flow engine does not check the triggerer's active status
at runtime — only the current step's assignee must be active to receive
task assignments. Deactivating a triggerer never orphans a running flow.

51. USER OFFBOARDING — LEVEL 2: TENANT CANCELLATION (COMPLETE ✅)
    Migrations:
    supabase/migrations/20260604040000_tenant_cancellation.sql
    supabase/migrations/20260604050000_kb_tenant_offboarding.sql
    Applied to production (qdngvdffqsnqikqbhkmw) via Supabase MCP.

Admins can schedule permanent workspace deletion from Settings → General.
A 7-day cooling-off period gives time to reverse the decision or export data.
On day 7 (±24 h), a Vercel cron job hard-deletes the tenant and all its data.

─── Schema changes ────────────────────────────────────────────────────────────

tenants.cancel_at (timestamptz, nullable) — deletion timestamp
tenants.status CHECK extended: 'active' | 'trial' | 'suspended' | 'cancelling'
audit_log.action CHECK extended: + 'account_cancellation_initiated' + 'account_cancellation_reversed'
notification_logs.email_type CHECK extended: + 'account_cancellation_confirmed' + 'account_cancellation_reversed'

The existing inline CHECK on tenants.status had an auto-generated name
(e.g. tenants_status_check3). The migration uses a DO block with a
pg_constraint query to find and DROP it before adding the new constraint.
Same DROP + re-ADD pattern applies to audit_log and notification_logs.

─── Flow ──────────────────────────────────────────────────────────────────────

1. Admin clicks "Cancel account" in Settings → General → Danger Zone
2. CancelAccountDialog (confirmation modal) lists all data that will be deleted
3. On confirm → initiateAccountCancellation() server action:
   - Sets tenants.status = 'cancelling', cancel_at = now() + 7 days
   - Calls buildExportCsvs() to generate users/flow-instances/departments CSVs
   - Sends cancellation confirmation email with CSV attachments via Resend
   - Logs account_cancellation_initiated in audit_log
4. CancellationBanner appears on Settings page with days-remaining countdown
   and "Undo cancellation" button
5. If admin clicks Undo → undoCancellation() server action:
   - Sets status = 'active', cancel_at = null
   - Sends cancellation-reversed email
   - Logs account_cancellation_reversed in audit_log
6. Nightly cron /api/cron/tenant-cleanup (0 2 \* \* \*) queries
   status = 'cancelling' AND cancel_at < now(), then for each tenant:
   a. Collects all user IDs from public.users
   b. Deletes each Supabase Auth user via db.auth.admin.deleteUser()
   c. Deletes tenant row — cascades to all public schema tables

─── Implementation ────────────────────────────────────────────────────────────

src/lib/settings/cancellation-actions.ts — 3 server actions:
getCancellationState() — returns { status, cancelAt }
initiateAccountCancellation() — schedules deletion, sends email + CSV
undoCancellation() — reverts to active, sends reversal email

src/lib/email/export-builder.ts — buildExportCsvs(db, tenantId)
Returns { users, flowInstances, departments } as CSV strings
Used as Buffer attachments by sendCancellationConfirmEmail()

src/lib/email/templates.ts — 2 new builder functions:
buildCancellationConfirmEmail() — deletion date, what gets deleted, undo CTA
buildCancellationReversedEmail() — active-again confirmation

src/lib/email/resend.ts — 2 new send functions:
sendCancellationConfirmEmail() — attaches 3 CSVs via Buffer.from(csvStr)
sendCancellationReversedEmail() — plain confirmation

src/lib/audit/log.ts — AuditAction + AuditTargetType extended:
AuditTargetType: + 'tenant'
AuditAction: + 'account_cancellation_initiated' + 'account_cancellation_reversed'

src/components/settings/CancellationBanner.tsx
— Amber warning banner with countdown and undo button
— Hides itself via useState after successful undo (no page reload needed)

src/components/settings/CancelAccountDialog.tsx
— Destructive "Cancel account" button + confirmation Dialog
— Lists all data categories being deleted

src/app/(app)/settings/page.tsx — General tab updated:

- Tenant query expanded: select('name, status, cancel_at')
- Shows CancellationBanner if status = 'cancelling'
- Shows Danger Zone with CancelAccountDialog if status ≠ 'cancelling'

src/app/api/cron/tenant-cleanup/route.ts — nightly hard-delete cron
Same CRON_SECRET Bearer guard as /api/cron/sla and /api/cron/drip

vercel.json — third cron entry: /api/cron/tenant-cleanup at 0 2 \* \* \*

─── KB articles added (122 total) ────────────────────────────────────────────

how-to-cancel-account (EN) — wizard walkthrough, cooling-off, undo steps
how-to-cancel-account-vi (VI)
data-after-cancellation (EN) — deletion timeline table, what gets deleted,
CSV export contents, how to export form data
data-after-cancellation-vi (VI)

52. AI FREE-PLAN GATE (COMPLETE ✅)
    Migration: supabase/migrations/20260604060000_kb_ai_plan_requirements.sql
    Applied to production (qdngvdffqsnqikqbhkmw) via Supabase MCP.

Tenant admins on the Free plan cannot enable AI features from Settings → AI.
The toggle is disabled and an amber upgrade callout is shown. Pro/Enterprise
admins are unaffected.

─── Changes ───────────────────────────────────────────────────────────────────

src/lib/ai/ai-settings-actions.ts — updateAISettings() server action:
Added plan guard: if aiEnabled=true is requested, queries tenants.plan first.
Returns error and aborts if plan = 'free'. Defence-in-depth — the UI also
blocks the call, but the server never trusts the client.

src/app/(app)/settings/page.tsx — AI tab data fetch:
Added tenants.plan query (parallel with getAISettings + getAIUsageLogs).
Passes plan={aiPlan} to AISettingsCard.

src/components/settings/AISettingsCard.tsx — UI gate:
Added plan: string prop + isFreePlan = plan === 'free' derived flag.
Amber notice rendered above the toggle when isFreePlan is true, with a
"Upgrade to Pro" link pointing to ?tab=billing.
Toggle disabled={isPending || isFreePlan}; toggle visually stays off.
Provider/model/key controls remain hidden (inside aiEnabled && block which
can never be entered when isFreePlan is true).

─── KB articles added (124 total) ────────────────────────────────────────────

ai-features-plan-requirements (EN) — what AI includes, who can enable it,
why toggle is disabled, credit usage,
own-key setup
ai-features-plan-requirements-vi (VI)

53. PHASE 17 — LEMON SQUEEZY PAYMENT INTEGRATION (COMPLETE ✅)
    Goal: enable self-service paid subscriptions via Lemon Squeezy (individual
    account — no business registration or tax code required). Pricing model:
    flat-rate (not per-seat). Free $0 / Pro $29/mo / Enterprise contact.

    Lemon Squeezy acts as Merchant of Record — handles all tax/VAT collection and
    remittance globally. Payouts to personal bank account or Wise.

    Completed: 2026-06-10. All 6 milestones shipped and verified in test mode.
    Commits: f1e8966 (M2–M5), 9a1a8c7 (fix use-server directive)

M1 — Lemon Squeezy account & store setup ✅ COMPLETE (manual)
Owner completed: account created, payout profile (Techcombank via CITAD),
Store "Aitomic Flow", Pro subscription product at $29/month flat, test mode
enabled, API key + webhook secret generated, 3 env vars added to .env.local
and Vercel dashboard.
Webhook URL: https://aitomicflow.com/api/webhooks/lemon-squeezy
Events: subscription_created, subscription_updated, subscription_cancelled,
subscription_expired, order_created.

M2 — Landing page: flat-rate pricing + checkout URL ✅ COMPLETE
src/app/page.tsx: - Pro price hardcoded to "$29" (removed dynamic DB read) - priceNote: "per user / month" → "/ month" - ctaHref reads NEXT_PUBLIC_LS_PRO_CHECKOUT_URL (falls back to /signup) - CTA renders <a target="_blank"> for https:// links (LS checkout) - FAQ updated to flat-rate copy
NOTE: update plan_configs Pro max_users to 50 via /platform/plan-config.

M3 — Database migration: Lemon Squeezy fields on tenants ✅ COMPLETE
supabase/migrations/20260610000000_add_lemon_squeezy_to_tenants.sql
Columns added to tenants: lemon_customer_id TEXT, lemon_subscription_id TEXT,
lemon_renews_at TIMESTAMPTZ (all nullable). Applied to production Supabase.

M4 — Webhook handler: receive subscription events ✅ COMPLETE
src/app/api/webhooks/lemon-squeezy/route.ts: - HMAC-SHA256 + timingSafeEqual signature verification - Tenant resolved via meta.custom_data.tenant_id - subscription_created/updated → upgradeTenantToPro() - subscription_expired → downgradeTenantToFree() - subscription_cancelled → no-op (Pro kept until period ends) - Returns 500 on DB error (triggers LS retry), 401 on bad signature
src/lib/billing/lemon-actions.ts: - upgradeTenantToPro() / downgradeTenantToFree() via createAdminClient() - revalidateTag('plan-limits') called after every plan change
Middleware: /api/webhooks already in PUBLIC_ROUTES — no change needed.

M5 — In-app upgrade flow: enable upgrade button + portal link ✅ COMPLETE
src/app/(app)/settings/page.tsx — billing tab: - "Upgrade to Pro" buttons replaced with active <a> links to LS checkout
with ?checkout[custom][tenant_id]=${tenantId} appended - Falls back to disabled button if NEXT_PUBLIC_LS_PRO_CHECKOUT_URL unset - Pro subscribers: "Renews on [date]" + "Manage billing & invoices" link
→ https://app.lemonsqueezy.com/my-orders

M6 — End-to-end verification ✅ COMPLETE (2026-06-10, test mode)
Verified: - Test checkout (card 4242...) → webhook fires → tenants.plan = 'pro' - lemon_subscription_id and lemon_renews_at populated in Supabase - Settings billing tab shows Pro badge + renew date + portal link - Wrong HMAC signature → 401 confirmed - subscription_expired webhook → plan reverts to 'free' - npm run build passes clean

    KNOWN TRAP — tenant_id in checkout: ?checkout[custom][tenant_id]= must be
    present in the URL or the webhook cannot identify the tenant. Users who
    navigate directly to the LS checkout URL bypass this — webhook logs a warning
    and acks without upgrading.

    PRICING NOTE — plan_configs.price_per_user_cents is no longer used for
    landing page display (hardcoded $29) but still controls limits (maxUsers
    etc.) — do NOT remove it.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 54. PHASE 18 — PRODUCT HUNT LAUNCH (IN PROGRESS)
Goal: acquire first organic users and build public awareness via a
Product Hunt launch. Pricing advantage over Base.vn / MISA: flat $29/mo
vs per-seat billing. Target: Vietnamese SMBs + global English-speaking
ops/HR teams.

── Phase 1 — Prepare assets ✅ COMPLETE ─────────────────────────────────

LOGO (done ✅)
public/logo.png — full logo with wordmark (transparent background)
public/logo_icon.png — icon-only square for sidebar / favicon
src/app/icon.png — Next.js app favicon (copy of logo_icon.png)
Deployed: commit cf3a022 + fbde9db

GALLERY IMAGES (5 screenshots) ✅ DONE (2026-06-10)
Tool: GoFullPage Chrome extension → shots.so for browser frame
Browser: Chrome at 1440×900, 100% zoom 1. aitomicflow.com — hero section + pricing 2. aitomicflow.com — pricing cards (Free vs Pro) 3. /flows — flow canvas list view 4. /flows/[id]/edit — drag-and-drop canvas builder (most important) 5. /tasks — task inbox (daily user view)

DEMO VIDEO ✅ DONE
URL: https://www.loom.com/share/7292229cfbcc48a3bc2c55e119743ee0
90-second Loom walkthrough: flow builder canvas → step config → publish → trigger → task inbox → complete step → instance history.
Embed on landing page hero section above the fold.

TAGLINE (60 chars max) — final:
"Your team always knows what to do next"

DESCRIPTION (200 words) — draft:
Aitomic Flow is a no-code workflow and BPM tool that lets any team
design, run, and track business processes — without an IT department.
Most small and mid-size teams manage approvals, onboarding, and
operations through email threads, spreadsheets, and chat. Things get
missed. Deadlines slip. Nobody knows who owns what.
Aitomic Flow fixes that with a visual canvas where you drag and drop
steps, assign owners, set deadlines, and let the system do the chasing.
Key features:
→ Visual flow builder (drag-and-drop, no code)
→ Task inbox — every assignee sees exactly what to do next
→ SLA tracking and escalations
→ Slack and Teams notifications
→ AI-assisted flow building (Pro)
→ Role-based access, multi-department support
Free plan available. Pro is $29/month flat for up to 50 users.
Built for growing teams in operations, HR, finance, and customer service.

FIRST COMMENT / MAKER STORY — final:
"Hey PH! I'm Danny, and I built Aitomic Flow.

I kept seeing the same problem: smart, well-run teams were dropping the
ball — not because people were lazy, but because their processes lived
in email threads, WhatsApp groups, and 'just ask Sarah.' Approvals
stalled. Onboarding was inconsistent. Nobody knew what stage something
was at.

I wanted a tool that was powerful enough to replace monday.com or
Kissflow for real business workflows, but approachable enough that an
ops manager could set it up in an afternoon — no IT ticket required.

Aitomic Flow is the result: a visual canvas where you design your
process once, assign owners, set SLAs, and let the system handle the
follow-up. Every person on your team sees exactly what they need to do
next — nothing more, nothing less.

It's free to try. Pro is $29/month flat for up to 50 users — no
per-seat surprises.

Happy to answer anything about the product or the build
(Next.js + Supabase). 🛠️"

── Phase 2 — Create account and submit 🔜 TODO ──────────────────────────────

    1. Create maker account at producthunt.com (real photo, bio required)
    2. Go to producthunt.com/posts/new
    3. Fill in all fields:
       Name: Aitomic Flow
       Tagline: see draft above
       Website: https://aitomicflow.com
       Topics: Productivity, SaaS, No-Code, Project Management
       Pricing: Freemium
       Gallery: 5 screenshots from Phase 1
    4. Choose "Schedule for later" — DO NOT submit immediately

── Phase 3 — Pick launch time 🔜 TODO ───────────────────────────────────────

    Product Hunt resets at 12:01 AM PT (Pacific Time) daily.
    Best days: Tuesday or Wednesday
    Best time to launch: 2:01 PM Vietnam time (= 12:01 AM PDT, UTC-7)
    This gives the full 24-hour voting window.

── Phase 4 — Launch day playbook 🔜 TODO ────────────────────────────────────

    Hour 0 (2:01 PM Vietnam time):
    - Post in Vietnamese Facebook groups (startup, HR, ops communities)
    - Share on personal LinkedIn with genuine story post (not "go vote")
    - Message existing users directly (email or in-app)

    Hour 1:
    - Reply to every PH comment personally (engagement boosts ranking)
    - Post in Slack/Discord indie hacker and no-code communities

    Hours 2–8:
    - Keep replying to comments
    - Share in WhatsApp/Zalo groups of founders and ops professionals

    RULES:
    - Never say "upvote" — ask people to "check it out" or "leave feedback"
      (PH detects and discounts coordinated upvotes from inactive accounts)
    - Post the PH link with context, not as a bare link in groups

── Phase 5 — After launch 🔜 TODO ───────────────────────────────────────────

    - Answer every comment even outside top 5 (builds SEO and trust)
    - Screenshot ranking and post on LinkedIn next day regardless of result
    - Add "Featured on Product Hunt" badge to aitomicflow.com landing page
      (badge available at producthunt.com/badges)

── Landing page pre-launch checklist 🔜 TODO ────────────────────────────────

    Before sending any traffic to the landing page:
    - ✅ Demo video: https://www.loom.com/share/7292229cfbcc48a3bc2c55e119743ee0 — embed in hero section
    - Add Vietnamese copy option or at least Vietnamese hero section text
      (primary target market is Vietnamese SMBs)
    - Add "Book a demo" CTA alongside free signup

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 55. PHASE 19 — OUTBOUND WEBHOOKS & REST API GATEWAY (ROADMAP)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Theme: connect Aitomic Flow to the wider tooling ecosystem. Outbound event
webhooks let external systems react to flow events in real time. A REST API +
tenant API keys enable machine-to-machine flow triggering — unlocking Zapier,
Make.com, n8n, and custom integrations without writing platform-specific
connectors. Every event that already fires createNotification() and
sendWebhookNotification() is a ready-made source for this new layer.

M1 — Outbound event webhooks (custom URL subscriptions)

- Settings → Integrations: new "Custom Webhooks" section (alongside existing
  Slack/Teams URLs). Admin enters a URL and checks which events to subscribe to.
- Events: flow_triggered | step_completed | flow_completed | flow_cancelled | step_overdue
- Payload envelope (JSON): { event, tenantId, instanceId, flowId, flowName,
  stepId?, stepName?, actorEmail?, actorName?, occurredAt }
- Signing: each webhook URL has a platform-generated secret. Every POST includes
  X-Webhook-Signature: sha256=<HMAC-SHA256(secret, rawBody)> so receivers can
  verify authenticity. Mirrors the existing Lemon Squeezy verification pattern.
- Delivery: fire-and-forget with up to 3 retries (100ms / 1s / 5s backoff).
  Non-fatal — all delivery attempts logged to a new webhook_delivery_log table
  (id, webhook_id FK, event, status 'ok'|'failed', http_status, duration_ms, created_at).
- DB migration: tenant_custom_webhooks table (id, tenant_id, url, secret, events uuid[],
  is_active, created_at). Admin-only SELECT/UPDATE RLS via app_metadata path.
- Wired into: advanceFlow (step_completed, flow_completed) and triggerFlow
  (flow_triggered) in src/lib/flows/actions.ts alongside existing notification
  calls. SLA cron already handles step_overdue.

M2 — REST API trigger endpoint

- POST /api/v1/flows/:flowId/trigger
  Auth: Authorization: Bearer {api_key} header (not session cookie).
  Body: optional JSON { formData: { fieldId: value, ... } } to pre-fill the
  trigger step's form fields.
  Response: { instanceId, status: 'pending', detailUrl } (201) or error (400/403/404/429).
- Tenant isolation: API key is scoped to one tenant — cannot trigger flows
  belonging to other tenants. Validated by matching api key hash to tenant row.
- Rate limiting: 60 requests/minute per API key (same Supabase rate_limit_log
  pattern as signup/invite rate limiting in src/lib/rate-limit.ts).
- triggered_by set to the API key's owner (the admin who generated the key)
  so audit trail shows "triggered via API by admin@example.com".
- GET /api/v1/instances/:instanceId — returns instance status, current step,
  completed steps summary. Useful for polling from external systems.

M3 — API key management UI

- Settings → Integrations: "API Access" section (admin only).
- Generate key: creates a random 64-char hex key, shows it once in a copy-input
  (never stored in plaintext — only the SHA-256 hash stored in DB).
- tenant_api_keys table: id, tenant_id, name (label), key_hash TEXT, last_used_at,
  call_count_30d, created_by FK→users, created_at, revoked_at. Admin SELECT RLS.
- Rotate / Revoke per key. Multiple keys allowed (e.g., separate keys for
  Zapier and internal scripts). Revoked keys get a struck-through display.
- Usage stats: last used date + 30-day call count shown per key row.
- Public documentation note: POST body schema and event payload schemas
  documented in /help (KB article) so Zapier/Make builders can self-serve.

CROSS-CUTTING NOTES

- The X-Webhook-Signature pattern is identical to the existing Lemon Squeezy
  webhook verification in src/app/api/webhooks/lemon-squeezy/route.ts —
  reuse the timingSafeEqual pattern.
- Zapier / Make.com apps can be built on top of M1 (event webhooks) and M2
  (trigger API) without any platform-specific connector code on our side.
  Document the webhook format and trigger API in the KB under category 'technical'.
- Recommended build order: M1 → M3 → M2 (webhooks first unlocks Zapier
  polling; API keys needed before the trigger endpoint goes live).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 56. PHASE 20 — SCHEDULED / RECURRING TRIGGERS (ROADMAP)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Theme: flow instances that don't require a human to click "Start." A new
Schedule trigger node type lets admins configure flows to auto-fire on a
cron-style schedule — enabling recurring processes like weekly team standups,
monthly expense submission reminders, quarterly compliance checklists, and
daily shift handover reports. Builds on the Vercel cron infrastructure already
in use for the SLA digest and tenant cleanup jobs.

M1 — Schedule trigger node type in the flow builder

- New node type: 'schedule' (alongside 'trigger', 'action', 'branch', 'complete',
  'sub_flow'). Renders with a Clock icon and a violet tint to distinguish from
  the human-trigger node.
- Config panel (ScheduleConfigPanel): two input modes —
  Simple: frequency select (Daily / Weekly / Monthly) + time picker + day selector.
  Advanced: raw cron expression input with human-readable preview
  ("Runs every Monday at 08:00 ICT").
- scheduleConfig stored on NodeData in graph JSONB:
  { cronExpression: string, timezone: string }
  timezone defaults to the tenant admin's browser locale at creation time.
- Canvas validation: a Schedule node follows the same connection rules as the
  Trigger node — max 1 outbound edge, no inbound edges, one per graph.
- The existing Trigger node type is renamed "Manual Trigger" in the UI to
  distinguish it clearly. No schema change — just a label update.
- Builder preview: "Next run: Monday 16 Jun 2026, 08:00 ICT" computed from
  cronExpression + timezone using a lightweight cron parser library.
- triggerSave() on every config change (same pattern as SLA field in StepConfigPanel).

M2 — Vercel cron scanner (scheduled-flows runner)

- New route: GET /api/cron/scheduled-flows — secured by Authorization: Bearer
  {CRON_SECRET} (same guard as /api/cron/sla and /api/cron/tenant-cleanup).
- vercel.json: add entry "_/5 _ \* \* \*" (every 5 minutes) — tight enough to
  be within 5 minutes of the scheduled time, cheap enough to not abuse.
- Scanner logic:
  1. Query all published flows whose latest_version graph contains a node with
     type='schedule'. Fetch graph JSONB + flows.last_scheduled_at per flow.
  2. Parse cronExpression for each flow, compute the last expected fire time.
  3. Fire triggerFlow() for any flow where last_scheduled_at < last expected fire
     time (or last_scheduled_at IS NULL and flow was published before now).
  4. Update flows.last_scheduled_at = now() after a successful trigger.
- DB migration: ADD COLUMN last_scheduled_at TIMESTAMPTZ to flows +
  ADD COLUMN schedule_paused BOOLEAN NOT NULL DEFAULT FALSE.
- triggered_by set to null (system trigger) — same pattern as external API trigger.
  event log records actor as "Scheduled trigger" rather than a user name.
- Idempotency: the 5-minute cron window means a flow scheduled "every day at 08:00"
  will only fire once — the last_scheduled_at guard prevents double-firing.
- Tenant isolation: scanner uses adminClient scoped by tenant_id for each flow.

M3 — Scheduler management UI

- New admin-only page: /admin/scheduled-flows (add to nav under Admin group).
- Table columns: Flow name (links to editor), Schedule (human-readable from
  cronExpression), Timezone, Last run, Next run, Paused badge, Instances (30d),
  Pause/Resume button.
- "Run now" button fires a one-off triggerFlow() immediately (admin override),
  logging the actor as the admin user (not null). Useful for testing.
- Pause/Resume calls a new server action toggleSchedulePause(flowId, paused)
  which sets flows.schedule_paused. The scanner skips paused flows.
- Empty state: "No flows have a scheduled trigger yet. Open the flow builder
  and add a Schedule trigger node."
- /admin/scheduled-flows added to ADMIN_ONLY_ROUTES in middleware.ts.

CROSS-CUTTING NOTES

- Timezone handling: cronExpression is always stored in UTC-equivalent terms
  internally. The config panel converts the admin's local time to UTC before
  persisting. The human-readable preview converts back to the admin's locale
  for display.
- A flow can have either a Manual Trigger or a Schedule trigger — not both.
  The canvas validation prevents adding a second trigger-type node. If the admin
  wants both, they must clone the flow.
- Recommended build order: M1 (builder config) → M2 (runner) → M3 (management UI).
  M2 can be deployed with an empty scheduled-flows list and goes live the moment
  the first scheduled flow is published.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 57. PHASE 21 — PDF EXPORT OF COMPLETED FLOW INSTANCES (ROADMAP)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Theme: completed workflows need to live outside the app. HR teams want a PDF
of an approved leave request to attach to their payroll system. Finance teams
need a signed expense claim as a permanent record. Legal teams need the full
approval chain for audit. A downloadable PDF summary closes the loop between
digital workflow and the document-based processes that surround it.

M1 — PDF generation infrastructure

- Library: @react-pdf/renderer (pure Node.js, Vercel-compatible — no Puppeteer
  or headless Chrome required). Already available from npm; no new service needed.
- Server action: generateInstancePdf(instanceId) in src/lib/flows/pdf-actions.ts.
  Access gate: same rules as getFlowTimeline — triggerer, any step assignee,
  or tenant admin. Non-admin non-participants receive 403.
- API route: GET /api/flows/instances/[id]/pdf
  Calls generateInstancePdf(), pipes the React PDF stream to the response with
  Content-Type: application/pdf, Content-Disposition: attachment; filename="flow-{id}.pdf".
  Auth: session cookie (not API key) — same guard as other instance routes.
- 'use server' action alternative: for the admin batch path (M4), also expose
  a server action that returns a Buffer for ZIP assembly.

M2 — PDF template (InstancePdfDocument React PDF component)

- New file: src/lib/flows/pdf-template.tsx — React PDF Document component.
- Page header (on every page):
  Aitomic Flow logo (public/logo.png embedded as base64), flow name,
  Instance ID (monospace), status badge (Completed / Cancelled),
  created date and completed date.
- Per-step sections (one section per completed step_instance, sorted oldest→newest):
  Step name (bold, with type icon text: Action / Branch / Trigger / Complete).
  Assignee name + email. Completed date + time. Duration (created → completed).
  Form field table: two columns — Label | Value. File fields list filename(s)
  without embedding binaries (storage paths are private; filenames are sufficient).
  Branch steps: show the Yes/No decision taken with a visual indicator (→ Yes path).
- Footer (on every page): tenant name, "Generated by Aitomic Flow on {date}", page N of N.
- Page breaks inserted between steps (Document.wrap prop + Step component uses
  style={{ break: 'before' }} for longer steps).
- Colour palette: matches Aitomic Flow UI (slate headings, indigo accents,
  muted grey field values). PDF fonts: Helvetica (built-in, no font download).

M3 — Download button in instance detail panel

- "Download PDF" button added to InstanceDetailClient header area, positioned
  alongside the existing Cancel/Reassign admin action buttons.
- Visibility: shown only when flow_instance.status === 'completed'. Hidden for
  pending, cancelled, and error instances — incomplete data produces confusing PDFs.
- Access: same gate as the panel itself (triggerer, assignees, admin). No separate
  admin-only restriction — if you can see the detail panel, you can download.
- Behaviour: clicking opens /api/flows/instances/[id]/pdf in a new tab (simplest
  approach — browser handles the download prompt). No useTransition needed since
  the navigation is browser-side.
- Loading state: none needed (new tab opens immediately; PDF renders server-side).
- Added to both:
  - tasks-client.tsx slide-in panel (via InstanceDetailClient panel header)
  - /admin/instances slide-in panel (same component, already reused)

M4 — Batch PDF export from /admin/instances

- "Export PDFs (ZIP)" option added to the existing Export dropdown in
  instances-client.tsx (alongside current CSV options).
- Limit: 25 instances per batch. If the active filter returns more, warn and
  offer to narrow the filter first.
- Implementation: new API route GET /api/admin/export?type=pdf_zip
  1. Fetches all instance IDs matching the active filters (reuses existing
     filter logic from the CSV export route).
  2. Generates each PDF buffer in parallel (Promise.all with a concurrency
     cap of 5 to avoid memory pressure on Vercel).
  3. Assembles a ZIP in-memory using jszip (already installed as a dependency
     from an earlier phase or installed fresh — check node_modules).
  4. Streams the ZIP as application/zip with filename workflow-export-{date}.zip.
- Auth: same admin check as the existing /api/admin/export route.
- Timeout: Vercel function timeout is 60s (Pro plan). 25 PDFs at ~200ms each
  = ~5s total. Well within limit for typical instances.

CROSS-CUTTING NOTES

- @react-pdf/renderer renders at build time on the server — no client-side
  JS bundle impact. The PDF Document component cannot use React hooks or
  browser APIs; it is a pure data → layout mapping.
- File attachments: embed only filenames in the PDF, not binaries. Signed URLs
  expire in 60 seconds; embedding them is unreliable. Add a footer note:
  "Attachments stored securely in Aitomic Flow — download from the app."
- The KB article (how-to-export-flow-pdf) should clarify that PDFs include
  only completed steps — pending or skipped steps are omitted.
- Recommended build order: M1 → M2 → M3 → M4. M3 is visible to users
  immediately after M2. M4 (batch) can ship in a follow-up session.
