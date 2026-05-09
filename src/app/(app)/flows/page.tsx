import { createClient } from '@/lib/supabase/server'
import { getSessionClaims } from '@/lib/supabase/auth-helpers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, GitBranch } from 'lucide-react'
import { createFlow } from './actions'

export default async function FlowsPage() {
  const { user, claims } = await getSessionClaims()
  if (!user) redirect('/login')
  if (claims.role !== 'admin') redirect('/unauthorized')

  const supabase = createClient()
  const { data: flows } = await supabase
    .from('flows')
    .select('id, name, status, created_at, updated_at')
    .order('updated_at', { ascending: false })

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Flow Builder</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Design and publish approval flows for your team.
          </p>
        </div>
        <form action={createFlow}>
          <button
            type="submit"
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            New Flow
          </button>
        </form>
      </div>

      {!flows || flows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-20 text-center">
          <GitBranch className="mb-3 h-10 w-10 text-muted-foreground/50" />
          <h2 className="text-lg font-semibold">No flows yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Create your first flow to get started.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {flows.map((flow) => (
            <Link
              key={flow.id}
              href={`/flows/${flow.id}/edit`}
              className="flex items-center justify-between rounded-lg border bg-white px-5 py-4 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-center gap-3">
                <GitBranch className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">{flow.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Last updated {new Date(flow.updated_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  flow.status === 'published'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {flow.status}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
