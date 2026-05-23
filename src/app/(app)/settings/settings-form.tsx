'use client'

import { useState, useTransition } from 'react'
import { updateOwnProfile } from './actions'

interface Props {
  initialFullName: string
  initialJobTitle: string
  initialPhone: string
  email: string
}

export function SettingsForm({ initialFullName, initialJobTitle, initialPhone, email }: Props) {
  const [fullName, setFullName] = useState(initialFullName)
  const [jobTitle, setJobTitle] = useState(initialJobTitle)
  const [phone, setPhone] = useState(initialPhone)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [isPending, startTransition] = useTransition()

  const isDirty =
    fullName.trim() !== initialFullName ||
    jobTitle.trim() !== initialJobTitle ||
    phone.trim() !== initialPhone

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)
    startTransition(async () => {
      const result = await updateOwnProfile({ fullName, jobTitle, phone })
      if (result.error) {
        setMessage({ type: 'error', text: result.error })
      } else {
        setMessage({ type: 'success', text: 'Profile updated.' })
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">Email</label>
        <input
          type="email"
          value={email}
          disabled
          className="w-full rounded-lg border border-input bg-muted px-3 py-2 text-sm text-muted-foreground cursor-not-allowed"
        />
        <p className="text-xs text-muted-foreground">
          Email address cannot be changed here. Contact your admin if needed.
        </p>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="full-name" className="text-sm font-medium text-foreground">
          Full name
        </label>
        <input
          id="full-name"
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Your full name"
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="job-title" className="text-sm font-medium text-foreground">
          Job title
        </label>
        <input
          id="job-title"
          type="text"
          value={jobTitle}
          onChange={(e) => setJobTitle(e.target.value)}
          placeholder="e.g. Product Manager"
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="phone" className="text-sm font-medium text-foreground">
          Phone
        </label>
        <input
          id="phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="e.g. +1 555 000 0000"
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        />
      </div>

      {message && (
        <p
          className={`text-sm ${message.type === 'success' ? 'text-green-600' : 'text-destructive'}`}
        >
          {message.text}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending || !isDirty}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isPending ? 'Saving…' : 'Save changes'}
      </button>
    </form>
  )
}
