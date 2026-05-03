import { redirect } from 'next/navigation'
import { getSessionClaims } from '@/lib/supabase/auth-helpers'
import { Sidebar } from '@/components/shell/sidebar'
import { Topbar } from '@/components/shell/topbar'
import { Toaster } from 'sonner' // ADD

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, claims } = await getSessionClaims()

  if (!user) redirect('/login')

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar role={claims.role} />
      <div className="flex flex-col flex-1 min-w-0">
        <Topbar userEmail={user.email ?? ''} tenantId={claims.tenant_id} role={claims.role} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
      <Toaster richColors position="bottom-right" /> {/* ADD */}
    </div>
  )
}
