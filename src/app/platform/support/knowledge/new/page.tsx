import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { createArticle } from '../actions'
import { ArticleForm } from '../article-form'

export default function NewArticlePage() {
  return (
    <div className="max-w-3xl space-y-6">
      <Link
        href="/platform/support/knowledge"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        Knowledge Base
      </Link>

      <div>
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">New Article</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Write in Markdown · toggle Preview before saving
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
        <ArticleForm mode="create" action={createArticle} />
      </div>
    </div>
  )
}
