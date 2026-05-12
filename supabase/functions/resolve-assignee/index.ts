// FILE PATH: supabase/functions/resolve-assignee/index.ts
// Deploy: npx supabase functions deploy resolve-assignee --no-verify-jwt --project-ref <ref>

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AssigneeRule =
  | { type: 'requester' } // ADD
  | { type: 'fixed'; email: string }
  | { type: 'manager_of_requestor' }
  | { type: 'skip_level' }
  | { type: 'department_head'; department_id: string }
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
// Rule resolvers
// ---------------------------------------------------------------------------

// ADD: requester — simply return triggered_by_user_id as-is.
// The step is assigned back to whoever triggered the flow.
// We still verify the user exists in the tenant as a safety check.
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
  if (!requestor.manager_id) {
    return err(
      `Cannot resolve manager: user "${requestor.full_name ?? triggeredByUserId}" has no manager assigned.`
    )
  }

  const { data: manager, error: managerError } = await supabase
    .from('users')
    .select('id, full_name')
    .eq('id', requestor.manager_id)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (managerError) return err(`DB error looking up manager: ${managerError.message}`)
  if (!manager) {
    return err(
      `Manager not found: manager_id "${requestor.manager_id}" does not exist in this tenant.`
    )
  }

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
  if (!requestor.manager_id) {
    return err(
      `Cannot resolve skip-level: user "${requestor.full_name ?? triggeredByUserId}" has no manager assigned.`
    )
  }

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

  // Fallback: direct manager has no manager — return direct manager
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
 * department_head: first user in a department, ordered alphabetically.
 */
async function resolveDepartmentHead(
  supabase: ReturnType<typeof getAdminClient>,
  rule: Extract<AssigneeRule, { type: 'department_head' }>,
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
    .order('full_name', { ascending: true })
    .limit(1)

  if (usersError) return err(`DB error looking up department head: ${usersError.message}`)
  if (!users || users.length === 0) {
    return err(
      `No user found in department "${dept.name}". Assign at least one user to this department.`
    )
  }

  return ok(users[0].id)
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
  if (!users || users.length === 0) {
    return err(`No user with role "${rule.role}" found in department "${dept.name}".`)
  }

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
    case 'requester': // ADD
      result = await resolveRequester(supabase, triggered_by_user_id, tenant_id)
      break // ADD
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
    case 'role_in_dept':
      result = await resolveRoleInDept(supabase, rule, tenant_id)
      break
    default:
      result = err(`Unknown rule type: "${(rule as AssigneeRule).type}".`)
  }

  return jsonResponse(result)
})
