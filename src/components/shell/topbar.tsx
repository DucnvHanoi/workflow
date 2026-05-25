import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Badge } from '@/components/ui/badge'
import { NotificationBell } from './NotificationBell'
import { AvatarDropdown } from './AvatarDropdown'
import type { NotificationItem } from '@/lib/notifications/actions'

interface TopbarProps {
  userId: string
  userEmail: string
  tenantId: string
  role: string
}

function getInitials(email: string): string {
  const local = email.split('@')[0]
  const parts = local.split(/[._-]/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return local.slice(0, 2).toUpperCase()
}

export async function Topbar({ userId, userEmail, tenantId, role }: TopbarProps) {
  const supabase = createClient()
  const adminDb = createAdminClient()

  const [{ data: tenant }, { data: userProfile }, { data: notifRows }] = await Promise.all([
    supabase.from('tenants').select('name').eq('id', tenantId).maybeSingle(),
    supabase
      .from('users')
      .select('full_name')
      .eq('tenant_id', tenantId)
      .eq('email', userEmail)
      .maybeSingle(),
    adminDb
      .from('notifications')
      .select('id, type, title, body, link, read_at, created_at')
      .eq('user_id', userId)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(20),
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

  const initialNotifications = (notifRows ?? []) as NotificationItem[]

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b bg-card px-6">
      {/* Tenant name */}
      <span className="text-sm font-medium text-foreground">{tenantName}</span>

      {/* Right side: notification bell + role badge + avatar */}
      <div className="flex items-center gap-3">
        <NotificationBell userId={userId} initialNotifications={initialNotifications} />

        {role === 'admin' && (
          <Badge variant="secondary" className="text-xs">
            Admin
          </Badge>
        )}
        <AvatarDropdown
          initials={initials}
          displayName={fullName ?? ''}
          email={userEmail}
          role={role}
        />
      </div>
    </header>
  )
}
