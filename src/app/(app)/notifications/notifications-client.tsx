'use client'

import { useState, useTransition, useCallback } from 'react'
import Link from 'next/link'
import { BellIcon, CheckCheckIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { markNotificationRead, markAllNotificationsRead } from '@/lib/notifications/actions'
import type { NotificationItem } from '@/lib/notifications/actions'

const TYPE_ICON: Record<string, string> = {
  step_assigned: '📋',
  flow_completed: '✅',
  sla_reminder: '⏰',
  step_escalated: '⚠️',
}

const TYPE_LABEL: Record<string, string> = {
  step_assigned: 'Task assigned',
  flow_completed: 'Flow completed',
  sla_reminder: 'SLA reminder',
  step_escalated: 'Escalation',
}

export default function NotificationsClient({
  initialNotifications,
}: {
  initialNotifications: NotificationItem[]
}) {
  const [notifications, setNotifications] = useState<NotificationItem[]>(initialNotifications)
  const [isPending, startTransition] = useTransition()

  const unreadCount = notifications.filter((n) => !n.read_at).length

  const handleMarkRead = useCallback((id: string) => {
    startTransition(async () => {
      await markNotificationRead(id)
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
      )
    })
  }, [])

  const handleMarkAllRead = useCallback(() => {
    startTransition(async () => {
      await markAllNotificationsRead()
      const now = new Date().toISOString()
      setNotifications((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? now })))
    })
  }, [])

  if (notifications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-20 text-center">
        <BellIcon className="mb-3 h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm font-medium text-muted-foreground">No notifications yet</p>
        <p className="mt-1 text-xs text-muted-foreground">
          You&apos;ll be notified when tasks are assigned or flows complete.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {unreadCount > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
          </span>
          <Button variant="outline" size="sm" onClick={handleMarkAllRead} disabled={isPending}>
            <CheckCheckIcon className="mr-1.5 h-3.5 w-3.5" />
            Mark all read
          </Button>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border">
        {notifications.map((n, i) => (
          <div
            key={n.id}
            className={`flex items-start gap-3 px-4 py-3 ${
              i !== notifications.length - 1 ? 'border-b' : ''
            } ${!n.read_at ? 'bg-blue-50/50 dark:bg-blue-950/20' : 'bg-card'}`}
          >
            <span className="mt-0.5 shrink-0 text-base">{TYPE_ICON[n.type] ?? '🔔'}</span>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`text-sm ${!n.read_at ? 'font-semibold' : 'font-medium'}`}>
                  {n.title}
                </span>
                <Badge variant="secondary" className="text-xs">
                  {TYPE_LABEL[n.type] ?? n.type}
                </Badge>
                {!n.read_at && <span className="h-2 w-2 rounded-full bg-blue-500" />}
              </div>
              <p className="mt-0.5 text-sm text-muted-foreground">{n.body}</p>
              <div className="mt-1 flex items-center gap-3">
                <span className="text-xs text-muted-foreground/60">{formatDate(n.created_at)}</span>
                {n.link && (
                  <Link
                    href={n.link}
                    onClick={() => {
                      if (!n.read_at) handleMarkRead(n.id)
                    }}
                    className="text-xs text-primary hover:underline"
                  >
                    View →
                  </Link>
                )}
                {!n.read_at && (
                  <button
                    onClick={() => handleMarkRead(n.id)}
                    disabled={isPending}
                    className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
                  >
                    Mark read
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}
