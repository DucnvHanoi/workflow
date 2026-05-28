import { redirect } from 'next/navigation'
import { getSessionClaims } from '@/lib/supabase/auth-helpers'
import { getOnboardingSteps } from '@/lib/onboarding/actions'
import { Sidebar } from '@/components/shell/sidebar'
import { Topbar } from '@/components/shell/topbar'
import { TourProvider } from '@/components/onboarding/TourProvider'
import { Toaster } from 'sonner' // ADD

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, claims } = await getSessionClaims()

  if (!user) redirect('/login')

  const completedSteps = await getOnboardingSteps(user.id)
  const completedStepKeys = completedSteps.map((s) => s.key)

  return (
    <TourProvider role={claims.role ?? ''} completedStepKeys={completedStepKeys}>
      <div className="flex h-screen bg-background overflow-hidden">
        <Sidebar role={claims.role ?? ''} />
        <div className="flex flex-col flex-1 min-w-0">
          <Topbar
            userId={user.id}
            userEmail={user.email ?? ''}
            tenantId={claims.tenant_id ?? ''}
            role={claims.role ?? ''}
          />
          <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
        </div>
        <Toaster richColors position="bottom-right" /> {/* ADD */}
      </div>
    </TourProvider>
  )
}
