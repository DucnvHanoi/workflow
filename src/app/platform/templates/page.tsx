import Link from 'next/link'
import { redirect } from 'next/navigation'
import { PlusIcon, PencilIcon } from 'lucide-react'
import { getSessionClaims } from '@/lib/supabase/auth-helpers'
import { createAdminClient } from '@/lib/supabase/admin'
import { createTemplate, toggleTemplatePublished } from './actions'
import { DeleteTemplateButton } from '@/components/platform/DeleteTemplateButton'

const CATEGORY_LABELS: Record<string, string> = {
  hr: 'HR',
  finance: 'Finance',
  it: 'IT',
  operations: 'Operations',
  other: 'Other',
}

const CATEGORY_COLORS: Record<string, string> = {
  hr: 'bg-blue-100 text-blue-700',
  finance: 'bg-green-100 text-green-700',
  it: 'bg-purple-100 text-purple-700',
  operations: 'bg-orange-100 text-orange-700',
  other: 'bg-gray-100 text-gray-600',
}

export default async function TemplatesPage() {
  const { user } = await getSessionClaims()
  const platformEmail = process.env.PLATFORM_ADMIN_EMAIL ?? ''
  if (!user || user.email !== platformEmail) redirect('/unauthorized')

  const db = createAdminClient()
  const { data: templates } = await db
    .from('flow_templates')
    .select('id, name, description, category, is_published, created_at, updated_at')
    .order('updated_at', { ascending: false })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            Flow Templates
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Pre-built templates tenants can clone into their workspace.
          </p>
        </div>
        <form action={createTemplate}>
          <button
            type="submit"
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
          >
            <PlusIcon className="h-4 w-4" />
            New Template
          </button>
        </form>
      </div>

      {!templates?.length ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 py-20 text-center">
          <p className="text-sm font-medium text-slate-500">No templates yet</p>
          <p className="mt-1 text-xs text-slate-400">Create one to give tenants a head-start.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:bg-slate-900">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 dark:bg-slate-800">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  Category
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500 hidden md:table-cell">
                  Updated
                </th>
                <th className="w-24 px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {templates.map((t) => (
                <tr
                  key={t.id}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900 dark:text-slate-100">{t.name}</div>
                    {t.description && (
                      <div className="mt-0.5 text-xs text-slate-400 line-clamp-1">
                        {t.description}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_COLORS[t.category] ?? 'bg-gray-100 text-gray-600'}`}
                    >
                      {CATEGORY_LABELS[t.category] ?? t.category}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <form
                      action={async () => {
                        'use server'
                        await toggleTemplatePublished(t.id, !t.is_published)
                      }}
                    >
                      <button
                        type="submit"
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium transition-colors ${
                          t.is_published
                            ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {t.is_published ? 'Published' : 'Draft'}
                      </button>
                    </form>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs hidden md:table-cell">
                    {new Date(t.updated_at).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <Link
                        href={`/platform/templates/${t.id}/edit`}
                        className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 transition-colors"
                      >
                        <PencilIcon className="h-3 w-3" />
                        Edit
                      </Link>
                      <DeleteTemplateButton templateId={t.id} templateName={t.name} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
