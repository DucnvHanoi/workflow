// FILE PATH: src/app/(app)/flows/[id]/edit/page.tsx

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getSessionClaims } from '@/lib/supabase/auth-helpers'
import { createAdminClient } from '@/lib/supabase/admin'
import FlowCanvas from '@/components/canvas/FlowCanvas'
import { CanvasToolbar } from '@/components/canvas/CanvasToolbar'
import type { TenantUser, TenantDepartment } from '@/store/canvas-store'
import { getLatestDraftGraph } from '@/lib/flows/actions'
import { deserializeGraph } from '@/lib/flows/graph'

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function FlowEditPage({ params }: { params: { id: string } }) {
  // ── Auth guard ────────────────────────────────────────────────────────────
  const { user, claims } = await getSessionClaims()
  if (!user || !claims?.tenant_id) redirect('/login')
  if (claims.role !== 'admin') redirect('/unauthorized')

  const tenantId = claims.tenant_id
  const supabase = createClient()
  const adminClient = createAdminClient()

  // ── Fetch flow (include status for publish panel) ─────────────────────────
  const { data: flow } = await supabase
    .from('flows')
    .select('id, name, status')
    .eq('id', params.id)
    .eq('tenant_id', tenantId)
    .single()

  if (!flow) redirect('/flows')

  // ── Fetch latest saved graph to hydrate canvas on load ────────────────────
  const { graph } = await getLatestDraftGraph(params.id)
  const initialNodes = graph ? deserializeGraph(graph).nodes : []
  const initialEdges = graph ? deserializeGraph(graph).edges : []

  // ── Fetch tenant users (for Fixed-person assignee picker) ─────────────────
  const { data: rawUsers } = await adminClient
    .from('users')
    .select('id, full_name, email')
    .eq('tenant_id', tenantId)
    .order('full_name', { ascending: true, nullsFirst: false })

  const users: TenantUser[] = rawUsers ?? []

  // ── Fetch tenant departments (for dept-based assignee rules) ──────────────
  const { data: rawDepts } = await supabase
    .from('departments')
    .select('id, name, parent_id')
    .eq('tenant_id', tenantId)
    .order('name', { ascending: true })

  const departments: TenantDepartment[] = rawDepts ?? []

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen flex-col">
      {/* ── Top bar ──────────────────────────────────────────────────── */}
      <div className="flex h-14 flex-shrink-0 items-center gap-3 border-b border-border bg-background px-4">
        <Link
          href="/flows"
          className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Flows
        </Link>

        <span className="text-muted-foreground">/</span>

        <span className="text-sm font-medium text-foreground">{flow.name}</span>

        {/* Status badge — rendered server-side as initial state.
            FlowCanvas updates this via onFlowStatusChange when publish/unpublish fires. */}
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            flow.status === 'published'
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-gray-100 text-gray-600'
          }`}
          id="flow-status-badge"
        >
          {flow.status}
        </span>

        {/* Save indicator — reads saveStatus from Zustand, no props needed */}
        <div className="ml-auto">
          <CanvasToolbar />
        </div>
      </div>

      {/* ── Canvas ───────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden">
        <FlowCanvas
          flowId={flow.id}
          flowStatus={flow.status as 'draft' | 'published'}
          users={users}
          departments={departments}
          initialNodes={initialNodes}
          initialEdges={initialEdges}
        />
      </div>
    </div>
  )
}
