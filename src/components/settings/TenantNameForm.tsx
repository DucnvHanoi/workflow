'use client'

import { useTransition, useState, useRef } from 'react'
import { updateTenantName } from '@/lib/settings/tenant-actions'

export function TenantNameForm({ currentName }: { currentName: string }) {
  const [pending, startTransition] = useTransition()
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const value = inputRef.current?.value ?? ''
    setStatus(null)
    startTransition(async () => {
      const { error } = await updateTenantName(value)
      setStatus(
        error ? { ok: false, message: error } : { ok: true, message: 'Organisation name updated.' }
      )
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="tenant-name" className="text-sm font-medium text-foreground">
          Organisation name
        </label>
        <input
          ref={inputRef}
          id="tenant-name"
          type="text"
          defaultValue={currentName}
          maxLength={100}
          required
          disabled={pending}
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
        />
      </div>

      {status && (
        <p className={`text-sm ${status.ok ? 'text-green-600' : 'text-red-600'}`}>
          {status.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {pending ? 'Saving…' : 'Save changes'}
      </button>
    </form>
  )
}
