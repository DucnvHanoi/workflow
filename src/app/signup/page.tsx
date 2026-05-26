'use client'

import { useState } from 'react'
import Link from 'next/link'
import { GitBranch, Eye, EyeOff, ArrowRight, Loader2, MailCheck } from 'lucide-react'
import { createTenantAccount } from '@/lib/auth/signup-actions'

function PasswordStrength({ password }: { password: string }) {
  if (!password) return null

  const len = password.length
  const filled = len >= 12 ? 4 : len >= 10 ? 3 : len >= 8 ? 2 : 1
  const label = len >= 12 ? 'Strong' : len >= 10 ? 'Good' : len >= 8 ? 'Fair' : 'Too short'
  const color =
    len >= 12
      ? 'bg-emerald-500'
      : len >= 10
        ? 'bg-green-400'
        : len >= 8
          ? 'bg-amber-400'
          : 'bg-red-400'

  return (
    <div className="flex items-center gap-1.5 pt-1.5">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className={`h-1 flex-1 rounded-full transition-colors ${i <= filled ? color : 'bg-slate-200'}`}
        />
      ))}
      <span className="text-xs text-slate-400 ml-1 w-14 shrink-0">{label}</span>
    </div>
  )
}

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [website, setWebsite] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    setLoading(true)
    try {
      const result = await createTenantAccount(email.trim().toLowerCase(), password, website)
      if ('error' in result) {
        setError(result.error)
        return
      }
      setConfirmed(true)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (confirmed) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-50 to-white px-4 py-12">
        <div className="w-full max-w-sm text-center">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-indigo-50 border border-indigo-100 mb-6">
            <MailCheck className="h-8 w-8 text-indigo-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-3">Check your inbox</h1>
          <p className="text-sm text-slate-500 leading-relaxed mb-2">
            We sent a confirmation link to
          </p>
          <p className="text-sm font-semibold text-slate-800 mb-6">{email}</p>
          <p className="text-sm text-slate-500 leading-relaxed mb-8">
            Click the link in the email to activate your account. The link expires in 24 hours.
          </p>
          <p className="text-xs text-slate-400">
            Didn&apos;t receive it? Check your spam folder or{' '}
            <button
              onClick={() => setConfirmed(false)}
              className="text-indigo-600 hover:text-indigo-700 font-medium underline underline-offset-2"
            >
              try again
            </button>
            .
          </p>
          <div className="mt-8">
            <Link
              href="/login"
              className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
            >
              ← Back to log in
            </Link>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-50 to-white px-4 py-12">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex flex-col items-center gap-3 group">
            <div className="h-11 w-11 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200 group-hover:bg-indigo-700 transition-colors">
              <GitBranch className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-slate-900 text-xl tracking-tight">DragFlow</span>
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 mt-6 mb-2">Create your account</h1>
          <p className="text-sm text-slate-500">
            Start building workflows for free — no card required
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-7 space-y-5">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Honeypot — hidden from humans, traps bots */}
            <input
              type="text"
              name="website"
              autoComplete="off"
              tabIndex={-1}
              aria-hidden="true"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              style={{
                position: 'absolute',
                left: '-9999px',
                width: '1px',
                height: '1px',
                overflow: 'hidden',
              }}
            />
            {/* Email */}
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-sm font-medium text-slate-700">
                Work email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                disabled={loading}
                className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50 transition-colors"
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  disabled={loading}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50 transition-colors"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <PasswordStrength password={password} />
            </div>

            {/* Error */}
            {error && (
              <div className="rounded-lg bg-red-50 border border-red-100 px-3.5 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold text-sm px-4 py-2.5 rounded-lg transition-colors"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating your account…
                </>
              ) : (
                <>
                  Create account
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Below card */}
        <div className="mt-6 text-center space-y-3">
          <p className="text-sm text-slate-500">
            Already have an account?{' '}
            <Link href="/login" className="text-indigo-600 hover:text-indigo-700 font-medium">
              Log in
            </Link>
          </p>
          <p className="text-xs text-slate-400 leading-relaxed">
            By signing up you agree to our{' '}
            <a
              href="#"
              className="underline underline-offset-2 hover:text-slate-600 transition-colors"
            >
              Terms of Service
            </a>{' '}
            and{' '}
            <a
              href="#"
              className="underline underline-offset-2 hover:text-slate-600 transition-colors"
            >
              Privacy Policy
            </a>
            .
          </p>
        </div>
      </div>
    </main>
  )
}
