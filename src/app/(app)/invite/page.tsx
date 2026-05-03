import { redirect } from 'next/navigation'
import { getSessionClaims } from '@/lib/supabase/auth-helpers'
import { InviteForm } from '@/components/auth/invite-form'

export default async function InvitePage() {
  const { user, claims } = await getSessionClaims()

  if (!user) redirect('/login')
  if (claims.role !== 'admin') redirect('/dashboard')

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Invite a team member
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            They will receive an email with a sign-in link.
          </p>
        </div>
        <InviteForm />
      </div>
    </main>
  )
}
