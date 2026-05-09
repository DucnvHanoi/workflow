import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getSessionClaims } from '@/lib/supabase/auth-helpers'
import { createAdminClient } from '@/lib/supabase/admin'
import FlowCanvas from '@/components/canvas/FlowCanvas'
import type { TenantUser, TenantDepartment } from '@/store/canvas-store'

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function FlowEditPage({ params }: { params: { id: string } }) {
  // ── Auth guard ────────────────────────────────────────────────────────────
  const { user, claims } = await getSessionClaims()
  if (!user || !claims?.tenant_id) redirect('/login')
  if (claims.role !== 'admin') redirect('/unauthorized')

  const tenantId = claims.tenant_id
  const supabase = createClient()
  const adminClient = createAdminClient()

  // ── Fetch flow ────────────────────────────────────────────────────────────
  const { data: flow } = await supabase
    .from('flows')
    .select('id, name, status')
    .eq('id', params.id)
    .eq('tenant_id', tenantId)
    .single()

  if (!flow) redirect('/flows')

  // ── Fetch tenant users (for Fixed person assignee picker) ─────────────────
  // Use adminClient so we get all users regardless of RLS session context.
  // Only id, full_name, email are needed — no sensitive data exposed to client.
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

        {/* Status badge */}
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            flow.status === 'published'
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-gray-100 text-gray-600'
          }`}
        >
          {flow.status}
        </span>
      </div>

      {/* ── Canvas — fills remaining height ──────────────────────────── */}
      <div className="flex-1 overflow-hidden">
        <FlowCanvas flowId={flow.id} users={users} departments={departments} />
      </div>
    </div>
  )
}
