// FILE PATH: supabase/functions/resolve-assignee/index.ts
// Deploy: npx supabase functions deploy resolve-assignee --no-verify-jwt --project-ref <ref>

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AssigneeRule =
  | { type: 'requester' }
  | { type: 'fixed'; email: string }
  | { type: 'manager_of_requestor' }
  | { type: 'skip_level' }
  | { type: 'department_head'; department_id: string }
  | { type: 'requester_dept_head' }
  | { type: 'role_in_dept'; department_id: string; role: string }

interface RequestBody {
  rule: AssigneeRule
  triggered_by_user_id: string
  tenant_id: string
}

type ResolveResult =
  | { assigned_to_user_id: string; error: null }
  | { assigned_to_user_id: null; error: string }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ok(userId: string): ResolveResult {
  return { assigned_to_user_id: userId, error: null }
}

function err(message: string): ResolveResult {
  return { assigned_to_user_id: null, error: message }
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// ---------------------------------------------------------------------------
// Supabase admin client
// ---------------------------------------------------------------------------

function getAdminClient() {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// ---------------------------------------------------------------------------
// Shared: walk department hierarchy upward looking for a head_user_id.
// Used by both department_head and requester_dept_head rules.
//
// Resolution order per level:
//   1. Department has head_user_id set and the user still exists → return that user.
//   2. head_user_id set but user was deleted → treat as no head, walk up.
//   3. No head_user_id → walk up to parent_id.
//   4. Reached root (no parent_id) with no head found → error.
//
// Max depth guard (10) prevents infinite loops from corrupt data.
// ---------------------------------------------------------------------------

async function walkDeptHierarchyForHead(
  supabase: ReturnType<typeof getAdminClient>,
  startDeptId: string,
  tenantId: string
): Promise<ResolveResult> {
  let currentDeptId = startDeptId
  const visited = new Set<string>()
  const MAX_DEPTH = 10

  for (let depth = 0; depth < MAX_DEPTH; depth++) {
    if (visited.has(currentDeptId)) {
      return err(`Circular parent_id detected in department hierarchy at id "${currentDeptId}".`)
    }
    visited.add(currentDeptId)

    const { data: dept, error: deptError } = await supabase
      .from('departments')
      .select('id, name, parent_id, head_user_id')
      .eq('id', currentDeptId)
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (deptError) return err(`DB error looking up department: ${deptError.message}`)
    if (!dept)
      return err(`Department not found: no department with id "${currentDeptId}" in this tenant.`)

    // ── Step 1: explicit head_user_id set ─────────────────────────────────
    if (dept.head_user_id) {
      const { data: headUser, error: headErr } = await supabase
        .from('users')
        .select('id')
        .eq('id', dept.head_user_id)
        .eq('tenant_id', tenantId)
        .maybeSingle()

      if (headErr) return err(`DB error verifying department head: ${headErr.message}`)
      if (headUser) return ok(headUser.id)
      // head_user_id set but user was deleted — treat as no head, walk up
    }

    // ── Step 2: no head — walk up if possible, otherwise error ────────────
    if (!dept.parent_id) {
      return err(
        `No department head found in "${dept.name}" or any of its parent departments. ` +
          `Please assign a head to at least one department in this hierarchy.`
      )
    }

    currentDeptId = dept.parent_id
  }

  return err(`Department hierarchy too deep (max ${MAX_DEPTH} levels). Could not resolve head.`)
}

// ---------------------------------------------------------------------------
// Rule resolvers
// ---------------------------------------------------------------------------

/**
 * requester: assigned back to whoever triggered the flow.
 * Verifies the user exists in the tenant as a safety check.
 */
async function resolveRequester(
  supabase: ReturnType<typeof getAdminClient>,
  triggeredByUserId: string,
  tenantId: string
): Promise<ResolveResult> {
  const { data, error } = await supabase
    .from('users')
    .select('id')
    .eq('id', triggeredByUserId)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (error) return err(`DB error looking up requester: ${error.message}`)
  if (!data)
    return err(`Requester not found: no user with id "${triggeredByUserId}" in this tenant.`)
  return ok(data.id)
}

/**
 * fixed: look up user by email within the tenant.
 */
async function resolveFixed(
  supabase: ReturnType<typeof getAdminClient>,
  rule: Extract<AssigneeRule, { type: 'fixed' }>,
  tenantId: string
): Promise<ResolveResult> {
  const { data, error } = await supabase
    .from('users')
    .select('id')
    .eq('email', rule.email)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (error) return err(`DB error looking up fixed assignee: ${error.message}`)
  if (!data)
    return err(`Fixed assignee not found: no user with email "${rule.email}" in this tenant.`)
  return ok(data.id)
}

/**
 * manager_of_requestor: return the manager_id of the triggered_by user.
 */
async function resolveManagerOfRequestor(
  supabase: ReturnType<typeof getAdminClient>,
  triggeredByUserId: string,
  tenantId: string
): Promise<ResolveResult> {
  const { data: requestor, error: requestorError } = await supabase
    .from('users')
    .select('id, full_name, manager_id')
    .eq('id', triggeredByUserId)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (requestorError) return err(`DB error looking up requestor: ${requestorError.message}`)
  if (!requestor)
    return err(`Requestor not found: no user with id "${triggeredByUserId}" in this tenant.`)
  if (!requestor.manager_id)
    return err(
      `Cannot resolve manager: user "${requestor.full_name ?? triggeredByUserId}" has no manager assigned.`
    )

  const { data: manager, error: managerError } = await supabase
    .from('users')
    .select('id, full_name')
    .eq('id', requestor.manager_id)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (managerError) return err(`DB error looking up manager: ${managerError.message}`)
  if (!manager)
    return err(
      `Manager not found: manager_id "${requestor.manager_id}" does not exist in this tenant.`
    )
  return ok(manager.id)
}

/**
 * skip_level: chain manager_id twice. Falls back to direct manager if
 * skip-level doesn't exist.
 */
async function resolveSkipLevel(
  supabase: ReturnType<typeof getAdminClient>,
  triggeredByUserId: string,
  tenantId: string
): Promise<ResolveResult> {
  const { data: requestor, error: requestorError } = await supabase
    .from('users')
    .select('id, full_name, manager_id')
    .eq('id', triggeredByUserId)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (requestorError) return err(`DB error looking up requestor: ${requestorError.message}`)
  if (!requestor)
    return err(`Requestor not found: no user with id "${triggeredByUserId}" in this tenant.`)
  if (!requestor.manager_id)
    return err(
      `Cannot resolve skip-level: user "${requestor.full_name ?? triggeredByUserId}" has no manager assigned.`
    )

  const { data: manager, error: managerError } = await supabase
    .from('users')
    .select('id, full_name, manager_id')
    .eq('id', requestor.manager_id)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (managerError) return err(`DB error looking up manager: ${managerError.message}`)
  if (!manager)
    return err(
      `Manager not found: manager_id "${requestor.manager_id}" does not exist in this tenant.`
    )

  // Fallback: direct manager has no skip-level — return direct manager
  if (!manager.manager_id) return ok(manager.id)

  const { data: skipLevel, error: skipLevelError } = await supabase
    .from('users')
    .select('id, full_name')
    .eq('id', manager.manager_id)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (skipLevelError)
    return err(`DB error looking up skip-level manager: ${skipLevelError.message}`)
  if (!skipLevel) return ok(manager.id) // defensive fallback
  return ok(skipLevel.id)
}

/**
 * department_head: resolve the head of a SPECIFIC department chosen at
 * design time, walking up the parent hierarchy if that dept has no head.
 * The department_id is fixed in the rule config and does NOT depend on
 * who triggers the flow.
 */
async function resolveDepartmentHead(
  supabase: ReturnType<typeof getAdminClient>,
  rule: Extract<AssigneeRule, { type: 'department_head' }>,
  tenantId: string
): Promise<ResolveResult> {
  return walkDeptHierarchyForHead(supabase, rule.department_id, tenantId)
}

/**
 * requester_dept_head: resolve the head of the REQUESTER'S OWN department
 * at runtime, walking up the parent hierarchy if that dept has no head.
 *
 * Errors immediately if:
 *   - The requester has no department_id set.
 *   - No head found all the way to the root department.
 */
async function resolveRequesterDeptHead(
  supabase: ReturnType<typeof getAdminClient>,
  triggeredByUserId: string,
  tenantId: string
): Promise<ResolveResult> {
  // 1. Look up the requester's own department
  const { data: requester, error: requesterError } = await supabase
    .from('users')
    .select('id, full_name, department_id')
    .eq('id', triggeredByUserId)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (requesterError) return err(`DB error looking up requester: ${requesterError.message}`)
  if (!requester)
    return err(`Requester not found: no user with id "${triggeredByUserId}" in this tenant.`)
  if (!requester.department_id)
    return err(
      `Cannot resolve requester's department head: user "${requester.full_name ?? triggeredByUserId}" ` +
        `has no department assigned. Please assign them to a department first.`
    )

  // 2. Walk up the hierarchy from the requester's own department
  return walkDeptHierarchyForHead(supabase, requester.department_id, tenantId)
}

/**
 * role_in_dept: first user in a department matching a role, alphabetically.
 */
async function resolveRoleInDept(
  supabase: ReturnType<typeof getAdminClient>,
  rule: Extract<AssigneeRule, { type: 'role_in_dept' }>,
  tenantId: string
): Promise<ResolveResult> {
  const { data: dept, error: deptError } = await supabase
    .from('departments')
    .select('id, name')
    .eq('id', rule.department_id)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (deptError) return err(`DB error looking up department: ${deptError.message}`)
  if (!dept)
    return err(
      `Department not found: no department with id "${rule.department_id}" in this tenant.`
    )

  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, full_name')
    .eq('department_id', rule.department_id)
    .eq('tenant_id', tenantId)
    .eq('role', rule.role)
    .order('full_name', { ascending: true })
    .limit(1)

  if (usersError) return err(`DB error looking up role in department: ${usersError.message}`)
  if (!users || users.length === 0)
    return err(`No user with role "${rule.role}" found in department "${dept.name}".`)
  return ok(users[0].id)
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed. Use POST.' }, 405)
  }

  let body: Partial<RequestBody>
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'Invalid JSON body.' }, 400)
  }

  const { rule, triggered_by_user_id, tenant_id } = body

  if (!rule || !triggered_by_user_id || !tenant_id) {
    return jsonResponse(
      {
        assigned_to_user_id: null,
        error:
          'Missing required fields: rule, triggered_by_user_id, and tenant_id are all required.',
      },
      400
    )
  }

  const supabase = getAdminClient()
  let result: ResolveResult

  switch (rule.type) {
    case 'requester':
      result = await resolveRequester(supabase, triggered_by_user_id, tenant_id)
      break
    case 'fixed':
      result = await resolveFixed(supabase, rule, tenant_id)
      break
    case 'manager_of_requestor':
      result = await resolveManagerOfRequestor(supabase, triggered_by_user_id, tenant_id)
      break
    case 'skip_level':
      result = await resolveSkipLevel(supabase, triggered_by_user_id, tenant_id)
      break
    case 'department_head':
      result = await resolveDepartmentHead(supabase, rule, tenant_id)
      break
    case 'requester_dept_head':
      result = await resolveRequesterDeptHead(supabase, triggered_by_user_id, tenant_id)
      break
    case 'role_in_dept':
      result = await resolveRoleInDept(supabase, rule, tenant_id)
      break
    default:
      result = err(`Unknown rule type: "${(rule as AssigneeRule).type}".`)
  }

  return jsonResponse(result)
})
