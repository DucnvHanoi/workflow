'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionClaims } from '@/lib/supabase/auth-helpers'
import type { NotificationType } from './create'

export type NotificationItem = {
  id: string
  type: NotificationType
  title: string
  body: string
  link: string | null
  read_at: string | null
  created_at: string
}

export async function getNotifications(limit = 20): Promise<{
  notifications: NotificationItem[]
  unreadCount: number
  error: string | null
}> {
  const { user, claims } = await getSessionClaims()
  if (!user || !claims.tenant_id)
    return { notifications: [], unreadCount: 0, error: 'Unauthenticated' }

  const db = createAdminClient()
  const { data, error } = await db
    .from('notifications')
    .select('id, type, title, body, link, read_at, created_at')
    .eq('user_id', user.id)
    .eq('tenant_id', claims.tenant_id)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) return { notifications: [], unreadCount: 0, error: error.message }

  const notifications = (data ?? []) as NotificationItem[]
  const unreadCount = notifications.filter((n) => !n.read_at).length
  return { notifications, unreadCount, error: null }
}

export async function markNotificationRead(id: string): Promise<{ error: string | null }> {
  const { user, claims } = await getSessionClaims()
  if (!user || !claims.tenant_id) return { error: 'Unauthenticated' }

  const db = createAdminClient()
  const { error } = await db
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)
    .eq('tenant_id', claims.tenant_id)
    .is('read_at', null)

  return { error: error?.message ?? null }
}

export async function markAllNotificationsRead(): Promise<{ error: string | null }> {
  const { user, claims } = await getSessionClaims()
  if (!user || !claims.tenant_id) return { error: 'Unauthenticated' }

  const db = createAdminClient()
  const { error } = await db
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .eq('tenant_id', claims.tenant_id)
    .is('read_at', null)

  return { error: error?.message ?? null }
}
