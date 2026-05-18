// FILE PATH: src/app/(app)/departments/page.tsx

import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { getSessionClaims } from '@/lib/supabase/auth-helpers'
import { DepartmentsTable } from '@/components/departments/departments-table'
import { CreateDepartmentButton } from '@/components/departments/create-department-button'
import { buildDepartmentTree, flattenTree, type FlatDepartment } from '@/lib/departments/tree'

export default async function DepartmentsPage() {
  const { user, claims } = await getSessionClaims()
  if (!user) redirect('/login')
  if (claims.role !== 'admin') redirect('/unauthorized')

  const db = createAdminClient()

  const { data: departments, error } = await db
    .from('departments')
    .select('id, name, parent_id, created_at, head_user_id')
    .eq('tenant_id', claims.tenant_id!)
    .order('name', { ascending: true })

  if (error) console.error('Failed to fetch departments:', error.message)

  const { data: userRows } = await db
    .from('users')
    .select('id, full_name, email, department_id')
    .eq('tenant_id', claims.tenant_id!)
    .order('full_name', { ascending: true, nullsFirst: false })

  const allUsers = (userRows ?? []).map((u) => ({
    id: u.id as string,
    full_name: (u.full_name ?? null) as string | null,
    email: u.email as string,
    department_id: (u.department_id ?? null) as string | null,
  }))

  const countMap: Record<string, number> = {}
  for (const u of allUsers) {
    if (u.department_id) {
      countMap[u.department_id] = (countMap[u.department_id] ?? 0) + 1
    }
  }

  const userMap = new Map(allUsers.map((u) => [u.id, u]))

  const flat: FlatDepartment[] = (departments ?? []).map((d) => {
    const head = d.head_user_id ? (userMap.get(d.head_user_id) ?? null) : null
    return {
      id: d.id,
      name: d.name,
      parent_id: d.parent_id,
      created_at: d.created_at,
      userCount: countMap[d.id] ?? 0,
      head_user_id: d.head_user_id ?? null,
      head_name: head ? (head.full_name ?? head.email) : null,
    }
  })

  const tree = buildDepartmentTree(flat)
  const rows = flattenTree(tree)
  const allDepartments = flat.map((d) => ({ id: d.id, name: d.name, parent_id: d.parent_id }))

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Departments</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {flat.length} department{flat.length !== 1 ? 's' : ''}
          </p>
        </div>
        <CreateDepartmentButton allDepartments={allDepartments} />
      </div>

      <DepartmentsTable rows={rows} allDepartments={allDepartments} allUsers={allUsers} />
    </div>
  )
}
