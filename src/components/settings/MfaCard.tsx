'use client'

import { useState, useEffect, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Factor } from '@supabase/supabase-js'
import { Shield, ShieldCheck, Loader2 } from 'lucide-react'

type Step = 'loading' | 'unenrolled' | 'qr' | 'enrolled'

export function MfaCard() {
  const supabase = createClient()
  const [step, setStep] = useState<Step>('loading')
  const [factor, setFactor] = useState<Factor | null>(null)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [enrollFactorId, setEnrollFactorId] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    async function loadFactors() {
      const { data } = await supabase.auth.mfa.listFactors()
      const verified = data?.totp?.find((f) => f.status === 'verified') ?? null
      setFactor(verified)
      setStep(verified ? 'enrolled' : 'unenrolled')
    }
    loadFactors()
  }, [supabase])

  async function handleEnroll() {
    setError(null)
    // Clean up any lingering unverified factor from a cancelled prior attempt
    const { data: existing } = await supabase.auth.mfa.listFactors()
    const unverified = existing?.totp?.find((f) => f.status === 'unverified')
    if (unverified) {
      await supabase.auth.mfa.unenroll({ factorId: unverified.id })
    }

    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      issuer: 'Aitomic Flow',
      friendlyName: 'Authenticator App',
    })
    if (error || !data) {
      setError(error?.message ?? 'Enrollment failed.')
      return
    }
    setQrCode(data.totp.qr_code)
    setSecret(data.totp.secret)
    setEnrollFactorId(data.id)
    setStep('qr')
  }

  function handleVerify() {
    if (!enrollFactorId || code.length !== 6) return
    setError(null)
    startTransition(async () => {
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: enrollFactorId,
        code,
      })
      if (error) {
        setError('Incorrect code — please try again.')
        return
      }
      const { data } = await supabase.auth.mfa.listFactors()
      const verified = data?.totp?.find((f) => f.status === 'verified') ?? null
      setFactor(verified)
      setStep('enrolled')
      setCode('')
      setQrCode(null)
      setSecret(null)
    })
  }

  function handleUnenroll() {
    if (!factor) return
    setError(null)
    startTransition(async () => {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id })
      if (error) {
        setError(error.message)
        return
      }
      setFactor(null)
      setStep('unenrolled')
    })
  }

  if (step === 'loading') {
    return (
      <div className="rounded-xl border bg-card p-6 flex items-center gap-3 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Checking security settings…</span>
      </div>
    )
  }

  return (
    <div className="rounded-xl border bg-card p-6 space-y-4">
      <div className="flex items-center gap-3">
        {step === 'enrolled' ? (
          <ShieldCheck className="h-5 w-5 text-green-600 shrink-0" />
        ) : (
          <Shield className="h-5 w-5 text-muted-foreground shrink-0" />
        )}
        <div>
          <h2 className="text-sm font-semibold">Two-factor authentication</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {step === 'enrolled'
              ? 'Enabled — your account is protected with an authenticator app.'
              : 'Add an extra layer of security when signing in.'}
          </p>
        </div>
      </div>

      {step === 'unenrolled' && (
        <button
          onClick={handleEnroll}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Enable two-factor authentication
        </button>
      )}

      {step === 'qr' && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.), then
            enter the 6-digit code to confirm.
          </p>
          {qrCode && (
            <div className="flex flex-col items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrCode} alt="MFA QR Code" className="w-40 h-40 border rounded-lg" />
              {secret && (
                <p className="text-xs text-muted-foreground">
                  Manual key: <span className="font-mono select-all tracking-wider">{secret}</span>
                </p>
              )}
            </div>
          )}
          <div className="space-y-2">
            <input
              type="text"
              inputMode="numeric"
              placeholder="000000"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              autoFocus
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-center tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <div className="flex gap-2">
              <button
                onClick={handleVerify}
                disabled={isPending || code.length !== 6}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isPending ? 'Verifying…' : 'Verify & Enable'}
              </button>
              <button
                onClick={() => {
                  setStep('unenrolled')
                  setCode('')
                  setError(null)
                }}
                className="rounded-lg border px-4 py-2 text-sm hover:bg-accent transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 'enrolled' && (
        <button
          onClick={handleUnenroll}
          disabled={isPending}
          className="rounded-lg border border-destructive text-destructive px-4 py-2 text-sm font-semibold hover:bg-destructive/5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isPending ? 'Disabling…' : 'Disable two-factor authentication'}
        </button>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
