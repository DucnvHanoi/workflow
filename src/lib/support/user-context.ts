'use server'

import { createAdminClient } from '@/lib/supabase/admin'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GraphNode {
  id: string
  data?: { label?: string; [key: string]: unknown }
}

interface FlowGraph {
  nodes?: GraphNode[]
}

// ---------------------------------------------------------------------------
// fetchUserContext
// Returns a formatted text block for injection into the Claude prompt.
// Returns empty string if the sender is not a registered user.
// ---------------------------------------------------------------------------

export async function fetchUserContext(senderEmail: string): Promise<string> {
  const db = createAdminClient()

  // 1. Resolve user by email ------------------------------------------------
  const { data: user } = await db
    .from('users')
    .select('id, full_name, role, tenant_id, department_id, manager_id')
    .eq('email', senderEmail)
    .maybeSingle()

  if (!user) return '' // prospective / unknown sender — no context to add

  // 2. Parallel: tenant, department, manager --------------------------------
  const [tenantRes, deptRes, managerRes] = await Promise.all([
    db.from('tenants').select('name, plan').eq('id', user.tenant_id).maybeSingle(),
    user.department_id
      ? db.from('departments').select('name').eq('id', user.department_id).maybeSingle()
      : Promise.resolve({ data: null }),
    user.manager_id
      ? db.from('users').select('full_name').eq('id', user.manager_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const tenant = tenantRes.data
  const dept = deptRes.data
  const manager = managerRes.data

  // 3. Pending step instances assigned to this user -------------------------
  const { data: pendingSteps } = await db
    .from('step_instances')
    .select(
      'id, step_id, due_at, created_at, instance_id, flow_instances(id, flow_version_id, flow_versions(flow_id, graph, flows(name)))'
    )
    .eq('assigned_to', user.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(5)

  // 4. Flow instances triggered by this user (recent) -----------------------
  const { data: triggeredFlows } = await db
    .from('flow_instances')
    .select(
      'id, status, created_at, current_step_id, flow_version_id, flow_versions(flow_id, graph, flows(name))'
    )
    .eq('triggered_by', user.id)
    .order('created_at', { ascending: false })
    .limit(5)

  // ---------------------------------------------------------------------------
  // Format
  // ---------------------------------------------------------------------------

  const lines: string[] = []

  // Profile
  lines.push('ACCOUNT CONTEXT')
  lines.push(
    `User: ${user.full_name ?? senderEmail} (${user.role})` +
      (tenant ? ` | Organisation: ${tenant.name} (${tenant.plan} plan)` : '') +
      (dept ? ` | Department: ${dept.name}` : '')
  )
  if (manager?.full_name) {
    lines.push(`Manager: ${manager.full_name}`)
  }

  // Pending steps (steps this user must act on)
  if (pendingSteps && pendingSteps.length > 0) {
    lines.push('')
    lines.push("STEPS WAITING FOR THIS USER'S ACTION")
    for (const si of pendingSteps) {
      const fv = (
        si.flow_instances as {
          flow_versions?: { graph?: unknown; flows?: { name?: string } }
        } | null
      )?.flow_versions
      const flowName = (fv?.flows as { name?: string } | null)?.name ?? 'Unknown Flow'
      const graph = fv?.graph as FlowGraph | null
      const node = graph?.nodes?.find((n) => n.id === si.step_id)
      const stepLabel = node?.data?.label ?? si.step_id
      const overdue =
        si.due_at && new Date(si.due_at) < new Date()
          ? ` ⚠ OVERDUE (due ${formatDate(si.due_at)})`
          : si.due_at
            ? ` (due ${formatDate(si.due_at)})`
            : ''
      lines.push(
        `- Flow: "${flowName}" | Step: "${stepLabel}"${overdue} | Waiting since: ${formatDate(si.created_at)}`
      )
    }
  }

  // Flows triggered by this user
  if (triggeredFlows && triggeredFlows.length > 0) {
    lines.push('')
    lines.push('FLOWS THIS USER RECENTLY STARTED')
    for (const fi of triggeredFlows) {
      const fv = fi.flow_versions as { graph?: unknown; flows?: { name?: string } } | null
      const flowName = (fv?.flows as { name?: string } | null)?.name ?? 'Unknown Flow'
      const graph = fv?.graph as FlowGraph | null

      let currentStepLabel = ''
      if (fi.status === 'pending' && fi.current_step_id) {
        const node = graph?.nodes?.find((n) => n.id === fi.current_step_id)
        currentStepLabel = node?.data?.label ?? fi.current_step_id
      }

      const statusStr =
        fi.status === 'pending'
          ? `running${currentStepLabel ? ` — current step: "${currentStepLabel}"` : ''}`
          : fi.status

      lines.push(
        `- Flow: "${flowName}" | Status: ${statusStr} | Started: ${formatDate(fi.created_at)}`
      )
    }
  }

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}
