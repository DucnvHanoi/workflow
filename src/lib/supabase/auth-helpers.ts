import { createClient } from '@/lib/supabase/server'

interface JwtClaims {
  tenant_id: string | null
  role: 'admin' | 'user' | null
}

function decodeJwt(accessToken: string): Record<string, unknown> {
  try {
    const base64 = accessToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(Buffer.from(base64, 'base64').toString('utf8'))
  } catch {
    return {}
  }
}

// Use this in every Server Component and Server Action
// that needs role or tenant_id
export async function getSessionClaims(): Promise<{
  user: { id: string; email: string } | null
  claims: JwtClaims
}> {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      user: null,
      claims: { tenant_id: null, role: null },
    }
  }

  const {
    data: { session },
  } = await supabase.auth.getSession()
  const payload = session?.access_token ? decodeJwt(session.access_token) : {}
  const appMeta = (payload.app_metadata ?? {}) as Record<string, string>

  return {
    user: { id: user.id, email: user.email ?? '' },
    claims: {
      tenant_id: appMeta.tenant_id ?? null,
      role: (appMeta.role as 'admin' | 'user') ?? null,
    },
  }
}
