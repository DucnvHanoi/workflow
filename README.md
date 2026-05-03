# Workflow SaaS

Multi-tenant workflow SaaS. Admins design approval/action flows on a drag-and-drop canvas. Users trigger flows and complete their assigned steps.

**Stack:** Next.js 14 · Supabase · Vercel · React Flow · shadcn/ui · TypeScript

---

## Prerequisites

- Node.js v18+ (project uses v24.15.0)
- npm v9+
- Supabase account + project (Singapore `ap-southeast-1` recommended)
- Google Cloud Console project (for OAuth)

---

## Local Development Setup

### 1. Clone & Install

```bash
git clone <your-repo-url>
cd workflow
npm install
```

### 2. Environment Variables

Create `.env.local` in the project root. **Never commit this file.**

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon_key>
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>

# App
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Get `SUPABASE_URL` and keys from: **Supabase Dashboard → Project Settings → API**

### 3. Link Supabase Project

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
```

### 4. Push Migrations

```bash
npx supabase db push
```

### 5. Configure Auth Hook (Required — do once)

In **Supabase Dashboard → Authentication → Auth Hooks**:

- Hook type: `Customize Access Token (JWT) Claims`
- Type: `Postgres function`
- Schema: `public`
- Function: `custom_access_token_hook`
- Click **Enable**

> Without this hook, all RLS policies fail silently and no data will be returned.

### 6. Configure Auth Providers

In **Supabase Dashboard → Authentication → Providers**:

- **Email:** Enable. Turn off "Confirm email" for development.
- **Google:** Enable. Add Client ID + Secret from Google Cloud Console.
  - Authorized redirect URI: `https://<ref>.supabase.co/auth/v1/callback`

### 7. Run Dev Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## First-Time Tenant Setup

1. Create a tenant row in Supabase Studio (SQL editor):

```sql
INSERT INTO public.tenants (name, plan)
VALUES ('Your Company', 'free')
RETURNING id;
```

2. Sign up via Google OAuth or create a user in Supabase Auth (Authentication → Users → Add user).

3. Create the matching `public.users` row:

```sql
INSERT INTO public.users (id, tenant_id, email, role)
VALUES ('<auth_user_id>', '<tenant_id_from_step_1>', 'you@example.com', 'admin');
```

4. Log in — you'll be routed to `/account-setup` to set your name and password.

After that, use `/invite` in the app to add more users.

---

## Key Commands

| Command                                                                              | Purpose                          |
| ------------------------------------------------------------------------------------ | -------------------------------- |
| `npm run dev`                                                                        | Start dev server on port 3000    |
| `npm run build`                                                                      | Production build                 |
| `npm run lint`                                                                       | ESLint check                     |
| `npx supabase db push`                                                               | Push pending migrations to cloud |
| `npx supabase migration new <name>`                                                  | Create a new migration file      |
| `npx supabase migration list`                                                        | Check migration status           |
| `npx supabase functions deploy resolve-assignee --no-verify-jwt --project-ref <ref>` | Deploy Edge Function             |
| `deno test --allow-env supabase/functions/resolve-assignee/index.test.ts`            | Run Edge Function unit tests     |

---

## Project Structure

```
src/
├── app/
│   ├── (app)/                  # Authenticated route group (shared shell layout)
│   │   ├── layout.tsx          # Sidebar + Topbar wrapper
│   │   ├── dashboard/
│   │   ├── users/
│   │   │   └── [id]/           # User profile + org chain
│   │   ├── departments/
│   │   ├── invite/
│   │   ├── account-setup/
│   │   ├── tasks/              # Phase 3
│   │   ├── my-flows/           # Phase 3
│   │   └── flows/              # Phase 2 (Flow Builder)
│   ├── login/
│   ├── auth/
│   │   ├── callback/           # OAuth PKCE exchange
│   │   └── confirm/            # Magic link / invite token handler
│   └── api/
│       └── test/               # Dev-only test routes
├── components/
│   ├── auth/
│   ├── departments/
│   ├── shell/                  # Sidebar, Topbar, SignOutButton, nav config
│   └── users/
└── lib/
    ├── supabase/
    │   ├── client.ts           # Browser client
    │   ├── server.ts           # Server client (reads cookies)
    │   ├── admin.ts            # Service role client (server actions only)
    │   └── auth-helpers.ts     # getSessionClaims() — reads JWT app_metadata
    └── departments/
        └── tree.ts             # buildDepartmentTree / flattenTree

supabase/
├── functions/
│   └── resolve-assignee/       # Deno Edge Function — all 5 assignee rule types
└── migrations/                 # See MIGRATIONS.md
```

---

## Security Notes

- Every table has RLS enabled. See `MIGRATIONS.md` for the standard pattern.
- Server actions **always** use `adminClient` for writes + manually verify the caller via `getSessionClaims()`. The `adminClient` is never passed to or used in browser code.
- Run the tenant isolation test after any schema change: `GET /api/test/tenant-isolation` (dev only — blocked in production).
- No secrets in committed files. If a key is accidentally committed, rotate it immediately in Supabase Dashboard.

---

## Phase Progress

| Phase   | Description                                          | Status      |
| ------- | ---------------------------------------------------- | ----------- |
| Phase 1 | Foundation — auth, org structure, edge function      | ✅ Complete |
| Phase 2 | Flow Builder — React Flow canvas, form builder       | 🔜 Next     |
| Phase 3 | Runtime Engine — triggers, step forms, notifications | ⬜ Pending  |
| Phase 4 | Admin Dashboard & Export                             | ⬜ Pending  |
