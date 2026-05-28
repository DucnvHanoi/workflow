'use client'

import { useState, useEffect, useTransition, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { BellIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { markNotificationRead, markAllNotificationsRead } from '@/lib/notifications/actions'
import type { NotificationItem } from '@/lib/notifications/actions'

interface NotificationBellProps {
  userId: string
  initialNotifications: NotificationItem[]
}

const TYPE_ICON: Record<string, string> = {
  step_assigned: '📋',
  flow_completed: '✅',
  sla_reminder: '⏰',
  step_escalated: '⚠️',
  comment_added: '💬',
}

export function NotificationBell({ userId, initialNotifications }: NotificationBellProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<NotificationItem[]>(initialNotifications)
  const [isPending, startTransition] = useTransition()

  const unreadCount = notifications.filter((n) => !n.read_at).length

  // Realtime: prepend new inserts and reflect updates (mark-as-read) from other tabs
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel('notification-bell')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          setNotifications((prev) => [payload.new as NotificationItem, ...prev.slice(0, 19)])
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const updated = payload.new as NotificationItem
          setNotifications((prev) => prev.map((n) => (n.id === updated.id ? updated : n)))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])

  const handleClick = useCallback(
    (n: NotificationItem) => {
      // Close the dropdown first — router.push is a soft nav that doesn't
      // remount the layout, so the dropdown would stay open otherwise.
      setOpen(false)
      if (!n.read_at) {
        startTransition(async () => {
          await markNotificationRead(n.id)
          setNotifications((prev) =>
            prev.map((item) =>
              item.id === n.id ? { ...item, read_at: new Date().toISOString() } : item
            )
          )
        })
      }
      if (n.link) router.push(n.link)
    },
    [router]
  )

  const handleMarkAllRead = useCallback(() => {
    startTransition(async () => {
      await markAllNotificationsRead()
      const now = new Date().toISOString()
      setNotifications((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? now })))
    })
  }, [])

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-8 w-8">
          <BellIcon className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold leading-none text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 p-0">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-3 py-2.5">
          <span className="text-sm font-semibold">Notifications</span>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              disabled={isPending}
              className="text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
            >
              Mark all read
            </button>
          )}
        </div>

        {/* List */}
        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              No notifications yet
            </p>
          ) : (
            notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => handleClick(n)}
                className={`w-full border-b px-3 py-2.5 text-left transition-colors last:border-b-0 hover:bg-muted/60 ${
                  !n.read_at ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''
                }`}
              >
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 shrink-0 text-sm">{TYPE_ICON[n.type] ?? '🔔'}</span>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`truncate text-sm ${!n.read_at ? 'font-medium' : 'text-muted-foreground'}`}
                    >
                      {n.title}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{n.body}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground/60">
                      {formatRelative(n.created_at)}
                    </p>
                  </div>
                  {!n.read_at && (
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                  )}
                </div>
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-3 py-2">
          <a href="/notifications" className="text-xs text-primary hover:underline">
            View all notifications →
          </a>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}
