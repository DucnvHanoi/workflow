import { redirect } from 'next/navigation'
import { getSessionClaims } from '@/lib/supabase/auth-helpers'
import { createAdminClient } from '@/lib/supabase/admin'
import { DirectoryClient, type DirectoryUser, type Department } from './directory-client'

export default async function DirectoryPage() {
  const { user, claims } = await getSessionClaims()
  if (!user) redirect('/login')

  const db = createAdminClient()

  const [{ data: users }, { data: depts }] = await Promise.all([
    db
      .from('users')
      .select('id, full_name, email, role, department_id')
      .eq('tenant_id', claims.tenant_id!)
      .order('full_name', { ascending: true, nullsFirst: false }),
    db
      .from('departments')
      .select('id, name')
      .eq('tenant_id', claims.tenant_id!)
      .order('name', { ascending: true }),
  ])

  const deptMap = new Map((depts ?? []).map((d) => [d.id, d.name]))

  const directoryUsers: DirectoryUser[] = (users ?? []).map((u) => ({
    id: u.id,
    name: u.full_name ?? null,
    email: u.email,
    role: u.role,
    department_id: u.department_id ?? null,
    department: u.department_id ? (deptMap.get(u.department_id) ?? null) : null,
  }))

  const departments: Department[] = (depts ?? []).map((d) => ({ id: d.id, name: d.name }))

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">Team Directory</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {directoryUsers.length} member{directoryUsers.length !== 1 ? 's' : ''} in your
          organisation
        </p>
      </div>
      <DirectoryClient users={directoryUsers} departments={departments} />
    </div>
  )
}
