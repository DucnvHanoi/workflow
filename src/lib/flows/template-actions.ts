'use server'

import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionClaims } from '@/lib/supabase/auth-helpers'
import { getTenantLimits } from '@/lib/billing/limits'
import type { SerializedGraph } from '@/lib/flows/graph'
import type { AssigneeRule } from '@/store/canvas-store'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PublishedTemplate {
  id: string
  name: string
  description: string | null
  category: string
  graph: SerializedGraph | null
}

// ─── Assignee rule scrubbing ──────────────────────────────────────────────────
// Fixed, department_head, and role_in_dept rules are tenant-specific and cannot
// be meaningfully applied in a new tenant's workspace — strip them on clone.

const TENANT_SPECIFIC_RULE_TYPES = new Set(['fixed', 'department_head', 'role_in_dept'])

function scrubAssigneeRules(graph: SerializedGraph): SerializedGraph {
  return {
    ...graph,
    nodes: graph.nodes.map((n) => {
      const rule = n.data?.assigneeRule as AssigneeRule | undefined
      if (rule && TENANT_SPECIFIC_RULE_TYPES.has(rule.type)) {
        return { ...n, data: { ...n.data, assigneeRule: null } }
      }
      return n
    }),
  }
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export async function getPublishedTemplates(): Promise<PublishedTemplate[]> {
  const db = createAdminClient()
  const { data } = await db
    .from('flow_templates')
    .select('id, name, description, category, graph')
    .eq('is_published', true)
    .order('category')
  return (data ?? []) as PublishedTemplate[]
}

export async function createFlowFromTemplate(templateId: string): Promise<void> {
  const { user, claims } = await getSessionClaims()
  if (!user || claims.role !== 'admin') throw new Error('Unauthorized')

  const tenantId = claims.tenant_id as string
  const db = createAdminClient()

  // Plan limit check
  const limits = await getTenantLimits(tenantId)
  if (limits.maxFlows !== null) {
    const { count } = await db
      .from('flows')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
    if ((count ?? 0) >= limits.maxFlows) {
      redirect(
        `/flows?error=${encodeURIComponent(
          `You've reached your plan limit of ${limits.maxFlows} flow${limits.maxFlows !== 1 ? 's' : ''}. Upgrade to Pro to create more.`
        )}`
      )
    }
  }

  // Fetch template
  const { data: template } = await db
    .from('flow_templates')
    .select('name, graph')
    .eq('id', templateId)
    .single()

  if (!template) throw new Error('Template not found')

  const rawGraph = template.graph as SerializedGraph | null
  const graph = rawGraph ? scrubAssigneeRules(rawGraph) : null

  // Create flow
  const { data: flow, error: flowErr } = await db
    .from('flows')
    .insert({ tenant_id: tenantId, name: template.name, status: 'draft' })
    .select('id')
    .single()

  if (flowErr || !flow) throw new Error('Failed to create flow')

  // Create initial version if template has a graph
  if (graph) {
    await db.from('flow_versions').insert({
      flow_id: flow.id,
      graph,
      version_number: 1,
      is_draft: true,
    })
  }

  redirect(`/flows/${flow.id}/edit`)
}
