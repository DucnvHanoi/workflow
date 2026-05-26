'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-4 text-center">
      <p className="text-6xl font-bold text-slate-200">500</p>
      <h1 className="mt-4 text-xl font-semibold text-slate-800">Something went wrong</h1>
      <p className="mt-2 text-sm text-slate-500 max-w-sm">
        An unexpected error occurred. Try again or contact support if the problem persists.
        {error.digest && (
          <span className="block mt-1 font-mono text-xs text-slate-400">
            Error ID: {error.digest}
          </span>
        )}
      </p>
      <div className="mt-6 flex gap-3">
        <button
          onClick={reset}
          className="px-4 py-2 rounded-lg border border-slate-300 text-sm text-slate-700 hover:bg-slate-100 transition-colors"
        >
          Try again
        </button>
        <Link
          href="/tasks"
          className="px-4 py-2 rounded-lg bg-indigo-600 text-sm text-white hover:bg-indigo-700 transition-colors"
        >
          Go to app
        </Link>
      </div>
    </div>
  )
}
