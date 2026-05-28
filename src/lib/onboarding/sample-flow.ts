// No 'use server' — imported from signup-actions.ts which carries that directive.
import { createAdminClient } from '@/lib/supabase/admin'
import type { SerializedGraph } from '@/lib/flows/graph'
import type { AssigneeRule } from '@/store/canvas-store'

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

export async function preloadSampleFlow(tenantId: string): Promise<void> {
  try {
    const db = createAdminClient()

    const { data: template } = await db
      .from('flow_templates')
      .select('name, graph')
      .ilike('name', '%leave request%')
      .eq('is_published', true)
      .limit(1)
      .maybeSingle()

    if (!template) return

    const rawGraph = template.graph as SerializedGraph | null
    const graph = rawGraph ? scrubAssigneeRules(rawGraph) : null

    const { data: flow, error: flowErr } = await db
      .from('flows')
      .insert({ tenant_id: tenantId, name: `${template.name as string} (Sample)`, status: 'draft' })
      .select('id')
      .single()

    if (flowErr || !flow) return

    if (graph) {
      const { data: version, error: versionErr } = await db
        .from('flow_versions')
        .insert({
          flow_id: flow.id,
          graph: graph as unknown as Record<string, unknown>,
          version_number: 1,
          published_at: null,
        })
        .select('id')
        .single()

      if (!versionErr && version) {
        await db.from('flows').update({ latest_version_id: version.id }).eq('id', flow.id)
      }
    }
  } catch {
    // Non-fatal — don't break signup
  }
}
