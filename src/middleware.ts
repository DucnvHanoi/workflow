import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Routes that require NO authentication
const PUBLIC_ROUTES = [
  '/',
  '/login',
  '/signup',
  '/auth/callback',
  '/auth/confirm',
  '/auth/mfa',
  '/api/webhooks',
  '/terms',
  '/privacy',
  '/help',
]

// Routes that require the 'admin' role
const ADMIN_ONLY_ROUTES = ['/dashboard', '/invite', '/users', '/departments', '/admin']

// Routes that require platform-owner email (PLATFORM_ADMIN_EMAIL env var)
const PLATFORM_ROUTES = ['/platform']

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(route + '/'))
}

function isAdminOnlyRoute(pathname: string): boolean {
  return ADMIN_ONLY_ROUTES.some((route) => pathname === route || pathname.startsWith(route + '/'))
}

function isPlatformRoute(pathname: string): boolean {
  return PLATFORM_ROUTES.some((route) => pathname === route || pathname.startsWith(route + '/'))
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

  // Refresh the session — required on every request
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // 1. Public routes — always allow through
  if (isPublicRoute(pathname)) {
    // If already logged in and visiting /login, redirect to /tasks
    if (pathname === '/login' && user) {
      const url = request.nextUrl.clone()
      url.pathname = '/tasks' // ← was /dashboard
      return NextResponse.redirect(url)
    }
    return supabaseResponse
  }

  // 2. No session — redirect to /login
  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // 3. Authenticated — check role for admin-only routes
  if (isAdminOnlyRoute(pathname)) {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    let role: string | null = null

    if (session?.access_token) {
      try {
        const payload = session.access_token.split('.')[1]
        const decoded = JSON.parse(atob(payload))
        role = decoded?.app_metadata?.role ?? null
      } catch {
        role = null
      }
    }

    if (role !== 'admin') {
      const url = request.nextUrl.clone()
      url.pathname = '/unauthorized'
      return NextResponse.redirect(url)
    }
  }

  // 4. Platform admin routes — email must match PLATFORM_ADMIN_EMAIL
  if (isPlatformRoute(pathname)) {
    const platformEmail = process.env.PLATFORM_ADMIN_EMAIL
    if (!platformEmail || user.email !== platformEmail) {
      const url = request.nextUrl.clone()
      url.pathname = '/unauthorized'
      return NextResponse.redirect(url)
    }
  }

  // 5. All checks passed
  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
