import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AccountSetupForm } from '@/components/auth/account-setup-form'

export default async function AccountSetupPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Must be logged in (magic link auto-signs them in)
  if (!user) redirect('/login')

  // If they already have a full_name set, setup is done
  const { data: profile } = await supabase
    .from('users')
    .select('full_name')
    .eq('id', user.id)
    .single()

  if (profile?.full_name) redirect('/tasks')

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Set up your account
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Welcome! Set your name and a password to get started.
          </p>
        </div>
        <AccountSetupForm email={user.email ?? ''} />
      </div>
    </main>
  )
}
