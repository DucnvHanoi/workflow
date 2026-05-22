import { redirect } from 'next/navigation'
import { getSessionClaims } from '@/lib/supabase/auth-helpers'
import { createClient } from '@/lib/supabase/server'
import { SettingsForm } from './settings-form'

export default async function SettingsPage() {
  const { user, claims } = await getSessionClaims()
  if (!user) redirect('/login')

  const supabase = createClient()
  const { data: profile } = await supabase
    .from('users')
    .select('full_name, email')
    .eq('id', user.id)
    .eq('tenant_id', claims.tenant_id)
    .maybeSingle()

  const email = profile?.email ?? user.email ?? ''
  const fullName = profile?.full_name ?? ''

  return (
    <main className="mx-auto max-w-lg px-4 py-10">
      <div className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Profile settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Update your display name.</p>
      </div>

      <div className="rounded-xl border bg-card p-6">
        <SettingsForm initialFullName={fullName} email={email} />
      </div>
    </main>
  )
}
