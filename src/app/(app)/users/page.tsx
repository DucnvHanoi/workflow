// src/app/(app)/users/page.tsx
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSessionClaims } from '@/lib/supabase/auth-helpers'
import { createClient } from '@/lib/supabase/server'
import { UsersTable, type UserRow } from '@/components/users/users-table'
import { Button } from '@/components/ui/button'

export default async function UsersPage() {
  const { user, claims } = await getSessionClaims()
  if (!user) redirect('/login')
  if (claims.role !== 'admin') redirect('/unauthorized')

  // Use the shared server client — handles cookies and session correctly
  const supabase = createClient()

  // Query 1 — all users with department
  const { data, error } = await supabase
    .from('users')
    .select(
      `
      id, email, full_name, role, created_at, manager_id, department_id,
      departments ( id, name )
    `
    )
    .order('full_name', { ascending: true, nullsFirst: false })

  if (error) console.error('Failed to fetch users:', error.message)

  const rawUsers = data ?? []

  // Query 2 — fetch managers in one query (avoid N+1)
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
      managerMap[m.id] = { id: m.id, full_name: m.full_name ?? null, email: m.email }
    }
  }

  // Query 3 — all departments for the edit department dropdown
  const { data: deptRows } = await supabase
    .from('departments')
    .select('id, name, parent_id')
    .order('name', { ascending: true })

  const allDepartments = (deptRows ?? []).map((d) => ({
    id: d.id,
    name: d.name,
    parent_id: d.parent_id,
  }))

  // Build UserRow[]
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
      department_id: (u.department_id ?? null) as string | null,
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
        allUsers={users.map((u) => ({ id: u.id, full_name: u.full_name, email: u.email }))}
        allDepartments={allDepartments}
      />
    </div>
  )
}
