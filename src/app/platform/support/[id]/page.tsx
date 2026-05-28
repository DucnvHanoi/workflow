import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { getTicketWithMessages } from '../actions'
import { ReplyForm } from './reply-form'

const STATUS_BADGE: Record<string, string> = {
  open: 'bg-blue-100 text-blue-700',
  pending_human: 'bg-amber-100 text-amber-700',
  ai_replied: 'bg-indigo-100 text-indigo-700',
  closed: 'bg-slate-100 text-slate-500',
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function stripHtml(html: string) {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export default async function SupportTicketPage({ params }: { params: { id: string } }) {
  const result = await getTicketWithMessages(params.id)
  if (!result) notFound()

  const { ticket, messages } = result

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Back link */}
      <Link
        href="/platform/support"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to inbox
      </Link>

      {/* Ticket header */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-slate-900 dark:text-slate-100 leading-snug">
              {ticket.subject}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              {ticket.sender_name ? (
                <>
                  <span className="text-slate-700 dark:text-slate-300 font-medium">
                    {ticket.sender_name}
                  </span>{' '}
                  &lt;{ticket.sender_email}&gt;
                </>
              ) : (
                ticket.sender_email
              )}
            </p>
          </div>
          <span
            className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_BADGE[ticket.status] ?? STATUS_BADGE.open}`}
          >
            {ticket.status.replace('_', ' ')}
          </span>
        </div>

        {/* Metadata row */}
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-500">
          <span>
            <span className="font-medium text-slate-600 dark:text-slate-400">Priority:</span>{' '}
            {ticket.priority}
          </span>
          {ticket.category && (
            <span>
              <span className="font-medium text-slate-600 dark:text-slate-400">Category:</span>{' '}
              {ticket.category}
            </span>
          )}
          {ticket.ai_confidence && (
            <span>
              <span className="font-medium text-slate-600 dark:text-slate-400">AI confidence:</span>{' '}
              {ticket.ai_confidence}
            </span>
          )}
          <span>
            <span className="font-medium text-slate-600 dark:text-slate-400">Opened:</span>{' '}
            {formatDateTime(ticket.created_at)}
          </span>
          <span>
            <span className="font-medium text-slate-600 dark:text-slate-400">Last activity:</span>{' '}
            {formatDateTime(ticket.last_message_at)}
          </span>
          <span className="font-mono text-slate-400">{ticket.id.slice(0, 8)}…</span>
        </div>
      </div>

      {/* Message thread */}
      <div className="space-y-3">
        {messages.map((msg) => {
          const isInbound = msg.direction === 'inbound'
          const bodyText =
            msg.body_text || (msg.body_html ? stripHtml(msg.body_html) : '(no content)')

          return (
            <div
              key={msg.id}
              className={`rounded-xl border p-5 ${
                isInbound
                  ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                  : 'bg-indigo-50 dark:bg-indigo-950/30 border-indigo-100 dark:border-indigo-900'
              }`}
            >
              <div className="flex items-center justify-between gap-4 mb-3">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                      isInbound ? 'bg-slate-100 text-slate-600' : 'bg-indigo-100 text-indigo-700'
                    }`}
                  >
                    {isInbound ? 'Customer' : 'Support'}
                  </span>
                  {msg.is_ai_generated && (
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold bg-violet-100 text-violet-700">
                      AI
                    </span>
                  )}
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    {msg.from_name ?? msg.from_email}
                  </span>
                  {msg.from_name && (
                    <span className="text-xs text-slate-400">{msg.from_email}</span>
                  )}
                </div>
                <span className="text-xs text-slate-400 whitespace-nowrap">
                  {formatDateTime(msg.created_at)}
                </span>
              </div>
              <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                {bodyText}
              </p>
            </div>
          )
        })}

        {messages.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-6">No messages yet.</p>
        )}
      </div>

      {/* Agent reply section */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">
          Reply as Support Agent
        </h2>
        <ReplyForm ticketId={ticket.id} currentStatus={ticket.status} />
      </div>
    </div>
  )
}
