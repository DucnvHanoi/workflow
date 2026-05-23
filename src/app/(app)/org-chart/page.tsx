import { redirect } from 'next/navigation'
import { getSessionClaims } from '@/lib/supabase/auth-helpers'
import { createAdminClient } from '@/lib/supabase/admin'
import { OrgChartClient, type OrgUser } from './org-chart-client'

export default async function OrgChartPage() {
  const { user, claims } = await getSessionClaims()
  if (!user) redirect('/login')

  const db = createAdminClient()

  const [{ data: users }, { data: departments }] = await Promise.all([
    db
      .from('users')
      .select('id, full_name, email, role, manager_id, department_id')
      .eq('tenant_id', claims.tenant_id!),
    db.from('departments').select('id, name').eq('tenant_id', claims.tenant_id!),
  ])

  const deptMap = new Map((departments ?? []).map((d) => [d.id, d.name]))

  const orgUsers: OrgUser[] = (users ?? []).map((u) => ({
    id: u.id,
    name: u.full_name ?? null,
    email: u.email,
    role: u.role,
    manager_id: u.manager_id ?? null,
    department: u.department_id ? (deptMap.get(u.department_id) ?? null) : null,
  }))

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="mb-4 shrink-0">
        <h1 className="text-xl font-semibold tracking-tight">Org Chart</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {orgUsers.length} member{orgUsers.length !== 1 ? 's' : ''} — hierarchy based on manager
          assignments
        </p>
      </div>
      <div className="flex-1 rounded-lg border overflow-hidden">
        <OrgChartClient users={orgUsers} />
      </div>
    </div>
  )
}
