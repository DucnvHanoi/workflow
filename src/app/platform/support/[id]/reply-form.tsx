'use client'

import { useRef, useState, useTransition } from 'react'
import { sendAgentReply, updateTicketStatus } from '../actions'

interface Props {
  ticketId: string
  currentStatus: string
}

const STATUS_OPTIONS = ['open', 'pending_human', 'ai_replied', 'closed', 'spam'] as const

export function ReplyForm({ ticketId, currentStatus }: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function handleSendReply(e: React.FormEvent) {
    e.preventDefault()
    const text = textareaRef.current?.value.trim() ?? ''
    if (!text) return

    setError(null)
    setSuccess(false)

    startTransition(async () => {
      try {
        await sendAgentReply(ticketId, text)
        if (textareaRef.current) textareaRef.current.value = ''
        setSuccess(true)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to send reply')
      }
    })
  }

  function handleStatusChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newStatus = e.target.value
    startTransition(async () => {
      try {
        await updateTicketStatus(ticketId, newStatus)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update status')
      }
    })
  }

  return (
    <div className="space-y-4">
      {/* Status control */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-slate-600 dark:text-slate-400 shrink-0">
          Status
        </label>
        <select
          defaultValue={currentStatus}
          onChange={handleStatusChange}
          disabled={isPending}
          className="text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-slate-700 dark:text-slate-300 disabled:opacity-50"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s.replace('_', ' ')}
            </option>
          ))}
        </select>
      </div>

      {/* Reply composer */}
      <form onSubmit={handleSendReply} className="space-y-3">
        <textarea
          ref={textareaRef}
          rows={5}
          placeholder="Write your reply to the customer..."
          disabled={isPending}
          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 resize-none"
        />

        {error && <p className="text-sm text-red-600">{error}</p>}
        {success && <p className="text-sm text-green-600">Reply sent — ticket marked as closed.</p>}

        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-400">Sent via email · ticket will be marked closed</p>
          <button
            type="submit"
            disabled={isPending}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            {isPending ? 'Sending…' : 'Send Reply'}
          </button>
        </div>
      </form>
    </div>
  )
}
