'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { RefreshCw, UserX, Clock, CheckCircle2 } from 'lucide-react'
import { resendInvitation, revokeInvitation } from '../actions'

export type PendingInvitation = {
  id: string
  email: string
  invited_at: string
  resend_count: number
  last_resent_at: string | null
  invited_by_name: string | null
  is_accepted: boolean
}

interface Props {
  invitations: PendingInvitation[]
}

export function PendingInvitationsClient({ invitations: initial }: Props) {
  const [invitations, setInvitations] = useState(initial)
  const [isPending, startTransition] = useTransition()

  function handleResend(id: string) {
    startTransition(async () => {
      const result = await resendInvitation(id)
      if (result.success) {
        toast.success('Invitation resent.')
        setInvitations((prev) =>
          prev.map((inv) =>
            inv.id === id
              ? {
                  ...inv,
                  resend_count: inv.resend_count + 1,
                  last_resent_at: new Date().toISOString(),
                }
              : inv
          )
        )
      } else {
        toast.error(result.error)
      }
    })
  }

  function handleRevoke(id: string, email: string) {
    if (!confirm(`Revoke invitation for ${email}? Their account will be deleted.`)) return
    startTransition(async () => {
      const result = await revokeInvitation(id)
      if (result.success) {
        toast.success('Invitation revoked.')
        setInvitations((prev) => prev.filter((inv) => inv.id !== id))
      } else {
        toast.error(result.error)
      }
    })
  }

  if (invitations.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-12 text-center">
        <p className="text-sm text-muted-foreground">No invitations found.</p>
        <a href="/invite" className="mt-3 inline-block text-sm text-primary hover:underline">
          Send your first invitation →
        </a>
      </div>
    )
  }

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 border-b">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Email
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Status
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Invited by
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Last sent
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Resends
            </th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {invitations.map((inv) => (
            <tr key={inv.id} className="hover:bg-muted/30 transition-colors">
              <td className="px-4 py-3 font-mono text-xs">{inv.email}</td>
              <td className="px-4 py-3">
                {inv.is_accepted ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
                    <CheckCircle2 className="h-3 w-3" />
                    Accepted
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                    <Clock className="h-3 w-3" />
                    Pending
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-muted-foreground text-xs">
                {inv.invited_by_name ?? '—'}
              </td>
              <td className="px-4 py-3 text-muted-foreground text-xs">
                {formatDate(inv.last_resent_at ?? inv.invited_at)}
              </td>
              <td className="px-4 py-3 text-muted-foreground text-xs">
                {inv.resend_count > 0 ? `${inv.resend_count}×` : '—'}
              </td>
              <td className="px-4 py-3">
                {!inv.is_accepted && (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleResend(inv.id)}
                      disabled={isPending}
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline disabled:opacity-50"
                    >
                      <RefreshCw className="h-3 w-3" />
                      Resend
                    </button>
                    <button
                      onClick={() => handleRevoke(inv.id, inv.email)}
                      disabled={isPending}
                      className="inline-flex items-center gap-1 text-xs text-destructive hover:underline disabled:opacity-50"
                    >
                      <UserX className="h-3 w-3" />
                      Revoke
                    </button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
