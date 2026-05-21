WORKFLOW SAAS — COMPLETE PROJECT KNOWLEDGE SUMMARYSolo Developer Build Log & Architecture Baseline Last Updated: Day 42 Completed (Phase 4 ✅ complete — QA, canvas position-save polish, tenant-isolation fix)1. PROJECT STACK & ENVIRONMENTCore TechnologiesFramework: Next.js 14.2.29 (App Router, TypeScript)UI Elements: shadcn/ui 2.3.0 + Tailwind CSS v3Database: Supabase (Postgres) — Region: Singapore (ap-southeast-1)Authentication: Supabase Auth (Email/Password + Google OAuth)Hosting: Vercel (connected to GitHub master branch with auto-deploys on push)Runtime Environment: Node.js v24.15.0Key Packages@supabase/ssr@0.6.1 & @supabase/supabase-js@2.49.4 (Supabase connectivity)@xyflow/react@12.3.6 (React Flow canvas rendering engine)zustand@4.5.7 (Lightweight client state for the React Flow canvas)@tanstack/react-table@8.21.3 (Dynamic tabular rendering)@dnd-kit/core@6.3.1, @dnd-kit/sortable@8.0.0, @dnd-kit/utilities@3.2.2 (Form field sorting)sonner@2.0.7 (Toasts) & lucide-react@1.11.0 (Icons)resend@4.0.0 (Email engine)Environment Variables (.env.local)NEXT*PUBLIC_SUPABASE_URL=your-supabase-url
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

Milestone 1 — Step due dates / SLA config

- Builder: add an optional "Due within N hours/days" control to StepConfigPanel; persist as slaHours on NodeData (lives in the graph JSONB — no schema change for the config itself).
- Runtime: when a step_instance is created in advanceFlow, compute due_at = now() + slaHours. Migration: add nullable due_at (timestamptz) to step_instances + index.
- Surface due_at in the task views (Pending tab) and instance detail.

Milestone 2 — Reminder & digest emails

- Scheduler: Vercel Cron (app is already on Vercel) → secured GET /api/cron/sla guarded by a CRON_SECRET header check (NOT middleware-auth, since cron has no session). Document the secret in .env.local + Vercel env.
- Scan pending step_instances: T-1d "due soon" reminders and "overdue" notices → Resend emails, logged to notification_logs (reuse existing table; may add email_type values 'sla_reminder' | 'sla_overdue').
- Daily per-assignee digest of open tasks. Be careful to de-dupe (don't re-send the same reminder each cron tick — track last-sent in notification_logs or a sent flag).

Milestone 3 — Overdue escalation

- When a step is overdue past a threshold, escalate to the assignee's manager (reuse resolve-assignee / users.manager_id). Policy configurable per step (escalate after N hours overdue) or a tenant default.
- Record as audit_log action 'step_escalated' (migration: extend the action CHECK set) and a flow_event_logs entry. Reuse logAuditEvent().

Milestone 4 — In-app notification center

- Migration: notifications table (id, tenant_id, user_id, type, title, body, link, read_at, created_at) + tenant/user RLS via the app_metadata path.
- Shell nav: a notification bell with unread count; Supabase Realtime subscription for live updates; mark-as-read + a "view all" page.
- Emit notifications on step_assigned, sla_reminder, escalation, flow_completed.

Milestone 5 — Dashboard SLA surfacing

- Add "Due soon" / "SLA breached" columns to the dashboard stat cards + bottleneck table, color-coded like the existing aging alerts (amber/red thresholds).

Cross-cutting notes

- Timezones: store due_at in UTC; render in the viewer's locale. Decide whether SLA hours are calendar hours or business hours (start with calendar hours).
- Tenant isolation: every new table/route must follow the app_metadata RLS path and the service-role-write pattern; extend GET /api/test/tenant-isolation to cover notifications (and any new tables).
- Idempotency: the cron path must be safe to run repeatedly without duplicate emails/escalations.
