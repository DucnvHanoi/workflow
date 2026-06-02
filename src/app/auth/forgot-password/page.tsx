'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'

export default function ForgotPasswordPage() {
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      })
      if (error) {
        if (error.message.toLowerCase().includes('rate limit')) {
          setError(
            'Too many reset emails sent recently. Please wait a few minutes and try again, or check your spam folder — the previous email may already be there.'
          )
        } else {
          setError(error.message)
        }
      } else {
        setSent(true)
      }
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
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Reset password</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {sent
              ? 'Check your email for the reset link.'
              : "Enter your email and we'll send you a reset link."}
          </p>
        </div>

        <Card className="border border-border shadow-sm">
          <CardContent className="pt-6 pb-6 px-6">
            {sent ? (
              <div className="space-y-4 text-center">
                <div className="rounded-md bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 px-4 py-3">
                  <p className="text-sm text-green-700 dark:text-green-400">
                    Reset link sent to <span className="font-medium">{email}</span>. Check your
                    inbox and follow the link to set a new password.
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Didn&apos;t receive it?{' '}
                  <button
                    type="button"
                    onClick={() => setSent(false)}
                    className="underline underline-offset-4 hover:text-foreground transition-colors"
                  >
                    Try again
                  </button>
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    autoFocus
                    disabled={isPending}
                  />
                </div>

                {error && (
                  <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2">
                    <p className="text-sm text-destructive">{error}</p>
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={isPending}>
                  {isPending ? 'Sending…' : 'Send reset link'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link
            href="/login"
            className="underline underline-offset-4 hover:text-foreground transition-colors"
          >
            Back to sign in
          </Link>
        </p>
      </div>
    </main>
  )
}
