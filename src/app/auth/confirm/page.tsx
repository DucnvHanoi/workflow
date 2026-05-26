'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function ConfirmPage() {
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function handleHashSession() {
      const hash = window.location.hash

      // Parse hash fragment manually
      const params = new URLSearchParams(hash.replace('#', ''))
      const accessToken = params.get('access_token')
      const refreshToken = params.get('refresh_token')
      const errorCode = params.get('error_code')

      // If there's an error in the hash
      if (errorCode) {
        const errorDesc = params.get('error_description') ?? 'Link expired'
        console.error('Auth error:', errorCode, errorDesc)
        router.push('/login?error=' + encodeURIComponent(errorDesc))
        return
      }

      // If we have tokens in the hash, set the session manually
      if (accessToken && refreshToken) {
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })

        if (error || !data.session) {
          router.push('/login?error=invalid_link')
          return
        }

        // Check if user needs account setup
        const { data: profile } = await supabase
          .from('users')
          .select('full_name')
          .eq('id', data.session.user.id)
          .single()

        if (!profile?.full_name) {
          router.push('/account-setup')
          return
        }

        router.push('/tasks')
        return
      }

      // No tokens and no error — try existing session
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (session) {
        const { data: profile } = await supabase
          .from('users')
          .select('full_name')
          .eq('id', session.user.id)
          .single()

        if (!profile?.full_name) {
          router.push('/account-setup')
          return
        }
        router.push('/tasks')
        return
      }

      router.push('/login?error=invalid_link')
    }

    handleHashSession()
  }, [router, supabase])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-sm text-muted-foreground">Signing you in...</p>
    </div>
  )
}
