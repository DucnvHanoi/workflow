// supabase/functions/resolve-assignee/index.test.ts
// Run: deno test --allow-env supabase/functions/resolve-assignee/index.test.ts

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'

// ---------------------------------------------------------------------------
// Minimal mock of the Supabase query builder
// Call mockSupabase(rows) to get a client that returns those rows.
// Call mockSupabase(rows, true) to simulate a DB error.
// ---------------------------------------------------------------------------

function mockSupabase(rows: Record<string, unknown>[], simulateError = false) {
  const queryBuilder = {
    _rows: rows,
    select(_cols: string) {
      return this
    },
    eq(_col: string, _val: unknown) {
      return this
    },
    order(_col: string, _opts?: unknown) {
      return this
    },
    limit(_n: number) {
      return this
    },
    async maybeSingle() {
      if (simulateError) return { data: null, error: { message: 'mock DB error' } }
      return { data: this._rows[0] ?? null, error: null }
    },
    // maybeSingle() alias used by limit(1) path
    then: undefined as unknown,
    // make it thenable so await works on the builder directly
    async [Symbol.asyncIterator]() {
      if (simulateError) return { data: null, error: { message: 'mock DB error' } }
      return { data: this._rows, error: null }
    },
  }

  // Override: when limit(1) is used we need to return { data: rows, error }
  // We achieve this by making the builder itself awaitable.
  const awaitableBuilder = {
    ...queryBuilder,
    // biome-ignore lint: mock
    then(resolve: (v: unknown) => void) {
      if (simulateError) {
        resolve({ data: null, error: { message: 'mock DB error' } })
      } else {
        resolve({ data: rows, error: null })
      }
    },
  }

  return {
    from(_table: string) {
      return awaitableBuilder
    },
  }
}

// ---------------------------------------------------------------------------
// Import the resolvers directly by re-exporting them from a test-friendly
// wrapper. Since Deno modules are URL-based we inline the logic here to keep
// tests self-contained and fast.
// ---------------------------------------------------------------------------

type ResolveResult =
  | { assigned_to_user_id: string; error: null }
  | { assigned_to_user_id: null; error: string }

function ok(userId: string): ResolveResult {
  return { assigned_to_user_id: userId, error: null }
}
function err(message: string): ResolveResult {
  return { assigned_to_user_id: null, error: message }
}

// Inlined resolver logic (mirrors index.ts exactly — update both if logic changes)

async function resolveFixed(
  supabase: ReturnType<typeof mockSupabase>,
  email: string,
  tenantId: string
): Promise<ResolveResult> {
  const { data, error } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .eq('tenant_id', tenantId)
    .maybeSingle()
  if (error) return err(`DB error: ${error.message}`)
  if (!data) return err(`Fixed assignee not found: no user with email "${email}" in this tenant.`)
  return ok((data as { id: string }).id)
}

async function resolveManagerOfRequestor(
  supabase: ReturnType<typeof mockSupabase>,
  triggeredByUserId: string,
  tenantId: string
): Promise<ResolveResult> {
  const { data: requestor, error: e1 } = await supabase
    .from('users')
    .select('id, full_name, manager_id')
    .eq('id', triggeredByUserId)
    .eq('tenant_id', tenantId)
    .maybeSingle()
  if (e1) return err(`DB error: ${e1.message}`)
  if (!requestor)
    return err(`Requestor not found: no user with id "${triggeredByUserId}" in this tenant.`)
  const r = requestor as { id: string; full_name: string; manager_id: string | null }
  if (!r.manager_id)
    return err(`Cannot resolve manager: user "${r.full_name}" has no manager assigned.`)
  const { data: manager, error: e2 } = await supabase
    .from('users')
    .select('id, full_name')
    .eq('id', r.manager_id)
    .eq('tenant_id', tenantId)
    .maybeSingle()
  if (e2) return err(`DB error: ${e2.message}`)
  if (!manager) return err(`Manager not found: manager_id "${r.manager_id}" does not exist.`)
  return ok((manager as { id: string }).id)
}

async function resolveSkipLevel(
  supabase: ReturnType<typeof mockSupabase>,
  triggeredByUserId: string,
  tenantId: string
): Promise<ResolveResult> {
  const { data: requestor, error: e1 } = await supabase
    .from('users')
    .select('id, full_name, manager_id')
    .eq('id', triggeredByUserId)
    .eq('tenant_id', tenantId)
    .maybeSingle()
  if (e1) return err(`DB error: ${e1.message}`)
  if (!requestor)
    return err(`Requestor not found: no user with id "${triggeredByUserId}" in this tenant.`)
  const r = requestor as { id: string; full_name: string; manager_id: string | null }
  if (!r.manager_id)
    return err(`Cannot resolve skip-level: user "${r.full_name}" has no manager assigned.`)
  const { data: manager, error: e2 } = await supabase
    .from('users')
    .select('id, full_name, manager_id')
    .eq('id', r.manager_id)
    .eq('tenant_id', tenantId)
    .maybeSingle()
  if (e2) return err(`DB error: ${e2.message}`)
  if (!manager) return err(`Manager not found.`)
  const m = manager as { id: string; full_name: string; manager_id: string | null }
  if (!m.manager_id) return ok(m.id) // fallback
  const { data: skipLevel, error: e3 } = await supabase
    .from('users')
    .select('id, full_name')
    .eq('id', m.manager_id)
    .eq('tenant_id', tenantId)
    .maybeSingle()
  if (e3) return err(`DB error: ${e3.message}`)
  if (!skipLevel) return ok(m.id) // fallback
  return ok((skipLevel as { id: string }).id)
}

