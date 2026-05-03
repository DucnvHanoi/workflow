import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'

interface TopbarProps {
  userEmail: string
  tenantId: string
  role: string
}

// Get initials from email (fallback) or full name
function getInitials(email: string): string {
  const local = email.split('@')[0]
  const parts = local.split(/[._-]/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return local.slice(0, 2).toUpperCase()
}

export async function Topbar({ userEmail, tenantId, role }: TopbarProps) {
  // Fetch tenant name and user full_name server-side
  const supabase = createClient()

  const [{ data: tenant }, { data: userProfile }] = await Promise.all([
    supabase.from('tenants').select('name').eq('id', tenantId).maybeSingle(),
    supabase
      .from('users')
      .select('full_name')
      .eq('tenant_id', tenantId)
      .eq('email', userEmail)
      .maybeSingle(),
  ])

  const tenantName = tenant?.name ?? 'Workspace'
  const fullName = userProfile?.full_name ?? null
  const initials = fullName
    ? fullName
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : getInitials(userEmail)

  return (
    <header className="flex items-center justify-between h-14 px-6 border-b bg-card shrink-0">
      {/* Tenant name */}
      <span className="text-sm font-medium text-foreground">{tenantName}</span>

      {/* Right side: role badge + avatar */}
      <div className="flex items-center gap-3">
        {role === 'admin' && (
          <Badge variant="secondary" className="text-xs">
            Admin
          </Badge>
        )}
        <div
          className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-xs font-semibold select-none"
          title={fullName ?? userEmail}
        >
          {initials}
        </div>
      </div>
    </header>
  )
}
