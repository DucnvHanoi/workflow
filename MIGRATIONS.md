# Migrations

All Supabase migrations live in `supabase/migrations/`. Run `npx supabase db push` to apply pending migrations to the linked cloud project.

---

## Migration Order & Purpose

| #   | File (prefix = timestamp)        | Purpose                                                                                                                                                       |
| --- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `*_create_tenants_table.sql`     | `public.tenants` table + RLS tenant isolation policy                                                                                                          |
| 2   | `*_create_users_departments.sql` | `public.users` (role, manager_id, department_id, tenant_id FK) + `public.departments` (self-referential parent_id) + RLS policies on both                     |
| 3   | `*_create_runtime_tables.sql`    | `public.flows`, `public.flow_versions`, `public.flow_instances`, `public.step_instances`, `public.step_attachments` + RLS on all + `set_updated_at()` trigger |
| 4   | `*_custom_jwt_claims.sql`        | `public.custom_access_token_hook()` — injects `tenant_id` + `role` into JWT `app_metadata` on every sign-in. Registered as Auth Hook in Supabase Dashboard.   |
| 5   | `*_fix_rls_jwt_path.sql`         | Updated all RLS policies from `auth.jwt() ->> 'tenant_id'` (stale) to `(auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid` (correct path after hook)        |
| 6   | `*_add_fullname_to_users.sql`    | `ALTER TABLE public.users ADD COLUMN full_name text`                                                                                                          |

---

## Standard RLS Pattern

Use this pattern on every new table going forward.

```sql
-- SELECT / UPDATE / DELETE (tenant isolation)
USING (
  tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
)

-- INSERT (tenant isolation)
WITH CHECK (
  tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
)

-- Admin-only access
USING (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
)
```

---

## Auth Hook (Critical)

The `custom_access_token_hook` function **must** be registered in Supabase Dashboard:

> **Authentication → Auth Hooks → Customize Access Token (JWT) Claims**
> Type: Postgres function | Schema: public | Function: custom_access_token_hook | Status: ENABLED

Without this hook, all RLS policies will silently fail — the JWT `app_metadata` will be empty and every query will return zero rows.

If the hook stops working silently: delete it from the dashboard and re-add it. This forces Supabase to re-register the function.

---

## RLS Policies Fixed (Day 22)

Four stale policies were found and fixed during the tenant isolation test:

| Table     | Policy                    | Problem                                   | Fix                                            |
| --------- | ------------------------- | ----------------------------------------- | ---------------------------------------------- |
| `tenants` | `tenant_isolation_select` | `::text` cast instead of `::uuid`         | Changed to `::uuid`                            |
| `users`   | `users_select`            | Using old top-level JWT path              | Dropped (covered by `tenant_isolation_select`) |
| `users`   | `users_delete`            | Old JWT path `auth.jwt() ->> 'tenant_id'` | Updated to `app_metadata` path                 |
| `users`   | `users_update`            | Old JWT path + missing `WITH CHECK`       | Updated path + added `WITH CHECK`              |

---

## Special Notes

- The `flows ↔ flow_versions` circular FK is resolved with `ALTER TABLE` after both tables exist (see migration 3).
- `step_attachments` has **no UPDATE policy** — uploaded files are immutable once stored.
- All server actions use `adminClient` (service role key) for writes to bypass RLS. The caller's identity is always verified manually via `getSessionClaims()` before any `adminClient` call.
- `supabase_auth_admin` and `postgres` roles have been explicitly granted `SELECT` on `public.users` to ensure the JWT hook can always read user data.

---

## Useful Commands

```bash
# Push pending migrations to cloud
npx supabase db push

# Create a new migration file
npx supabase migration new <migration_name>

# Check migration status
npx supabase migration list

# Reset local DB (wipes and replays all migrations)
npx supabase db reset

# Run tenant isolation test (dev only)
# GET http://localhost:3000/api/test/tenant-isolation
```
