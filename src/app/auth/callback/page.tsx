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

  // No code — might be a hash fragment flow
  // Redirect to a client page that can read the hash
  return NextResponse.redirect(`${origin}/auth/confirm`)
}
