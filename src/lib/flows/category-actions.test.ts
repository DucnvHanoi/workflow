import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetSessionClaims = vi.hoisted(() => vi.fn())
const mockCreateAdminClient = vi.hoisted(() => vi.fn())

vi.mock('@/lib/supabase/auth-helpers', () => ({
  getSessionClaims: mockGetSessionClaims,
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: mockCreateAdminClient,
}))

import {
  getCategories,
  createCategory,
  renameCategory,
  updateCategory,
  deleteCategory,
  updateFlowCategory,
} from './category-actions'

/** Terminal responses consumed in order by .single(), .maybeSingle(), or await builder. */
function createQueuedSupabaseMock(queue: Array<{ data: unknown; error: unknown | null }>) {
  function dequeue() {
    const next = queue.shift()
    if (!next) {
      // _value and _reason are unused parameters
      return Promise.resolve({
        data: null,
        error: { message: 'mock queue exhausted' }, // _reason is unused parameter
      })
    }
    return Promise.resolve(next)
  }

  const chain = {
    select: () => chain,
    insert: () => chain,
    update: () => chain,
    delete: () => chain,
    eq: () => chain,
    order: () => chain,
    single: () => dequeue(),
    maybeSingle: () => dequeue(),
    then: (onFulfilled: (_value: unknown) => unknown, onRejected?: (_reason: unknown) => unknown) =>
      dequeue().then(onFulfilled, onRejected),
    catch: (onRejected: (reason: unknown) => unknown) => dequeue().catch(onRejected),
  }
  return { from: (_table: string) => chain }
}

function mockAdminSession(tenantId = 'tenant-1') {
  mockGetSessionClaims.mockResolvedValue({
    user: { id: 'user-1', email: 'admin@test.com' },
    claims: { tenant_id: tenantId, role: 'admin' as const },
  })
}

describe('category-actions — auth gates', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects unauthenticated callers', async () => {
    mockGetSessionClaims.mockResolvedValue({
      user: null,
      claims: { tenant_id: null, role: null },
    })

    // getCategories() returns empty silently for unauthenticated callers — intentional,
    // it is used on the /flows server page before auth resolves.
    expect((await getCategories()).error).toBeNull()
    expect((await getCategories()).categories).toEqual([])

    // All mutation actions must reject unauthenticated callers.
    expect((await createCategory('x')).error).toBe('Unauthenticated')
    expect((await renameCategory('c1', 'x')).error).toBe('Unauthenticated')
    expect((await updateCategory('c1', 'x', '#fff')).error).toBe('Unauthenticated')
    expect((await deleteCategory('c1')).error).toBe('Unauthenticated')
    expect((await updateFlowCategory('f1', null)).error).toBe('Unauthenticated')

    // requireAdmin() returns before constructing the admin client on auth failure.
    expect(mockCreateAdminClient).not.toHaveBeenCalled()
  })

  it('rejects non-admin role for mutations', async () => {
    mockGetSessionClaims.mockResolvedValue({
      user: { id: 'u1', email: 'u@test.com' },
      claims: { tenant_id: 't1', role: 'user' },
    })

    // Mutation actions require admin — all must reject with 'Unauthorized'.
    expect((await createCategory('x')).error).toBe('Unauthorized')
    expect((await renameCategory('c1', 'x')).error).toBe('Unauthorized')
    expect((await updateCategory('c1', 'x', '#fff')).error).toBe('Unauthorized')
    expect((await deleteCategory('c1')).error).toBe('Unauthorized')
    expect((await updateFlowCategory('f1', null)).error).toBe('Unauthorized')

    // requireAdmin() returns before constructing the admin client on role failure.
    expect(mockCreateAdminClient).not.toHaveBeenCalled()
  })

  it('rejects admin without tenant_id', async () => {
    mockGetSessionClaims.mockResolvedValue({
      user: { id: 'u1', email: 'a@test.com' },
      claims: { tenant_id: null, role: 'admin' },
    })

    expect((await deleteCategory('c1')).error).toBe('Tenant not found')
    expect(mockCreateAdminClient).not.toHaveBeenCalled()
  })
})

