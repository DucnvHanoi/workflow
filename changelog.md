# Changelog

Solo developer build log. One entry per completed day.

---

## Phase 1 — Foundation (Days 1–22) ✅

### Day 1 — Repo & Tools

Next.js 14 + TypeScript + Tailwind + shadcn/ui scaffold. ESLint, Prettier, Husky pre-commit hook configured.

**Key fix:** shadcn `globals.css` generated `@apply border-border` which doesn't exist in Tailwind v3. Replaced with `hsl(var(--border))` directly.

---

### Day 2 — Supabase Setup

Supabase CLI installed as devDependency (not global). `@supabase/supabase-js` + `@supabase/ssr` installed. First migration: `public.tenants` table with RLS. Browser and server Supabase clients created.

---

### Day 3 — Core Tables

`public.users` (role, manager_id, department_id, tenant_id FK) and `public.departments` (self-referential parent_id) migrations with RLS policies.

---

### Day 4 — Runtime Tables

`public.flows`, `public.flow_versions`, `public.flow_instances`, `public.step_instances`, `public.step_attachments` with full RLS + `set_updated_at()` trigger. Circular FK between `flows` and `flow_versions` resolved with `ALTER TABLE`.

---

### Day 5 — Supabase Auth [Milestone]

Email provider + Google OAuth configured. Auth callback route (`/auth/callback`). Session refresh middleware. JWT verified in Supabase Studio.

---

### Day 6 — Next.js Auth Wiring

Server/browser client helpers verified. Login placeholder. Dashboard with server-side auth guard. Root route redirect logic (`/` → `/dashboard` or `/login`).

---

### Day 7 — JWT Custom Claims

`custom_access_token_hook` Postgres function injects `tenant_id` + `role` into JWT `app_metadata` on every sign-in. Registered as Auth Hook in Supabase Dashboard. All RLS policies updated to read from `app_metadata` path. FK chain corrected (`users.id → auth.users.id`).

**Key fix:** Function required `SECURITY DEFINER + SET search_path = public` or it silently fails. Hook must be deleted and re-added in dashboard after any function change.

---

### Day 8 — Login Page

Production `/login`: email/password form + Google OAuth button. Friendly error messages. Loading states with spinners. Redirects to `/dashboard` on success.

---

### Day 9 — Invite Flow

Admin `/invite` page. `inviteUser()` server action using `adminClient.auth.admin.generateLink()`. Pre-inserts `public.users` row with tenant_id + role before user accepts. `/auth/confirm` client page handles hash-fragment tokens from Supabase invite links. `/account-setup` page for first-time name + password setup.

**Key fix:** Supabase invite redirect uses hash fragment (`#access_token=...`), not query params — server routes can't read it. Created client-side `/auth/confirm` page to parse the hash and call `setSession()`.

---

### Day 10 — Route Protection [Milestone]

Middleware redirects unauthenticated users to `/login`. Admin-only routes (`/invite`, `/users`, `/departments`, `/admin/*`) redirect non-admins to `/unauthorized`. JWT decoded in Edge Runtime via `atob()` (no Node.js crypto available there).

---

### Day 11 — Users List Page

Admin `/users` table using `@tanstack/react-table` v8. Global search + column sorting. Nested Supabase query for departments + manager via `!manager_id` FK hint. `UserRow` type inferred from query return type.

---

### Day 12 — Role Edit & Delete

Per-row actions (⋯ dropdown). `updateUserRole` + `deleteUser` server actions via `adminClient`. Role change forces session invalidation (`auth.admin.signOut`) so user gets fresh JWT on next login. Self-demotion and self-deletion both blocked.

**Key pattern established:** All server action writes use `adminClient` to avoid silent RLS failures. Caller identity always verified via `getSessionClaims()` first.

---

### Day 13 — Departments Page

Admin `/departments`. Create / rename / delete with guards: blocks delete if users are assigned. Duplicate name check is case-insensitive (`ilike`).

---

### Day 14 — Department Hierarchy

`parent_id` self-reference supporting up to 3 levels. `buildDepartmentTree()` + `flattenTree()` utilities in `src/lib/departments/tree.ts`. Edit dialog supports reparenting with circular reference detection and max-depth enforcement.

---

### Day 15 — Manager Assignment [Milestone]

`updateUserManager()` server action. Edit manager dialog with `__none__` sentinel value to clear manager. `/users/[id]` profile page showing org chain (User → Manager → Skip-level). Self-assignment blocked server-side.

**Key fix:** Supabase self-join returned wrong direction with FK hints. Replaced with two separate queries + a `managerMap` lookup object.

---

### Days 16–19 — resolveAssignee() Edge Function [Milestone]

Supabase Edge Function (Deno) deployed with all 5 rule types fully implemented:

| Rule                   | Logic                                                                       |
| ---------------------- | --------------------------------------------------------------------------- |
| `fixed`                | Look up user by email within tenant                                         |
| `manager_of_requestor` | Read `manager_id` from requestor row                                        |
| `skip_level`           | Chain `manager_id` twice; falls back to direct manager if skip-level absent |
| `department_head`      | First user in department ordered alphabetically                             |
| `role_in_dept`         | First user in department matching given role, ordered alphabetically        |

Deno unit tests written for `fixed`, `manager`, and `skip_level` rules using a mock Supabase client (no real DB calls).

---

### Day 20 — App Shell & Role-Based Nav (Plan Days 21+22 combined)

`(app)` route group with shared `layout.tsx`. Sidebar with nav items filtered by JWT role claim. Topbar with tenant name + user initials avatar. Sign-out button. All existing authenticated pages moved into `(app)/` route group.

**Note:** One day ahead of schedule from this point.

---

### Day 21 — Error Boundaries, Toasts & Skeleton Loader (Plan Days 23+24 combined)

`error.tsx` + `not-found.tsx` within the `(app)` route group. Sonner toast notifications replace manual error/success string state across all forms. `PageSkeleton` components (`TableSkeleton`, `StatCardSkeleton`, `ContentSkeleton`) added for Phase 4. All forms converted to `useTransition` pattern.

---

### Day 22 — Tenant Isolation Test [Milestone]

`GET /api/test/tenant-isolation` dev-only route created. Ran against all 8 core tables with a real Tenant B test user. Found and fixed 4 stale RLS policies (wrong JWT path or missing `WITH CHECK`). All 8 tables confirmed isolated — Tenant B sees zero Tenant A rows.

**Phase 1 complete. All milestones passed.**

---

### Day 23 — Infrastructure & Docs (today)

`MIGRATIONS.md`, `README.md`, `CHANGELOG.md` written. Vercel project connected to GitHub repo.

---

## Phase 2 — Flow Builder (Days 24+)

_Starting next session._
