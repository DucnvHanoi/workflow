// FILE PATH: src/app/(app)/my-flows/page.tsx
// Server component — fetches all flow instances triggered by the current user.
// Both admins and regular users can access this page.

import { getMyInstances } from '@/lib/flows/actions'
import { getSessionClaims } from '@/lib/supabase/auth-helpers'
import { redirect } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ArrowRightIcon, InboxIcon } from 'lucide-react'

export default async function MyFlowsPage() {
  const { user } = await getSessionClaims()
  if (!user) redirect('/login')

  const { instances, error } = await getMyInstances()

  return (
    <div className="mx-auto max-w-4xl p-6">
      {/* ── Page header ── */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">My Flows</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Flows you have started and their current status
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* ── Empty state ── */}
      {instances.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center rounded-lg border bg-muted/20 py-20 text-center">
          <InboxIcon className="mb-3 h-10 w-10 text-muted-foreground/40" />
          <h2 className="text-lg font-medium">No flows started yet</h2>
          <p className="mb-4 mt-1 text-sm text-muted-foreground">
            Go to Flows to start a published workflow.
          </p>
          <Button asChild size="sm" variant="outline">
            <Link href="/flows">Browse Flows</Link>
          </Button>
        </div>
      )}

      {/* ── Instances table ── */}
      {instances.length > 0 && (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Flow</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">
                  Started
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">
                  Last updated
                </th>
                <th className="w-10 px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {instances.map((instance) => (
                <tr key={instance.id} className="transition-colors hover:bg-muted/30">
                  {/* Flow name */}
                  <td className="px-4 py-3 font-medium">
                    {instance.flowName}
                    <div className="flex items-baseline gap-1.5 min-w-0 flex-wrap">
                      {instance.description ? (
                        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 max-w-xs">
                          {instance.description}
                        </p>
                      ) : (
                        ''
                      )}
                    </div>
                  </td>

                  {/* Status badge */}
                  <td className="px-4 py-3">
                    <StatusBadge status={instance.status} />
                  </td>

                  {/* Started date */}
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                    {formatDate(instance.createdAt)}
                  </td>

                  {/* Last updated */}
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                    {formatRelative(instance.updatedAt)}
                  </td>

                  {/* View link */}
                  <td className="px-4 py-3">
                    <a
                      href={`/my-flows/${instance.id}`}
                      className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                    >
                      View
                      <ArrowRightIcon className="h-3.5 w-3.5" />
                    </a>
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

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: 'pending' | 'completed' | 'cancelled' | 'error' }) {
  if (status === 'pending') {
    return (
      <Badge
        variant="secondary"
        className="border-blue-200 bg-blue-100 text-blue-800 hover:bg-blue-100"
      >
        In progress
      </Badge>
    )
  }
  if (status === 'completed') {
    return (
      <Badge
        variant="secondary"
        className="border-emerald-200 bg-emerald-100 text-emerald-800 hover:bg-emerald-100"
      >
        Completed
      </Badge>
    )
  }
  return (
    <Badge
      variant="secondary"
      className="border-zinc-200 bg-zinc-100 text-zinc-600 hover:bg-zinc-100"
    >
      Cancelled
    </Badge>
  )
}

// ─── Date helpers ─────────────────────────────────────────────────────────────
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return formatDate(iso)
}
