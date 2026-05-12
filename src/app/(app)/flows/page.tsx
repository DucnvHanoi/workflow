import { createFlow } from '@/app/(app)/flows/actions'
import { getFlows, type FlowListItem } from '@/lib/flows/actions'
import { getSessionClaims } from '@/lib/supabase/auth-helpers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FlowRowActions } from '@/components/flows/flow-row-actions'
import { PlusIcon } from 'lucide-react'

export default async function FlowsPage() {
  const { user, claims } = await getSessionClaims()
  if (!user) redirect('/login')

  const { flows, error } = await getFlows()

  const isAdmin = claims.role === 'admin'

  return (
    <div className="mx-auto max-w-5xl p-6">
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

      {flows.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center rounded-lg border bg-muted/20 py-20 text-center">
          <div className="mb-3 text-4xl">🔁</div>
          <h2 className="text-lg font-medium">No flows yet</h2>
          <p className="mb-4 mt-1 text-sm text-muted-foreground">
            Create your first workflow to get started.
          </p>
          {isAdmin && (
            <form action={createFlow}>
              <Button type="submit" size="sm">
                <PlusIcon className="mr-1.5 h-4 w-4" />
                New Flow
              </Button>
            </form>
          )}
        </div>
      )}

      {flows.length > 0 && (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Version</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Last Published
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Updated</th>
                <th className="w-10 px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {flows.map((flow) => (
                <FlowTableRow key={flow.id} flow={flow} isAdmin={isAdmin} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function FlowTableRow({ flow, isAdmin }: { flow: FlowListItem; isAdmin: boolean }) {
  return (
    <tr className="transition-colors hover:bg-muted/30">
      <td className="px-4 py-3 font-medium">
        <Link href={`/flows/${flow.id}/edit`} className="text-foreground hover:underline">
          {flow.name}
        </Link>
      </td>
      <td className="px-4 py-3">
        <Badge
          variant={flow.status === 'published' ? 'default' : 'secondary'}
          className={
            flow.status === 'published'
              ? 'border-emerald-200 bg-emerald-100 text-emerald-800 hover:bg-emerald-100'
              : ''
          }
        >
          {flow.status === 'published' ? 'Published' : 'Draft'}
        </Badge>
      </td>
      <td className="px-4 py-3 text-muted-foreground">
        {flow.versionNumber != null ? `v${flow.versionNumber}` : '—'}
      </td>
      <td className="px-4 py-3 text-muted-foreground">
        {flow.publishedAt ? formatDate(flow.publishedAt) : '—'}
      </td>
      <td className="px-4 py-3 text-muted-foreground">{formatRelative(flow.updatedAt)}</td>
      <td className="px-4 py-3">
        {isAdmin && <FlowRowActions flowId={flow.id} flowName={flow.name} status={flow.status} />}
      </td>
    </tr>
  )
}

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
