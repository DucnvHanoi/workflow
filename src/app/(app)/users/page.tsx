import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSessionClaims } from '@/lib/supabase/auth-helpers'
import { UsersTable, type UserRow } from '@/components/users/users-table'
import { Button } from '@/components/ui/button'

export default async function UsersPage() {
  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          try {
            toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          } catch {}
        },
      },
    }
  )

  const { user, claims } = await getSessionClaims()
  if (!user) redirect('/login')
  if (claims.role !== 'admin') redirect('/unauthorized')

  // Query 1 — fetch all users with department (no self-join)
  const { data, error } = await supabase
    .from('users')
    .select(
      `
      id, email, full_name, role, created_at, manager_id,
      departments ( id, name )
    `
    )
    .order('full_name', { ascending: true, nullsFirst: false })

  if (error) {
    console.error('Failed to fetch users:', error.message)
  }

  const rawUsers = data ?? []

  // Query 2 — fetch managers for all manager_ids in one query
  const managerIds = Array.from(
    new Set(rawUsers.map((u) => u.manager_id).filter((id): id is string => id !== null))
  )

  const managerMap: Record<string, { id: string; full_name: string | null; email: string }> = {}

  if (managerIds.length > 0) {
    const { data: managerRows } = await supabase
      .from('users')
      .select('id, full_name, email')
      .in('id', managerIds)

    for (const m of managerRows ?? []) {
      managerMap[m.id] = {
        id: m.id,
        full_name: m.full_name ?? null,
        email: m.email,
      }
    }
  }

  // Build UserRow[] — no join ambiguity
  const users = rawUsers.map((u) => {
    const dept =
      Array.isArray(u.departments) && u.departments.length > 0
        ? u.departments[0]
        : !Array.isArray(u.departments) && u.departments
          ? u.departments
          : null

    return {
      id: u.id as string,
      email: u.email as string,
      full_name: (u.full_name ?? null) as string | null,
      role: u.role as string,
      created_at: u.created_at as string,
      departments: dept ? { id: dept.id as string, name: dept.name as string } : null,
      manager: u.manager_id ? (managerMap[u.manager_id] ?? null) : null,
    }
  }) satisfies UserRow[]

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Users</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {users.length} member{users.length !== 1 ? 's' : ''} in this tenant
          </p>
        </div>
        <Button asChild>
          <Link href="/invite">Invite User</Link>
        </Button>
      </div>

      <UsersTable
        rows={users}
        currentUserId={user.id}
        allUsers={users.map((u) => ({
          id: u.id,
          full_name: u.full_name,
          email: u.email,
        }))}
      />
    </div>
  )
}
