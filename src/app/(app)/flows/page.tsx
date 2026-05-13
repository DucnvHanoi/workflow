// FILE PATH: src/app/(app)/flows/page.tsx
// Server component — fetches flows + categories, passes to FlowsClient.
// FlowsClient handles search + category filtering entirely client-side
// (no extra DB round-trips; loading all flows once is fine for ≤100 flows).

import { createFlow } from '@/app/(app)/flows/actions'
import { getFlows } from '@/lib/flows/actions'
import { getCategories } from '@/lib/flows/category-actions'
import { getSessionClaims } from '@/lib/supabase/auth-helpers'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { PlusIcon } from 'lucide-react'
import { FlowsClient } from '@/components/flows/flows-client'

export default async function FlowsPage() {
  const { user, claims } = await getSessionClaims()
  if (!user) redirect('/login')

  const isAdmin = claims.role === 'admin'

  // Parallel fetch — flows and categories in one round-trip pair
  const [{ flows, error: flowsError }, { categories, error: catsError }] = await Promise.all([
    getFlows(),
    getCategories(),
  ])

  const error = flowsError ?? catsError

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

      {/* ── Client component handles search + filtering ── */}
      <FlowsClient
        initialFlows={flows}
        categories={categories}
        isAdmin={isAdmin}
        createFlowAction={createFlow}
      />
    </div>
  )
}
