'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function MfaChallengePage() {
  const router = useRouter()
  const supabase = createClient()
  const [factorId, setFactorId] = useState<string | null>(null)
  const [challengeId, setChallengeId] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    async function init() {
      const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      // Already at aal2 or no MFA required — skip challenge
      if (!aalData || aalData.currentLevel === 'aal2' || aalData.nextLevel !== 'aal2') {
        router.replace('/tasks')
        return
      }

      const { data: factorsData } = await supabase.auth.mfa.listFactors()
      const totp = factorsData?.totp?.find((f) => f.status === 'verified')
      if (!totp) {
        router.replace('/tasks')
        return
      }

      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: totp.id,
      })
      if (challengeError || !challengeData) {
        setError(challengeError?.message ?? 'Could not start MFA challenge.')
        return
      }

      setFactorId(totp.id)
      setChallengeId(challengeData.id)
      setIsReady(true)
    }

    init()
  }, [router, supabase])

  function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    if (!factorId || !challengeId || code.length !== 6) return
    setError(null)
    startTransition(async () => {
      const { error } = await supabase.auth.mfa.verify({ factorId, challengeId, code })
      if (error) {
        setError('Incorrect code — please try again.')
        return
      }
      router.push('/tasks')
      router.refresh()
    })
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
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
            Two-factor authentication
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Enter the 6-digit code from your authenticator app.
          </p>
        </div>

        <div className="rounded-xl border bg-card p-6">
          {!isReady && !error ? (
            <p className="text-sm text-muted-foreground text-center">Preparing challenge…</p>
          ) : (
            <form onSubmit={handleVerify} className="space-y-4">
              <input
                type="text"
                inputMode="numeric"
                placeholder="000000"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                autoFocus
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-center tracking-widest font-mono ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              />

              {error && (
                <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2">
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isPending || code.length !== 6}
                className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isPending ? 'Verifying…' : 'Verify'}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  )
}
