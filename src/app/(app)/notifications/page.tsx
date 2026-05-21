import { redirect } from 'next/navigation'
import { getSessionClaims } from '@/lib/supabase/auth-helpers'
import { getNotifications } from '@/lib/notifications/actions'
import NotificationsClient from './notifications-client'

export default async function NotificationsPage() {
  const { user } = await getSessionClaims()
  if (!user) redirect('/login')

  const { notifications } = await getNotifications(50)

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Notifications</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Your recent activity and alerts</p>
        </div>
      </div>

      <NotificationsClient initialNotifications={notifications} />
    </div>
  )
}
