import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { marked } from 'marked'
import { createAdminClient } from '@/lib/supabase/admin'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CATEGORY_LABEL: Record<string, string> = {
  general: 'General',
  billing: 'Billing & Plans',
  account: 'Account & Users',
  'how-to': 'How-To Guides',
  technical: 'Technical',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

// ---------------------------------------------------------------------------
// Static params (optional, for better build-time generation)
// ---------------------------------------------------------------------------

export async function generateStaticParams() {
  const db = createAdminClient()
  const { data } = await db.from('knowledge_base').select('slug').eq('is_active', true)
  return (data ?? []).map((row) => ({ slug: row.slug }))
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function HelpArticlePage({ params }: { params: { slug: string } }) {
  const db = createAdminClient()

  const { data: article } = await db
    .from('knowledge_base')
    .select('id, slug, title, category, content_markdown, updated_at')
    .eq('slug', params.slug)
    .eq('is_active', true)
    .single()

  if (!article) notFound()

  const htmlContent = marked(article.content_markdown ?? '', { gfm: true, breaks: true }) as string

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top bar */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center gap-4">
          <Link
            href="/help"
            className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Help Center
          </Link>
          {article.category && (
            <>
              <span className="text-slate-300">/</span>
              <Link
                href={`/help#${article.category}`}
                className="text-sm text-slate-500 hover:text-slate-900 transition-colors"
              >
                {CATEGORY_LABEL[article.category] ?? article.category}
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Article */}
      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="bg-white rounded-xl border border-slate-200 p-8">
          {/* Header */}
          <div className="mb-8 pb-6 border-b border-slate-100">
            {article.category && (
              <span className="inline-block text-xs font-semibold text-indigo-600 bg-indigo-50 rounded-full px-2.5 py-0.5 mb-3">
                {CATEGORY_LABEL[article.category] ?? article.category}
              </span>
            )}
            <h1 className="text-2xl font-bold text-slate-900 leading-snug">{article.title}</h1>
            {article.updated_at && (
              <p className="text-xs text-slate-400 mt-2">
                Last updated {formatDate(article.updated_at)}
              </p>
            )}
          </div>

          {/* Content */}
          <div
            className="prose prose-slate prose-sm max-w-none
              prose-headings:font-semibold prose-headings:text-slate-800
              prose-h2:text-lg prose-h3:text-base
              prose-p:text-slate-600 prose-p:leading-relaxed
              prose-li:text-slate-600
              prose-strong:text-slate-800 prose-strong:font-semibold
              prose-a:text-indigo-600 prose-a:no-underline hover:prose-a:underline
              prose-code:bg-slate-100 prose-code:text-slate-800 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:font-mono
              prose-pre:bg-slate-900 prose-pre:text-slate-100
              prose-blockquote:border-l-indigo-300 prose-blockquote:text-slate-500
              prose-hr:border-slate-200"
            dangerouslySetInnerHTML={{ __html: htmlContent }}
          />
        </div>

        {/* Footer */}
        <div className="mt-6 flex items-center justify-between text-sm">
          <Link
            href="/help"
            className="flex items-center gap-1 text-slate-500 hover:text-slate-900 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Help Center
          </Link>
          <a
            href="mailto:support@aitomicflow.com"
            className="text-indigo-600 hover:text-indigo-700 transition-colors"
          >
            Still need help? Contact us
          </a>
        </div>
      </div>
    </div>
  )
}
