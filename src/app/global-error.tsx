'use client'

import { useEffect } from 'react'

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
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f8fafc',
          fontFamily: 'system-ui, sans-serif',
          textAlign: 'center',
          padding: '1rem',
        }}
      >
        <p style={{ fontSize: '4rem', fontWeight: 700, color: '#e2e8f0', margin: 0 }}>500</p>
        <h1
          style={{
            fontSize: '1.25rem',
            fontWeight: 600,
            color: '#1e293b',
            margin: '1rem 0 0.5rem',
          }}
        >
          Something went wrong
        </h1>
        <p style={{ fontSize: '0.875rem', color: '#64748b', maxWidth: '24rem', margin: '0 auto' }}>
          A critical error occurred. Please refresh the page.
          {error.digest && (
            <span
              style={{
                display: 'block',
                marginTop: '0.25rem',
                fontFamily: 'monospace',
                fontSize: '0.75rem',
                color: '#94a3b8',
              }}
            >
              Error ID: {error.digest}
            </span>
          )}
        </p>
        <button
          onClick={reset}
          style={{
            marginTop: '1.5rem',
            padding: '0.5rem 1rem',
            borderRadius: '0.5rem',
            border: '1px solid #cbd5e1',
            background: 'white',
            fontSize: '0.875rem',
            color: '#334155',
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
      </body>
    </html>
  )
}
