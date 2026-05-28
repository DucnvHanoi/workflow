import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { getArticle, updateArticle } from '../actions'
import { ArticleForm } from '../article-form'

export default async function EditArticlePage({ params }: { params: { id: string } }) {
  const article = await getArticle(params.id)
  if (!article) notFound()

  const boundUpdate = updateArticle.bind(null, article.id)

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/platform/support/knowledge"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Knowledge Base
        </Link>
        <Link
          href={`/help/${article.slug}`}
          target="_blank"
          className="text-xs text-indigo-600 hover:text-indigo-700 transition-colors"
        >
          View on Help Center ↗
        </Link>
      </div>

      <div>
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Edit Article</h1>
        <p className="text-sm text-slate-500 mt-0.5 font-mono">{article.slug}</p>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
        <ArticleForm mode="edit" defaultValues={article} action={boundUpdate} />
      </div>
    </div>
  )
}
