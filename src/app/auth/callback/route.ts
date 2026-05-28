// FILE PATH: src/app/auth/callback/route.ts

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/tasks' // ← was /dashboard

  if (code) {
    const supabase = createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.user) {
      // Platform admin bypasses the profile check — always land at /platform
      const platformEmail = process.env.PLATFORM_ADMIN_EMAIL
      if (platformEmail && data.user.email === platformEmail) {
        return NextResponse.redirect(`${origin}/platform`)
      }

      // Invited users won't have full_name set yet — send them to account setup
      const { data: profile } = await supabase
        .from('users')
        .select('full_name')
        .eq('id', data.user.id)
        .single()

      if (!profile?.full_name) {
        return NextResponse.redirect(`${origin}/account-setup`)
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=invalid_link`)
}
