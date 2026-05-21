// FILE PATH: src/app/(app)/admin/audit/page.tsx
// Admin audit trail — lists administrative/structural events (role changes,
// flow publish/unpublish, step reassignments) recorded in audit_log.
// Server component: loads the tenant's most recent entries, resolves actor
// names, and hands off to AuditClient for filtering + pagination.
// Access: admin only (middleware guards the /admin prefix; re-checked here).

import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionClaims } from '@/lib/supabase/auth-helpers'
import { AuditClient } from '@/components/admin/audit-client'

export type AuditAction = 'role_changed' | 'flow_published' | 'flow_unpublished' | 'step_reassigned'

export type AuditEntry = {
  id: string
  action: AuditAction
  actorId: string | null
  actorName: string
  targetType: string
  targetLabel: string | null
  description: string
  createdAt: string // ISO
}

// Most recent N entries loaded for client-side filtering + pagination.
const LOAD_LIMIT = 1000

async function getAuditData(tenantId: string) {
  const db = createAdminClient()

  const { data: rows, error } = await db
    .from('audit_log')
    .select('id, action, actor_id, target_type, target_label, description, created_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(LOAD_LIMIT)

  if (error) throw new Error(error.message)

  type RawRow = {
    id: string
    action: AuditAction
    actor_id: string | null
    target_type: string
    target_label: string | null
    description: string
    created_at: string
  }
  const raw = (rows ?? []) as RawRow[]

  // Resolve actor names
  const actorIds = Array.from(new Set(raw.map((r) => r.actor_id).filter(Boolean))) as string[]
  const actorNameById: Record<string, string> = {}
  if (actorIds.length > 0) {
    const { data: users } = await db.from('users').select('id, full_name, email').in('id', actorIds)
    for (const u of (users ?? []) as { id: string; full_name: string | null; email: string }[]) {
      actorNameById[u.id] = u.full_name ?? u.email
    }
  }

  const entries: AuditEntry[] = raw.map((r) => ({
    id: r.id,
    action: r.action,
    actorId: r.actor_id,
    actorName: r.actor_id ? (actorNameById[r.actor_id] ?? 'Unknown') : 'System',
    targetType: r.target_type,
    targetLabel: r.target_label,
    description: r.description,
    createdAt: r.created_at,
  }))

  // Distinct actors for the filter dropdown
  const seen = new Set<string>()
  const actors: { id: string; name: string }[] = []
  for (const e of entries) {
    if (e.actorId && !seen.has(e.actorId)) {
      seen.add(e.actorId)
      actors.push({ id: e.actorId, name: e.actorName })
    }
  }
  actors.sort((a, b) => a.name.localeCompare(b.name))

  return { entries, actors, atLimit: raw.length === LOAD_LIMIT }
}

export default async function AdminAuditPage() {
  const { user, claims } = await getSessionClaims()
  if (!user) redirect('/login')
  if (claims.role !== 'admin') redirect('/unauthorized')
  if (!claims.tenant_id) redirect('/login')

  const { entries, actors, atLimit } = await getAuditData(claims.tenant_id)

  return (
    <div className="flex-1 space-y-6 p-6 md:p-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Audit Trail</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Administrative actions in your workspace — role changes, flow publishing, and step
          reassignments.
        </p>
      </div>

      <AuditClient entries={entries} actors={actors} atLimit={atLimit} loadLimit={LOAD_LIMIT} />
    </div>
  )
}
