import Link from 'next/link'
import { getTickets } from './actions'

const STATUS_BADGE: Record<string, string> = {
  open: 'bg-blue-100 text-blue-700',
  pending_human: 'bg-amber-100 text-amber-700',
  ai_replied: 'bg-indigo-100 text-indigo-700',
  closed: 'bg-slate-100 text-slate-500',
  spam: 'bg-red-100 text-red-700',
}

const PRIORITY_BADGE: Record<string, string> = {
  low: 'bg-slate-100 text-slate-500',
  normal: 'bg-slate-100 text-slate-600',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
}

const CONFIDENCE_BADGE: Record<string, string> = {
  high: 'bg-green-100 text-green-700',
  low: 'bg-rose-100 text-rose-700',
}

const STATUS_TABS = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'pending_human', label: 'Needs Review' },
  { value: 'ai_replied', label: 'AI Replied' },
  { value: 'closed', label: 'Closed' },
  { value: 'spam', label: 'Spam' },
]

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default async function SupportPage({ searchParams }: { searchParams: { status?: string } }) {
  const activeStatus = searchParams.status ?? 'all'

  // Stats always need all tickets; filtered view needs a subset.
  // getTickets('all') excludes spam (quarantined, like Gmail's Spam folder),
  // so its count is fetched separately.
  const [allTickets, spamTickets, filteredTickets] = await Promise.all([
    getTickets('all'),
    getTickets('spam'),
    activeStatus === 'all' || activeStatus === 'spam'
      ? Promise.resolve(null)
      : getTickets(activeStatus),
  ])
  const tickets = activeStatus === 'spam' ? spamTickets : (filteredTickets ?? allTickets)

  const stats = {
    open: allTickets.filter((t) => t.status === 'open').length,
    pending_human: allTickets.filter((t) => t.status === 'pending_human').length,
    ai_replied: allTickets.filter((t) => t.status === 'ai_replied').length,
    closed: allTickets.filter((t) => t.status === 'closed').length,
    spam: spamTickets.length,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Support Inbox</h1>
        <p className="text-sm text-slate-500 mt-0.5">Inbound customer support tickets</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-5 gap-4">
        {[
          { label: 'Open', value: stats.open, color: 'text-blue-600' },
          { label: 'Needs Review', value: stats.pending_human, color: 'text-amber-600' },
          { label: 'AI Replied', value: stats.ai_replied, color: 'text-indigo-600' },
          { label: 'Closed', value: stats.closed, color: 'text-slate-500' },
          { label: 'Spam', value: stats.spam, color: 'text-red-600' },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 px-5 py-4"
          >
            <p className="text-xs text-slate-500 font-medium">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Status filter tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800">
        {STATUS_TABS.map((tab) => (
          <Link
            key={tab.value}
            href={`/platform/support?status=${tab.value}`}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeStatus === tab.value
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {/* Ticket table */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Subject</th>
              <th className="px-4 py-3 text-left font-medium">Sender</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-left font-medium">Priority</th>
              <th className="px-4 py-3 text-left font-medium">Category</th>
              <th className="px-4 py-3 text-left font-medium">AI</th>
              <th className="px-4 py-3 text-left font-medium">Last activity</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {tickets.map((t) => (
              <tr
                key={t.id}
                className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/platform/support/${t.id}`}
                    className="font-medium text-slate-900 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors line-clamp-1"
                  >
                    {t.subject}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <p className="text-slate-700 dark:text-slate-300">
                    {t.sender_name ?? t.sender_email}
                  </p>
                  {t.sender_name && <p className="text-xs text-slate-400">{t.sender_email}</p>}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_BADGE[t.status] ?? STATUS_BADGE.open}`}
                  >
                    {t.status.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${PRIORITY_BADGE[t.priority] ?? PRIORITY_BADGE.normal}`}
                  >
                    {t.priority}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-500 capitalize">{t.category ?? '—'}</td>
                <td className="px-4 py-3">
                  {t.ai_confidence ? (
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${CONFIDENCE_BADGE[t.ai_confidence] ?? ''}`}
                    >
                      {t.ai_confidence}
                    </span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-xs">
                  {formatDate(t.last_message_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {tickets.length === 0 && (
          <p className="text-center text-sm text-slate-400 py-10">No tickets found.</p>
        )}
      </div>
    </div>
  )
}
