import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.user) {
      // Check if this user still needs account setup
      // (invited users won't have full_name set yet)
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
