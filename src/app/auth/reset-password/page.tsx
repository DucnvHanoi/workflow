'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'

type PageState = 'loading' | 'ready' | 'success' | 'error'

export default function ResetPasswordPage() {
  const router = useRouter()
  const supabase = createClient()

  const [pageState, setPageState] = useState<PageState>('loading')
  const [initError, setInitError] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // On mount: parse the recovery tokens from the URL hash and set the session
  useEffect(() => {
    async function init() {
      const hash = window.location.hash
      const params = new URLSearchParams(hash.replace('#', ''))
      const accessToken = params.get('access_token')
      const refreshToken = params.get('refresh_token')
      const type = params.get('type')
      const errorCode = params.get('error_code')

      if (errorCode) {
        const desc = params.get('error_description') ?? 'Link is invalid or has expired.'
        setInitError(decodeURIComponent(desc.replace(/\+/g, ' ')))
        setPageState('error')
        return
      }

      if (!accessToken || !refreshToken || type !== 'recovery') {
        setInitError('Invalid or missing reset link. Please request a new one.')
        setPageState('error')
        return
      }

      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      })

      if (error) {
        setInitError('Reset link has expired. Please request a new one.')
        setPageState('error')
        return
      }

      setPageState('ready')
    }

    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)

    if (password.length < 8) {
      setFormError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setFormError('Passwords do not match.')
      return
    }

    startTransition(async () => {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) {
        setFormError(error.message)
        return
      }
      // Sign out so the user re-authenticates with their new password
      await supabase.auth.signOut()
      setPageState('success')
    })
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        {/* Brand mark */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-foreground mb-4">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M4 5h8M4 10h12M4 15h6"
                stroke="hsl(var(--background))"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            {pageState === 'success' ? 'Password updated' : 'Set new password'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {pageState === 'success'
              ? 'You can now sign in with your new password.'
              : 'Choose a strong password for your account.'}
          </p>
        </div>

        <Card className="border border-border shadow-sm">
          <CardContent className="pt-6 pb-6 px-6">
            {/* Loading */}
            {pageState === 'loading' && (
              <p className="text-sm text-muted-foreground text-center">Verifying link…</p>
            )}

            {/* Error — invalid / expired link */}
            {pageState === 'error' && (
              <div className="space-y-4">
                <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2">
                  <p className="text-sm text-destructive">{initError}</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => router.push('/auth/forgot-password')}
                >
                  Request a new reset link
                </Button>
              </div>
            )}

            {/* New password form */}
            {pageState === 'ready' && (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="password">New password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Min. 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoFocus
                    autoComplete="new-password"
                    disabled={isPending}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="confirm">Confirm new password</Label>
                  <Input
                    id="confirm"
                    type="password"
                    placeholder="Repeat your password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    autoComplete="new-password"
                    disabled={isPending}
                  />
                </div>

                {formError && (
                  <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2">
                    <p className="text-sm text-destructive">{formError}</p>
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={isPending}>
                  {isPending ? 'Updating…' : 'Update password'}
                </Button>
              </form>
            )}

            {/* Success */}
            {pageState === 'success' && (
              <div className="space-y-4">
                <div className="rounded-md bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 px-4 py-3">
                  <p className="text-sm text-green-700 dark:text-green-400">
                    Your password has been updated successfully.
                  </p>
                </div>
                <Button type="button" className="w-full" onClick={() => router.push('/login')}>
                  Go to sign in
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
