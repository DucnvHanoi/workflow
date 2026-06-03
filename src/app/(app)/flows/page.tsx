// FILE PATH: src/app/(app)/flows/page.tsx
// Server component — fetches flows + categories, passes to FlowsClient.
// FlowsClient handles search + category filtering entirely client-side
// (no extra DB round-trips; loading all flows once is fine for ≤100 flows).

import { createFlow } from '@/app/(app)/flows/actions'
import { getFlows } from '@/lib/flows/actions'
import { getCategories } from '@/lib/flows/category-actions'
import { getAvailableFlowSummaries } from '@/lib/ai/trigger-assistant'
import { getPublishedTemplates } from '@/lib/flows/template-actions'
import { getAdminChecklistState } from '@/lib/onboarding/actions'
import { getSessionClaims } from '@/lib/supabase/auth-helpers'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { PlusIcon, Sparkles } from 'lucide-react'
import { FlowsClient } from '@/components/flows/flows-client'
import { FlowTriggerAssistant } from '@/components/my-flows/FlowTriggerAssistant'
import { AdminChecklist } from '@/components/onboarding/AdminChecklist'

export default async function FlowsPage({
  searchParams,
}: {
  searchParams: Record<string, string>
}) {
  const { user, claims } = await getSessionClaims()
  if (!user) redirect('/login')

  const isAdmin = claims.role === 'admin'

  // Parallel fetch — flows, categories, AI summaries, templates, and checklist state
  const [
    { flows, error: flowsError },
    { categories, error: catsError },
    { summaries },
    templates,
    adminChecklist,
  ] = await Promise.all([
    getFlows(),
    getCategories(),
    getAvailableFlowSummaries(),
    getPublishedTemplates(),
    isAdmin ? getAdminChecklistState() : Promise.resolve(null),
  ])

  const error = flowsError ?? catsError ?? searchParams?.error ?? null

  // Show sample flow banner when all existing flows are the pre-loaded sample
  const hasSampleOnly =
    isAdmin && flows.length > 0 && flows.every((f) => f.name.includes('(Sample)'))

  return (
    <div className="mx-auto max-w-5xl p-6">
      {/* ── Page header ── */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Flows</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Design and manage approval workflows
          </p>
        </div>
        {isAdmin && (
          <form action={createFlow}>
            <Button type="submit" size="sm">
              <PlusIcon className="mr-1.5 h-4 w-4" />
              New Flow
            </Button>
          </form>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* ── Onboarding checklist — admins only ── */}
      {adminChecklist && !adminChecklist.dismissed && <AdminChecklist state={adminChecklist} />}

      {/* ── Sample flow callout — shown until the admin creates a real flow ── */}
      {hasSampleOnly && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3.5 dark:border-violet-800 dark:bg-violet-950/30">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-violet-600 dark:text-violet-400" />
          <div>
            <p className="text-sm font-medium text-violet-900 dark:text-violet-200">
              We preloaded a sample Leave Request flow for you
            </p>
            <p className="mt-0.5 text-xs text-violet-700 dark:text-violet-400">
              Open it in the builder to explore how flows are structured, then create your own from
              scratch or choose a template.
            </p>
          </div>
        </div>
      )}

      {/* ── AI trigger assistant — non-admins only ── */}
      {!isAdmin && <FlowTriggerAssistant flows={summaries} />}

      {/* ── Client component handles search + filtering ── */}
      <FlowsClient
        initialFlows={flows}
        categories={categories}
        isAdmin={isAdmin}
        createFlowAction={createFlow}
        templates={templates}
      />
    </div>
  )
}
