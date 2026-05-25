import { redirect } from 'next/navigation'
import { getSessionClaims } from '@/lib/supabase/auth-helpers'
import { createClient } from '@/lib/supabase/server'
import { SettingsForm } from './settings-form'
import { MfaCard } from '@/components/settings/MfaCard'
import { AvatarUpload } from '@/components/settings/AvatarUpload'
import { AISettingsCard } from '@/components/settings/AISettingsCard'
import { getAISettings } from '@/lib/ai/ai-settings-actions'

function getInitials(fullName: string | null, email: string): string {
  if (fullName) {
    const parts = fullName.trim().split(/\s+/)
    return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase()
  }
  return email[0].toUpperCase()
}

export default async function SettingsPage() {
  const { user, claims } = await getSessionClaims()
  if (!user) redirect('/login')

  const isAdmin = claims?.role === 'admin'

  const supabase = createClient()
  const [{ data: profile }, { data: aiSettings }] = await Promise.all([
    supabase
      .from('users')
      .select('full_name, email, job_title, phone, avatar_url')
      .eq('id', user.id)
      .eq('tenant_id', claims.tenant_id)
      .maybeSingle(),
    isAdmin ? getAISettings() : Promise.resolve({ data: null, error: null }),
  ])

  const email = profile?.email ?? user.email ?? ''
  const fullName = profile?.full_name ?? ''
  const jobTitle = profile?.job_title ?? ''
  const phone = profile?.phone ?? ''
  const avatarUrl = profile?.avatar_url ?? null
  const initials = getInitials(fullName || null, email)

  const defaultAISettings = {
    aiEnabled: false,
    provider: 'anthropic' as const,
    useOwnKey: false,
    hasOwnKey: false,
    creditUsedUsd: 0,
    creditLimitUsd: 5.0,
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-10 space-y-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your profile and security.</p>
      </div>

      {/* Avatar */}
      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Photo</h2>
        <div className="rounded-xl border bg-card p-6">
          <AvatarUpload userId={user.id} currentAvatarUrl={avatarUrl} initials={initials} />
        </div>
      </section>

      {/* Profile */}
      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Profile
        </h2>
        <div className="rounded-xl border bg-card p-6">
          <SettingsForm
            initialFullName={fullName}
            initialJobTitle={jobTitle}
            initialPhone={phone}
            email={email}
          />
        </div>
      </section>

      {/* Security */}
      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Security
        </h2>
        <MfaCard />
      </section>

      {/* AI Settings (admin only) */}
      {isAdmin && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            AI Features
          </h2>
          <div className="rounded-xl border bg-card p-6">
            <AISettingsCard initial={aiSettings ?? defaultAISettings} />
          </div>
        </section>
      )}
    </main>
  )
}
