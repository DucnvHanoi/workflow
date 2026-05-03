import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getSessionClaims } from '@/lib/supabase/auth-helpers'
import { DepartmentsTable } from '@/components/departments/departments-table'
import { CreateDepartmentButton } from '@/components/departments/create-department-button'
import { buildDepartmentTree, flattenTree, type FlatDepartment } from '@/lib/departments/tree'

export default async function DepartmentsPage() {
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

  const { data: departments, error } = await supabase
    .from('departments')
    .select('id, name, parent_id, created_at')

  if (error) console.error('Failed to fetch departments:', error.message)

  // User counts per department
  const { data: userCounts } = await supabase
    .from('users')
    .select('department_id')
    .not('department_id', 'is', null)

  const countMap: Record<string, number> = {}
  for (const u of userCounts ?? []) {
    if (u.department_id) {
      countMap[u.department_id] = (countMap[u.department_id] ?? 0) + 1
    }
  }

  const flat: FlatDepartment[] = (departments ?? []).map((d) => ({
    id: d.id,
    name: d.name,
    parent_id: d.parent_id,
    created_at: d.created_at,
    userCount: countMap[d.id] ?? 0,
  }))

  const tree = buildDepartmentTree(flat)
  const rows = flattenTree(tree)

  // Pass flat list to dialogs for parent selector
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

      <DepartmentsTable rows={rows} allDepartments={allDepartments} />
    </div>
  )
}