// ---------------------------------------------------------------------------
// Tests — fixed rule
// ---------------------------------------------------------------------------

Deno.test('fixed: returns user id when email exists', async () => {
  const supabase = mockSupabase([{ id: 'user-1' }])
  const result = await resolveFixed(supabase, 'alice@example.com', 'tenant-1')
  assertEquals(result, ok('user-1'))
})

Deno.test('fixed: returns error when email not found', async () => {
  const supabase = mockSupabase([])
  const result = await resolveFixed(supabase, 'ghost@example.com', 'tenant-1')
  assertEquals(result.assigned_to_user_id, null)
  assertEquals(result.error?.includes('not found'), true)
})

Deno.test('fixed: returns error on DB failure', async () => {
  const supabase = mockSupabase([], true)
  const result = await resolveFixed(supabase, 'alice@example.com', 'tenant-1')
  assertEquals(result.assigned_to_user_id, null)
  assertEquals(result.error?.includes('DB error'), true)
})

// ---------------------------------------------------------------------------
// Tests — manager_of_requestor rule
// ---------------------------------------------------------------------------

Deno.test('manager: returns manager id when chain exists', async () => {
  // Two sequential calls: first returns requestor, second returns manager
  let call = 0
  const supabase = {
    from(_t: string) {
      return {
        select(_c: string) {
          return this
        },
        eq(_c: string, _v: unknown) {
          return this
        },
        order(_c: string, _o?: unknown) {
          return this
        },
        limit(_n: number) {
          return this
        },
        async maybeSingle() {
          call++
          if (call === 1)
            return { data: { id: 'user-a', full_name: 'Alice', manager_id: 'user-b' }, error: null }
          return { data: { id: 'user-b', full_name: 'Bob' }, error: null }
        },
      }
    },
  }
  const result = await resolveManagerOfRequestor(
    supabase as ReturnType<typeof mockSupabase>,
    'user-a',
    'tenant-1'
  )
  assertEquals(result, ok('user-b'))
})

Deno.test('manager: returns error when requestor has no manager', async () => {
  const supabase = {
    from(_t: string) {
      return {
        select(_c: string) {
          return this
        },
        eq(_c: string, _v: unknown) {
          return this
        },
        async maybeSingle() {
          return { data: { id: 'user-a', full_name: 'Alice', manager_id: null }, error: null }
        },
      }
    },
  }
  const result = await resolveManagerOfRequestor(
    supabase as ReturnType<typeof mockSupabase>,
    'user-a',
    'tenant-1'
  )
  assertEquals(result.assigned_to_user_id, null)
  assertEquals(result.error?.includes('no manager assigned'), true)
})

Deno.test('manager: returns error when requestor not found', async () => {
  const supabase = {
    from(_t: string) {
      return {
        select(_c: string) {
          return this
        },
        eq(_c: string, _v: unknown) {
          return this
        },
        async maybeSingle() {
          return { data: null, error: null }
        },
      }
    },
  }
  const result = await resolveManagerOfRequestor(
    supabase as ReturnType<typeof mockSupabase>,
    'bad-id',
    'tenant-1'
  )
  assertEquals(result.assigned_to_user_id, null)
  assertEquals(result.error?.includes('not found'), true)
})

// ---------------------------------------------------------------------------
// Tests — skip_level rule
// ---------------------------------------------------------------------------

Deno.test('skip_level: returns skip-level when full chain exists', async () => {
  let call = 0
  const supabase = {
    from(_t: string) {
      return {
        select(_c: string) {
          return this
        },
        eq(_c: string, _v: unknown) {
          return this
        },
        async maybeSingle() {
          call++
          if (call === 1)
            return { data: { id: 'user-a', full_name: 'Alice', manager_id: 'user-b' }, error: null }
          if (call === 2)
            return { data: { id: 'user-b', full_name: 'Bob', manager_id: 'user-c' }, error: null }
          return { data: { id: 'user-c', full_name: 'Carol' }, error: null }
        },
      }
    },
  }
  const result = await resolveSkipLevel(
    supabase as ReturnType<typeof mockSupabase>,
    'user-a',
    'tenant-1'
  )
  assertEquals(result, ok('user-c'))
})

Deno.test('skip_level: falls back to manager when skip-level absent', async () => {
  let call = 0
  const supabase = {
    from(_t: string) {
      return {
        select(_c: string) {
          return this
        },
        eq(_c: string, _v: unknown) {
          return this
        },
        async maybeSingle() {
          call++
          if (call === 1)
            return { data: { id: 'user-a', full_name: 'Alice', manager_id: 'user-b' }, error: null }
          return { data: { id: 'user-b', full_name: 'Bob', manager_id: null }, error: null }
        },
      }
    },
  }
  const result = await resolveSkipLevel(
    supabase as ReturnType<typeof mockSupabase>,
    'user-a',
    'tenant-1'
  )
  assertEquals(result, ok('user-b')) // fallback to direct manager
})

Deno.test('skip_level: returns error when requestor has no manager', async () => {
  const supabase = {
    from(_t: string) {
      return {
        select(_c: string) {
          return this
        },
        eq(_c: string, _v: unknown) {
          return this
        },
        async maybeSingle() {
          return { data: { id: 'user-a', full_name: 'Alice', manager_id: null }, error: null }
        },
      }
    },
  }
  const result = await resolveSkipLevel(
    supabase as ReturnType<typeof mockSupabase>,
    'user-a',
    'tenant-1'
  )
  assertEquals(result.assigned_to_user_id, null)
  assertEquals(result.error?.includes('no manager assigned'), true)
})
