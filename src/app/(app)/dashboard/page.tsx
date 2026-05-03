import { redirect } from 'next/navigation'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Helper to read JWT claims server-side
// Same pattern as getSessionClaims() in auth-helpers.ts
async function getAppMetadata() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const {
    data: { session },
  } = await supabase.auth.getSession()

  let role = 'user'
  let tenantId = null

  if (session?.access_token) {
    try {
      const payload = session.access_token.split('.')[1]
      const decoded = JSON.parse(atob(payload))
      role = decoded?.app_metadata?.role ?? 'user'
      tenantId = decoded?.app_metadata?.tenant_id ?? null
    } catch {
      // ignore decode errors
    }
  }

  return { user, role, tenantId }
}

export default async function DashboardPage() {
  const { user, role, tenantId } = await getAppMetadata()

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-8">
      <div className="w-full max-w-md space-y-4 rounded-lg border border-border bg-card p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Route protection is working. You are authenticated.
        </p>

        <div className="space-y-2 rounded-md bg-muted p-4 font-mono text-xs">
          <div>
            <span className="text-muted-foreground">email: </span>
            <span className="text-foreground">{user.email}</span>
          </div>
          <div>
            <span className="text-muted-foreground">role: </span>
            <span className="text-foreground">{role}</span>
          </div>
          <div>
            <span className="text-muted-foreground">tenant_id: </span>
            <span className="text-foreground">{tenantId ?? 'null'}</span>
          </div>
        </div>

        <div className="space-y-2 pt-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Test admin-only routes:
          </p>
          <div className="flex flex-wrap gap-2">
            <a
              href="/invite"
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              /invite (admin only)
            </a>

            <a
              href="/users"
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              /users (admin only)
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
