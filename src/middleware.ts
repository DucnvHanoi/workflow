import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Routes that require NO authentication
const PUBLIC_ROUTES = ['/login', '/auth/callback', '/auth/confirm']

// Routes that require the 'admin' role
const ADMIN_ONLY_ROUTES = [
  '/invite',
  '/users',
  '/departments',
  '/admin',
  '/flows',
  // Add more admin routes here as the project grows
]

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(route + '/'))
}

function isAdminOnlyRoute(pathname: string): boolean {
  return ADMIN_ONLY_ROUTES.some((route) => pathname === route || pathname.startsWith(route + '/'))
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh the session — this is required on every request
  // getUser() validates the token server-side with Supabase Auth
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // 1. Public routes — always allow through
  if (isPublicRoute(pathname)) {
    // If already logged in and visiting /login, redirect to /dashboard
    if (pathname === '/login' && user) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
    return supabaseResponse
  }

  // 2. No session — redirect to /login
  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    // Preserve the original destination so we can redirect back after login
    // (we'll use this in a future enhancement — for now just redirect to /login)
    return NextResponse.redirect(url)
  }

  // 3. User is authenticated — check role for admin-only routes
  if (isAdminOnlyRoute(pathname)) {
    // Read role from JWT app_metadata (injected by our custom_access_token_hook)
    // session.access_token is the JWT — decode the payload to get app_metadata
    const {
      data: { session },
    } = await supabase.auth.getSession()

    let role: string | null = null

    if (session?.access_token) {
      try {
        // JWT payload is the middle segment, base64url encoded
        const payload = session.access_token.split('.')[1]
        // atob is available in Edge Runtime (Vercel/Next.js middleware)
        const decoded = JSON.parse(atob(payload))
        role = decoded?.app_metadata?.role ?? null
      } catch {
        // Malformed token — treat as unauthorised
        role = null
      }
    }

    if (role !== 'admin') {
      const url = request.nextUrl.clone()
      url.pathname = '/unauthorized'
      return NextResponse.redirect(url)
    }
  }

  // 4. All checks passed — allow the request through
  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static (static files)
     * - _next/image (image optimisation)
     * - favicon.ico
     * - public folder files (images, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
