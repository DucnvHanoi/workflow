import { redirect } from 'next/navigation'
import { getSessionClaims } from '@/lib/supabase/auth-helpers'
import { getPendingInvitations } from '../actions'
import { PendingInvitationsClient } from './pending-client'

export default async function PendingInvitationsPage() {
  const { user, claims } = await getSessionClaims()
  if (!user) redirect('/login')
  if (claims.role !== 'admin') redirect('/tasks')

  const invitations = await getPendingInvitations()

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Pending Invitations
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage sent invitations — resend or revoke access.
          </p>
        </div>
        <a
          href="/invite"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Invite someone
        </a>
      </div>

      <PendingInvitationsClient invitations={invitations} />
    </main>
  )
}
