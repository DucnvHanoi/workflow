// src/app/users/[id]/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionClaims } from '@/lib/supabase/auth-helpers'
import { ChevronRight, AlertTriangle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { UserProfileActions } from '@/components/users/user-profile-actions'

// Fetch a user with up to 3 levels of manager chain
// Supabase doesn't support recursive joins, so we do 3 separate queries
async function getUserWithChain(userId: string, tenantId: string) {
  const supabase = createClient()

  // Level 1 — the user themselves
  const { data: u1 } = await supabase
    .from('users')
    .select(
      'id, full_name, email, role, is_active, department_id, manager_id, created_at, departments!department_id ( name )'
    )
    .eq('id', userId)
    .eq('tenant_id', tenantId)
    .single()

  if (!u1) return null

  // Level 2 — their manager
  let manager = null
  if (u1.manager_id) {
    const { data: u2 } = await supabase
      .from('users')
      .select('id, full_name, email, role, manager_id')
      .eq('id', u1.manager_id)
      .eq('tenant_id', tenantId)
      .single()
    manager = u2

    // Level 3 — manager's manager (skip-level)
    if (u2?.manager_id) {
      const { data: u3 } = await supabase
        .from('users')
        .select('id, full_name, email, role')
        .eq('id', u2.manager_id)
        .eq('tenant_id', tenantId)
        .single()
      if (u3) {
        manager = { ...u2, manager: u3 }
      }
    }
  }

  return { ...u1, manager }
}

type PageProps = { params: { id: string } }

export default async function UserProfilePage({ params }: PageProps) {
  const { user: sessionUser, claims } = await getSessionClaims()
  if (!sessionUser || claims.role !== 'admin') redirect('/unauthorized')
  if (!claims.tenant_id) redirect('/login')

  const profile = await getUserWithChain(params.id, claims.tenant_id)
  if (!profile) redirect('/users')

  const db = createAdminClient()

  // Pending task count for this user
  const { count: pendingCount } = await db
    .from('step_instances')
    .select('id', { count: 'exact', head: true })
    .eq('assigned_to', params.id)
    .eq('status', 'pending')

  // Active users, direct reports, and dept head roles — all in parallel
  const [{ data: activeUserRows }, { data: directReportRows }, { data: deptHeadRows }] =
    await Promise.all([
      db
        .from('users')
        .select('id, full_name, email')
        .eq('tenant_id', claims.tenant_id)
        .eq('is_active', true)
        .order('full_name', { ascending: true, nullsFirst: false }),
      db
        .from('users')
        .select('id, full_name, email')
        .eq('manager_id', params.id)
        .eq('tenant_id', claims.tenant_id),
      db
        .from('departments')
        .select('id, name')
        .eq('head_user_id', params.id)
        .eq('tenant_id', claims.tenant_id),
    ])

  const activeUsers = (activeUserRows ?? []).map((u) => ({
    id: u.id as string,
    full_name: (u.full_name ?? null) as string | null,
    email: u.email as string,
  }))

  const directReports = (directReportRows ?? []).map((u) => ({
    id: u.id as string,
    full_name: (u.full_name ?? null) as string | null,
    email: u.email as string,
  }))

  const deptHeadOf = (deptHeadRows ?? []).map((d) => ({
    id: d.id as string,
    name: d.name as string,
  }))

  // Build org chain array for display: [user, manager, skip-level]
  const chain: {
    id: string
    full_name: string | null
    email: string
    role: string
    isSelf?: boolean
  }[] = [{ ...profile, isSelf: true }]
  if (profile.manager) {
    chain.push({ ...profile.manager, isSelf: false })
    if ('manager' in profile.manager && profile.manager.manager) {
      chain.push({ ...profile.manager.manager, isSelf: false })
    }
  }

  const displayName = (u: { full_name: string | null; email: string }) => u.full_name ?? u.email

  const isSelf = sessionUser.id === params.id

  return (
    <div className="mx-auto max-w-2xl space-y-8 p-6">
      {/* Back link */}
      <Link href="/users" className="text-sm text-muted-foreground hover:text-foreground">
        ← Back to Users
      </Link>

      {/* Inactive banner */}
      {!profile.is_active && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>This account is deactivated. The user cannot log in.</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-4">
        <div
          className={`flex h-14 w-14 items-center justify-center rounded-full text-lg font-bold ${profile.is_active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}
        >
          {profile.full_name
            ? profile.full_name
                .split(' ')
                .map((n: string) => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2)
            : profile.email[0].toUpperCase()}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">{profile.full_name ?? profile.email}</h1>
            {!profile.is_active && (
              <Badge variant="outline" className="text-muted-foreground">
                Inactive
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{profile.email}</p>
        </div>
        <Badge variant={profile.role === 'admin' ? 'default' : 'secondary'} className="ml-auto">
          {profile.role}
        </Badge>
      </div>

      {/* Actions */}
      <UserProfileActions
        user={{
          id: profile.id,
          full_name: profile.full_name ?? null,
          email: profile.email,
          is_active: profile.is_active,
        }}
        pendingCount={pendingCount ?? 0}
        activeUsers={activeUsers}
        directReports={directReports}
        deptHeadOf={deptHeadOf}
        isSelf={isSelf}
      />

      {/* Details */}
      <div className="rounded-lg border p-4 space-y-3 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Department</span>
          <span>
            {Array.isArray(profile.departments) && profile.departments.length > 0
              ? (profile.departments[0] as { name: string }).name
              : '—'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Joined</span>
          <span>{new Date(profile.created_at).toLocaleDateString()}</span>
        </div>
      </div>

      {/* Org chain */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Reporting Chain
        </h2>

        {chain.length === 1 && !profile.manager_id && (
          <p className="text-sm text-muted-foreground">No manager assigned.</p>
        )}

        <div className="flex items-center flex-wrap gap-2">
          {chain.map((person, idx) => (
            <div key={person.id} className="flex items-center gap-2">
              {idx > 0 && <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
              <div
                className={`rounded-lg border px-3 py-2 text-sm ${
                  person.isSelf ? 'border-primary bg-primary/5 font-medium' : 'bg-muted/40'
                }`}
              >
                <div className="font-medium">{displayName(person)}</div>
                <div className="text-xs text-muted-foreground">{person.role}</div>
                {idx === 1 && <div className="text-xs text-muted-foreground">Manager</div>}
                {idx === 2 && <div className="text-xs text-muted-foreground">Skip-level</div>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
