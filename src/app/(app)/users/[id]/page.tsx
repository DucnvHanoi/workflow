// src/app/users/[id]/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server' // your existing server helper
import { getSessionClaims } from '@/lib/supabase/auth-helpers'
import { ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

// Fetch a user with up to 3 levels of manager chain
// Supabase doesn't support recursive joins, so we do 3 separate queries
async function getUserWithChain(userId: string, tenantId: string) {
  const supabase = createClient()

  // Level 1 — the user themselves
  const { data: u1 } = await supabase
    .from('users')
    .select('id, full_name, email, role, department_id, manager_id, created_at, departments(name)')
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

  // Line 58 then becomes safe:
  const profile = await getUserWithChain(params.id, claims.tenant_id)

  // Line 58 then becomes safe:

  if (!profile) redirect('/users')

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

  return (
    <div className="mx-auto max-w-2xl space-y-8 p-6">
      {/* Back link */}
      <Link href="/users" className="text-sm text-muted-foreground hover:text-foreground">
        ← Back to Users
      </Link>

      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
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
          <h1 className="text-2xl font-semibold">{profile.full_name ?? profile.email}</h1>
          <p className="text-sm text-muted-foreground">{profile.email}</p>
        </div>
        <Badge variant={profile.role === 'admin' ? 'default' : 'secondary'} className="ml-auto">
          {profile.role}
        </Badge>
      </div>

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
