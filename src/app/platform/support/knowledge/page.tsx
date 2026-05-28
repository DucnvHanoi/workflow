import Link from 'next/link'
import { Plus } from 'lucide-react'
import { getArticles } from './actions'
import { RowActions } from './row-actions'

const CATEGORY_BADGE: Record<string, string> = {
  general: 'bg-slate-100 text-slate-600',
  billing: 'bg-amber-100 text-amber-700',
  account: 'bg-blue-100 text-blue-700',
  'how-to': 'bg-indigo-100 text-indigo-700',
  technical: 'bg-rose-100 text-rose-700',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export default async function KnowledgeBasePage() {
  const articles = await getArticles()

  const active = articles.filter((a) => a.is_active).length
  const inactive = articles.length - active

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Knowledge Base
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {articles.length} articles · {active} active · {inactive} inactive
          </p>
        </div>
        <Link
          href="/platform/support/knowledge/new"
          className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Article
        </Link>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Title</th>
              <th className="px-4 py-3 text-left font-medium">Slug</th>
              <th className="px-4 py-3 text-left font-medium">Category</th>
              <th className="px-4 py-3 text-left font-medium">Updated</th>
              <th className="px-4 py-3 text-left font-medium">Status / Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {articles.map((a) => (
              <tr
                key={a.id}
                className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${!a.is_active ? 'opacity-50' : ''}`}
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/platform/support/knowledge/${a.id}`}
                    className="font-medium text-slate-900 dark:text-slate-100 hover:text-indigo-600 transition-colors"
                  >
                    {a.title}
                  </Link>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-slate-500">{a.slug}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${CATEGORY_BADGE[a.category] ?? CATEGORY_BADGE.general}`}
                  >
                    {a.category}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                  {formatDate(a.updated_at)}
                </td>
                <td className="px-4 py-3">
                  <RowActions id={a.id} isActive={a.is_active} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {articles.length === 0 && (
          <p className="text-center text-sm text-slate-400 py-10">No articles yet.</p>
        )}
      </div>
    </div>
  )
}
