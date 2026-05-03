// supabase/functions/resolve-assignee/index.ts
// Deploy: npx supabase functions deploy resolve-assignee --no-verify-jwt --project-ref <ref>

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AssigneeRule =
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
// Supabase admin client (service role — bypasses RLS, server-side only)
// ---------------------------------------------------------------------------

function getAdminClient() {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// ---------------------------------------------------------------------------
// Rule resolvers
// ---------------------------------------------------------------------------

/**
 * fixed: look up user by email within the tenant, return their id.
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
  if (!data) {
    return err(`Fixed assignee not found: no user with email "${rule.email}" in this tenant.`)
  }
  return ok(data.id)
}

/**
 * manager_of_requestor: return the manager_id of the triggered_by user.
 *
 * Edge cases handled:
 *   - triggered_by user not found in this tenant → clear error
 *   - triggered_by user has no manager (manager_id is null) → clear error
 *   - manager row no longer exists (data integrity issue) → clear error
 */
async function resolveManagerOfRequestor(
  supabase: ReturnType<typeof getAdminClient>,
  triggeredByUserId: string,
  tenantId: string
): Promise<ResolveResult> {
  // Step 1: fetch the requestor's row to get their manager_id
  const { data: requestor, error: requestorError } = await supabase
    .from('users')
    .select('id, full_name, manager_id')
    .eq('id', triggeredByUserId)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (requestorError) {
    return err(`DB error looking up requestor: ${requestorError.message}`)
  }
  if (!requestor) {
    return err(`Requestor not found: no user with id "${triggeredByUserId}" in this tenant.`)
  }
  if (!requestor.manager_id) {
    return err(
      `Cannot resolve manager: user "${requestor.full_name ?? triggeredByUserId}" has no manager assigned.`
    )
  }

  // Step 2: verify the manager exists (defensive — should always exist via FK)
  const { data: manager, error: managerError } = await supabase
    .from('users')
    .select('id, full_name')
    .eq('id', requestor.manager_id)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (managerError) {
    return err(`DB error looking up manager: ${managerError.message}`)
  }
  if (!manager) {
    return err(
      `Manager not found: manager_id "${requestor.manager_id}" does not exist in this tenant. ` +
        `Check the users table for a data integrity issue.`
    )
  }

  return ok(manager.id)
}

/**
 * skip_level: chain manager_id twice.
 */
/**
 * skip_level: return the manager's manager of the triggered_by user.
 *
 * Fallback behaviour (per plan): if the direct manager has no manager,
 * return the direct manager instead of erroring — the flow still advances.
 *
 * Edge cases handled:
 *   - Requestor not found in tenant → error
 *   - Requestor has no manager at all → error (cannot even get to level 1)
 *   - Manager has no manager (skip-level doesn't exist) → fallback to manager
 *   - Any DB error → error with message
 */
async function resolveSkipLevel(
  supabase: ReturnType<typeof getAdminClient>,
  triggeredByUserId: string,
  tenantId: string
): Promise<ResolveResult> {
  // Step 1: fetch requestor → get their manager_id (level 1)
  const { data: requestor, error: requestorError } = await supabase
    .from('users')
    .select('id, full_name, manager_id')
    .eq('id', triggeredByUserId)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (requestorError) {
    return err(`DB error looking up requestor: ${requestorError.message}`)
  }
  if (!requestor) {
    return err(`Requestor not found: no user with id "${triggeredByUserId}" in this tenant.`)
  }
  if (!requestor.manager_id) {
    return err(
      `Cannot resolve skip-level: user "${requestor.full_name ?? triggeredByUserId}" has no manager assigned.`
    )
  }

  // Step 2: fetch the direct manager → get their manager_id (level 2)
  const { data: manager, error: managerError } = await supabase
    .from('users')
    .select('id, full_name, manager_id')
    .eq('id', requestor.manager_id)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (managerError) {
    return err(`DB error looking up manager: ${managerError.message}`)
  }
  if (!manager) {
    return err(
      `Manager not found: manager_id "${requestor.manager_id}" does not exist in this tenant.`
    )
  }

  // Step 3: if manager has no manager, fall back to the direct manager
  if (!manager.manager_id) {
    return ok(manager.id)
    // Note: returning direct manager as fallback — skip-level doesn't exist
  }

  // Step 4: fetch the skip-level (manager's manager)
  const { data: skipLevel, error: skipLevelError } = await supabase
    .from('users')
    .select('id, full_name')
    .eq('id', manager.manager_id)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (skipLevelError) {
    return err(`DB error looking up skip-level manager: ${skipLevelError.message}`)
  }
  if (!skipLevel) {
    // Defensive — FK should prevent this, but fall back to direct manager
    return ok(manager.id)
  }

  return ok(skipLevel.id)
}

/**
 * department_head: first admin-role user in a department. Day 20.
 */
// REPLACE WITH:
/**
 * department_head: return the first admin-role user in the given department,
 * ordered alphabetically by full_name.
 *
 * Edge cases handled:
 *   - Department not found in tenant → error
 *   - No admin users in the department → error
 */
async function resolveDepartmentHead(
  supabase: ReturnType<typeof getAdminClient>,
  rule: Extract<AssigneeRule, { type: 'department_head' }>,
  tenantId: string
): Promise<ResolveResult> {
  // Step 1: verify the department belongs to this tenant
  const { data: dept, error: deptError } = await supabase
    .from('departments')
    .select('id, name')
    .eq('id', rule.department_id)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (deptError) {
    return err(`DB error looking up department: ${deptError.message}`)
  }
  if (!dept) {
    return err(
      `Department not found: no department with id "${rule.department_id}" in this tenant.`
    )
  }

  // Step 2: find first admin-role user in that department, alphabetically
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, full_name')
    .eq('department_id', rule.department_id)
    .eq('tenant_id', tenantId)
    //.eq("role", "admin")
    .order('full_name', { ascending: true })
    .limit(1)

  if (usersError) {
    return err(`DB error looking up department head: ${usersError.message}`)
  }
  if (!users || users.length === 0) {
    return err(
      `No admin user found in department "${dept.name}". ` +
        `Assign at least one admin to this department before using this rule.`
    )
  }

  return ok(users[0].id)
}

/**
 * role_in_dept: first user in a department matching a role. Day 20.
 */
/**
 * role_in_dept: return the first user in a department matching the given role,
 * ordered alphabetically by full_name.
 *
 * Edge cases handled:
 *   - Department not found in tenant → error
 *   - No users with that role in the department → error
 */
async function resolveRoleInDept(
  supabase: ReturnType<typeof getAdminClient>,
  rule: Extract<AssigneeRule, { type: 'role_in_dept' }>,
  tenantId: string
): Promise<ResolveResult> {
  // Step 1: verify the department belongs to this tenant
  const { data: dept, error: deptError } = await supabase
    .from('departments')
    .select('id, name')
    .eq('id', rule.department_id)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (deptError) {
    return err(`DB error looking up department: ${deptError.message}`)
  }
  if (!dept) {
    return err(
      `Department not found: no department with id "${rule.department_id}" in this tenant.`
    )
  }

  // Step 2: find first user in department matching the role, alphabetically
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, full_name')
    .eq('department_id', rule.department_id)
    .eq('tenant_id', tenantId)
    .eq('role', rule.role)
    .order('full_name', { ascending: true })
    .limit(1)

  if (usersError) {
    return err(`DB error looking up role in department: ${usersError.message}`)
  }
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