describe('getCategories', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAdminSession()
  })

  it('returns sorted categories', async () => {
    const rows = [
      { id: 'c-a', name: 'Alpha', color: '#111' },
      { id: 'c-b', name: 'Beta', color: '#222' },
    ]
    mockCreateAdminClient.mockReturnValue(createQueuedSupabaseMock([{ data: rows, error: null }]))

    const result = await getCategories()
    expect(result.error).toBeNull()
    expect(result.categories).toEqual(rows)
  })

  it('surfaces Supabase errors', async () => {
    mockCreateAdminClient.mockReturnValue(
      createQueuedSupabaseMock([{ data: null, error: { message: 'db down' } }])
    )

    const result = await getCategories()
    expect(result.categories).toEqual([])
    expect(result.error).toBe('db down')
  })
})

describe('createCategory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAdminSession()
  })

  it('validates non-empty name', async () => {
    const result = await createCategory('   ')
    expect(result.category).toBeNull()
    expect(result.error).toBe('Category name cannot be empty.')
    // requireAdmin() constructs the admin client before validation runs
    expect(mockCreateAdminClient).toHaveBeenCalledTimes(1)
  })

  it('validates max length', async () => {
    const result = await createCategory('x'.repeat(81))
    expect(result.error).toBe('Name must be 80 characters or fewer.')
    expect(mockCreateAdminClient).toHaveBeenCalledTimes(1)
  })

  it('inserts and returns the row', async () => {
    const cat = { id: 'new-c', name: 'HR', color: '#6366f1' }
    mockCreateAdminClient.mockReturnValue(createQueuedSupabaseMock([{ data: cat, error: null }]))

    const result = await createCategory('  HR  ', '#6366f1')
    expect(result.error).toBeNull()
    expect(result.category).toEqual(cat)
  })
})

describe('renameCategory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAdminSession()
  })

  it('validates name', async () => {
    expect((await renameCategory('c1', '   ')).error).toBe('Category name cannot be empty.')
  })

  it('updates successfully', async () => {
    mockCreateAdminClient.mockReturnValue(createQueuedSupabaseMock([{ data: null, error: null }]))

    const result = await renameCategory('c1', 'Renamed')
    expect(result.error).toBeNull()
  })
})

describe('updateCategory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAdminSession()
  })

  it('updates name and color', async () => {
    mockCreateAdminClient.mockReturnValue(createQueuedSupabaseMock([{ data: null, error: null }]))

    const result = await updateCategory('c1', 'Legal', '#ef4444')
    expect(result.error).toBeNull()
  })

  it('validates empty name', async () => {
    expect((await updateCategory('c1', '  ', '#fff')).error).toBe('Category name cannot be empty.')
  })
})

describe('deleteCategory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAdminSession()
  })

  it('deletes successfully', async () => {
    mockCreateAdminClient.mockReturnValue(createQueuedSupabaseMock([{ data: null, error: null }]))

    expect((await deleteCategory('c1')).error).toBeNull()
  })
})

describe('updateFlowCategory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAdminSession()
  })

  it('fails when flow is missing', async () => {
    mockCreateAdminClient.mockReturnValue(createQueuedSupabaseMock([{ data: null, error: null }]))

    const result = await updateFlowCategory('missing-flow', null)
    expect(result.error).toBe('Flow not found or access denied')
  })

  it('clears category when categoryId is null', async () => {
    mockCreateAdminClient.mockReturnValue(
      createQueuedSupabaseMock([
        { data: { id: 'flow-1' }, error: null },
        { data: null, error: null },
      ])
    )

    expect((await updateFlowCategory('flow-1', null)).error).toBeNull()
  })

  it('fails when category does not exist in tenant', async () => {
    mockCreateAdminClient.mockReturnValue(
      createQueuedSupabaseMock([
        { data: { id: 'flow-1' }, error: null },
        { data: null, error: null },
      ])
    )

    const result = await updateFlowCategory('flow-1', 'foreign-cat')
    expect(result.error).toBe('Category not found or access denied')
  })

  it('assigns category when flow and category exist', async () => {
    mockCreateAdminClient.mockReturnValue(
      createQueuedSupabaseMock([
        { data: { id: 'flow-1' }, error: null },
        { data: { id: 'cat-1' }, error: null },
        { data: null, error: null },
      ])
    )

    expect((await updateFlowCategory('flow-1', 'cat-1')).error).toBeNull()
  })

  it('surfaces flow select errors', async () => {
    mockCreateAdminClient.mockReturnValue(
      createQueuedSupabaseMock([{ data: null, error: { message: 'timeout' } }])
    )

    expect((await updateFlowCategory('flow-1', null)).error).toBe('timeout')
  })
})
