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

Verified custom domain email delivery (noreply@bizflow.id.vn):
.env.local updated to RESEND_FROM_EMAIL=noreply@bizflow.id.vn (verified domain on Resend). No code change was required — resend.ts already reads const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev' at module load. The env-var swap was the only needed change. End-to-end verification via scripts/verify-invite.mjs confirmed Resend accepted the message with status=sent and a real resend_id, logged correctly to notification_logs with email_type='invite'.

Bug fix — InviteForm always showed success toast:
src/components/auth/invite-form.tsx was wrapping inviteUser() in a try/catch. Since Next.js server actions return discriminated union results ({ success: true } | { success: false, error: string }) rather than throwing, the catch block never fired — every call appeared to succeed even when the action returned { success: false }. Fixed by removing the try/catch and checking result.success directly, calling toast.error(result.error) on failure. Duplicate-invite attempts now correctly show the "A user with this email already exists." error toast instead of a false success.

Code hygiene — resend.ts comment removal:
Removed a stale multi-line comment on the FROM_EMAIL line that referenced onboarding@resend.dev as a production fallback; the single const line is self-documenting.

PENDING — Production environment variables to add in Vercel:

- RESEND_FROM_EMAIL=noreply@bizflow.id.vn (invite + notification emails use verified domain)
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

M3 — Natural-language Branch Conditions 🔜 PLANNED

    In BranchConfigPanel, alongside the existing dropdown condition builder, add a
    text input: "Describe the condition in plain English" (e.g. "if the requested
    amount is more than 1000"). Claude parses it against the available upstream
    field list and returns a BranchCondition object (fieldId, operator, value,
    handleId). Falls back gracefully — if Claude cannot resolve the field, it
    explains why and leaves the form for manual input.

    Implementation sketch:
    - Server action parseConditionFromText(text, availableFields, handleId) in
      src/lib/ai/condition-parser.ts. availableFields passed as context so Claude
      can map natural-language names to real fieldIds.
    - On success: merges the returned condition into the branch config via the
      existing updateNodeData() store action.

M4 — Flow Trigger Assistant 🔜 PLANNED

    On the "My Flows" / trigger page, a conversational input: "What do you need to
    do today?" Claude matches the description against published flows available to
    the user's department, suggests the best match with a confidence note, and
    pre-fills any form fields it can infer from the description. User reviews and
    confirms before the flow is triggered.

    Implementation sketch:
    - Server action suggestFlowForRequest(userText, availableFlows) in
      src/lib/ai/trigger-assistant.ts. availableFlows is a lightweight list
      (id, name, description, first-step field list) — not full graphs.
    - Returns { flowId, confidence, prefillData: Record<fieldKey, value> }.
    - UI: collapsible AI panel above the manual flow list on /my-flows.

M5 — SLA Suggestions from History 🔜 PLANNED

    When a builder configures a step SLA for the first time, Claude (augmented with
    real step_instances data) suggests a value based on historical completion times
    for similar steps across the tenant. Shown as a hint: "Steps like this have
    historically taken 4–6 h — suggest 8 h SLA?"

    Implementation sketch:
    - Server action suggestSlaForStep(stepLabel, tenantId) in
      src/lib/ai/sla-suggestions.ts. Queries avg/p90 completed_at - created_at
      from step_instances grouped by a fuzzy label match, passes the stats to
      Claude to produce a human-readable suggestion + recommended slaHours value.
    - StepConfigPanel shows the hint below the SLA input when the field is empty
      and a suggestion is available (lazy-loaded on first focus).

    PREREQUISITE: meaningful step_instances history in the tenant (suggestion
    skipped / hidden when fewer than 10 comparable historical steps exist).

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
