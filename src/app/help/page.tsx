import Link from 'next/link'
import { BookOpen, CreditCard, User, Wrench, HelpCircle, ChevronRight, Search } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'

// ---------------------------------------------------------------------------
// Types & helpers
// ---------------------------------------------------------------------------

type Category = 'general' | 'billing' | 'account' | 'how-to' | 'technical'

const CATEGORY_META: Record<
  Category,
  { label: string; description: string; icon: React.ElementType; color: string }
> = {
  general: {
    label: 'General',
    description: 'What is DragFlow, getting started, and overview',
    icon: HelpCircle,
    color: 'bg-slate-100 text-slate-600',
  },
  billing: {
    label: 'Billing & Plans',
    description: 'Pricing, upgrades, invoices, and subscription management',
    icon: CreditCard,
    color: 'bg-amber-100 text-amber-700',
  },
  account: {
    label: 'Account & Users',
    description: 'Sign-up, profile, roles, MFA, and invitations',
    icon: User,
    color: 'bg-blue-100 text-blue-700',
  },
  'how-to': {
    label: 'How-To Guides',
    description: 'Step-by-step instructions for workflows, tasks, and features',
    icon: BookOpen,
    color: 'bg-indigo-100 text-indigo-700',
  },
  technical: {
    label: 'Technical',
    description: 'Troubleshooting, integrations, and advanced configuration',
    icon: Wrench,
    color: 'bg-rose-100 text-rose-700',
  },
}

const CATEGORY_ORDER: Category[] = ['general', 'billing', 'account', 'how-to', 'technical']

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function HelpPage() {
  const db = createAdminClient()

  const { data: articles } = await db
    .from('knowledge_base')
    .select('id, slug, title, category')
    .eq('is_active', true)
    .not('slug', 'like', '%-vi') // English articles only
    .order('title', { ascending: true })

  const byCategory = (articles ?? []).reduce<Record<string, typeof articles>>((acc, a) => {
    if (!a) return acc
    const cat = a.category ?? 'general'
    acc[cat] = acc[cat] ?? []
    acc[cat]!.push(a)
    return acc
  }, {})

  const totalArticles = (articles ?? []).length

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-6 py-12 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-100 mb-4">
            <BookOpen className="h-6 w-6 text-indigo-600" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900">Help Center</h1>
          <p className="text-slate-500 mt-2 text-base">
            {totalArticles} articles — find answers to common questions about DragFlow
          </p>
        </div>
      </div>

      {/* Category cards */}
      <div className="max-w-4xl mx-auto px-6 py-10 space-y-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {CATEGORY_ORDER.map((cat) => {
            const meta = CATEGORY_META[cat]
            const count = byCategory[cat]?.length ?? 0
            const Icon = meta.icon
            return (
              <a
                key={cat}
                href={`#${cat}`}
                className="bg-white rounded-xl border border-slate-200 p-5 hover:border-indigo-200 hover:shadow-sm transition-all group"
              >
                <div
                  className={`inline-flex items-center justify-center w-10 h-10 rounded-lg mb-3 ${meta.color}`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <h2 className="font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">
                  {meta.label}
                </h2>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">{meta.description}</p>
                <p className="text-xs text-slate-400 mt-3">
                  {count} article{count !== 1 ? 's' : ''}
                </p>
              </a>
            )
          })}
        </div>

        {/* Articles by category */}
        {CATEGORY_ORDER.filter((cat) => (byCategory[cat]?.length ?? 0) > 0).map((cat) => {
          const meta = CATEGORY_META[cat]
          const Icon = meta.icon
          return (
            <section key={cat} id={cat} className="scroll-mt-6">
              <div className="flex items-center gap-2 mb-4">
                <div
                  className={`inline-flex items-center justify-center w-7 h-7 rounded-md ${meta.color}`}
                >
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <h2 className="font-semibold text-slate-900 text-base">{meta.label}</h2>
                <span className="text-xs text-slate-400 ml-1">
                  {byCategory[cat]?.length} article{(byCategory[cat]?.length ?? 0) !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
                {byCategory[cat]?.map((a) => (
                  <Link
                    key={a!.id}
                    href={`/help/${a!.slug}`}
                    className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors group"
                  >
                    <span className="text-sm text-slate-700 group-hover:text-indigo-600 transition-colors">
                      {a!.title}
                    </span>
                    <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-indigo-400 shrink-0 transition-colors" />
                  </Link>
                ))}
              </div>
            </section>
          )
        })}

        {totalArticles === 0 && (
          <p className="text-center text-slate-400 py-16">No articles available yet.</p>
        )}

        {/* Footer CTA */}
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-6 py-8 text-center">
          <p className="text-slate-700 font-medium">Still have questions?</p>
          <p className="text-sm text-slate-500 mt-1 mb-4">
            Send us an email and our support team will get back to you.
          </p>
          <a
            href="mailto:support@bizflow.id.vn"
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            Contact Support
          </a>
        </div>
      </div>
    </div>
  )
}
