import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SerializedGraph } from '@/lib/flows/graph'

const mockGetSessionClaims = vi.hoisted(() => vi.fn())
const mockCreateAdminClient = vi.hoisted(() => vi.fn())

vi.mock('@/lib/supabase/auth-helpers', () => ({
  getSessionClaims: mockGetSessionClaims,
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: mockCreateAdminClient,
}))

import {
  saveDraftVersion,
  getLatestDraftGraph,
  getFlowVersions,
  getFlows,
  publishFlow,
  unpublishFlow,
  restoreVersion,
} from './actions'

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
    eq: () => chain,
    order: () => chain,
    limit: () => chain,
    single: () => dequeue(),
    maybeSingle: () => dequeue(), // _value and _reason are unused parameters
    then: (onFulfilled: (_value: unknown) => unknown, onRejected?: (_reason: unknown) => unknown) =>
      dequeue().then(onFulfilled, onRejected),
    catch: (onRejected: (reason: unknown) => unknown) => dequeue().catch(onRejected),
  }

  return { from: (_table: string) => chain }
}

const emptyGraph: SerializedGraph = {
  // _table is unused parameter
  nodes: [],
  edges: [],
  metadata: { schemaVersion: 1 },
}

function mockAdminSession(tenantId = 'tenant-1', userId = 'user-1') {
  mockGetSessionClaims.mockResolvedValue({
    user: { id: userId, email: 'admin@test.com' },
    claims: { tenant_id: tenantId, role: 'admin' as const },
  })
}

describe('flow server actions — auth gates', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects unauthenticated callers for getFlows', async () => {
    mockGetSessionClaims.mockResolvedValue({
      user: null,
      claims: { tenant_id: null, role: null },
    })

    expect((await getFlows()).error).toBe('Unauthenticated')
    expect(mockCreateAdminClient).not.toHaveBeenCalled()
  })

  it('rejects unauthenticated callers for every action', async () => {
    mockGetSessionClaims.mockResolvedValue({
      user: null,
      claims: { tenant_id: null, role: null },
    })

    expect((await saveDraftVersion('f1', emptyGraph)).error).toBe('Unauthenticated')
    expect((await getLatestDraftGraph('f1')).error).toBe('Unauthenticated')
    expect((await getFlowVersions('f1')).error).toBe('Unauthenticated')
    expect((await publishFlow('f1')).error).toBe('Unauthenticated')
    expect((await unpublishFlow('f1')).error).toBe('Unauthenticated')
    expect((await restoreVersion('f1', 'v1')).error).toBe('Unauthenticated')

    expect(mockCreateAdminClient).not.toHaveBeenCalled()
  })

  it('rejects non-admin role', async () => {
    mockGetSessionClaims.mockResolvedValue({
      user: { id: 'u1', email: 'u@test.com' },
      claims: { tenant_id: 't1', role: 'user' },
    })

    expect((await saveDraftVersion('f1', emptyGraph)).error).toBe('Unauthorized')
    expect((await getLatestDraftGraph('f1')).error).toBe('Unauthorized')
    expect(mockCreateAdminClient).not.toHaveBeenCalled()
  })

  it('rejects admin without tenant_id', async () => {
    mockGetSessionClaims.mockResolvedValue({
      user: { id: 'u1', email: 'a@test.com' },
      claims: { tenant_id: null, role: 'admin' },
    })

    expect((await publishFlow('f1')).error).toBe('Tenant not found')
    expect(mockCreateAdminClient).not.toHaveBeenCalled()
  })
})

describe('flow server actions — tenant / flow access', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAdminSession()
  })

  /** Each action gets a fresh client; assertFlowInTenant sees no matching flow row. */
  function mockFlowNotInTenant() {
    mockCreateAdminClient.mockReturnValueOnce(
      createQueuedSupabaseMock([{ data: null, error: null }])
    )
  }

  it('denies when flow is not in tenant (all mutations and reads)', async () => {
    mockFlowNotInTenant()
    expect((await saveDraftVersion('other-flow', emptyGraph)).error).toBe(
      'Flow not found or access denied'
    )
    mockFlowNotInTenant()
    expect((await getLatestDraftGraph('other-flow')).error).toBe('Flow not found or access denied')
    mockFlowNotInTenant()
    expect((await getFlowVersions('other-flow')).error).toBe('Flow not found or access denied')
    mockFlowNotInTenant()
    expect((await publishFlow('other-flow')).error).toBe('Flow not found or access denied')
    mockFlowNotInTenant()
    expect((await unpublishFlow('other-flow')).error).toBe('Flow not found or access denied')
    mockFlowNotInTenant()
    expect((await restoreVersion('other-flow', 'v1')).error).toBe('Flow not found or access denied')
  })
})

describe('saveDraftVersion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAdminSession()
  })

  it('saves when flow belongs to tenant (no prior version)', async () => {
    mockCreateAdminClient.mockReturnValue(
      createQueuedSupabaseMock([
        { data: { id: 'flow-1' }, error: null }, // assertFlowInTenant
        { data: null, error: { code: 'PGRST116' } }, // max version — no rows
        { data: { id: 'ver-new', version_number: 1 }, error: null }, // insert
        { data: null, error: null }, // update flows
      ])
    )

    const result = await saveDraftVersion('flow-1', emptyGraph)
    expect(result.error).toBeUndefined()
    expect(result.versionId).toBe('ver-new')
    expect(result.versionNumber).toBe(1)
  })
})

describe('getLatestDraftGraph', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAdminSession()
  })

  it('returns null graph with no error when no versions yet (PGRST116)', async () => {
    mockCreateAdminClient.mockReturnValue(
      createQueuedSupabaseMock([
        { data: { id: 'flow-1' }, error: null },
        { data: null, error: { code: 'PGRST116' } },
      ])
    )

    const result = await getLatestDraftGraph('flow-1')
    expect(result.error).toBeUndefined()
    expect(result.graph).toBeNull()
  })
})

describe('getFlows', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAdminSession()
  })

  it('maps rows to FlowListItem with category fields', async () => {
    const rows = [
      {
        id: 'flow-1',
        name: 'Approvals',
        status: 'published',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-02T00:00:00Z',
        flow_versions: { version_number: 2, published_at: '2026-01-01T12:00:00Z' },
        flow_categories: { id: 'cat-1', name: 'HR', color: '#6366f1' },
      },
      {
        id: 'flow-2',
        name: 'Draft only',
        status: 'draft',
        created_at: '2026-01-03T00:00:00Z',
        updated_at: '2026-01-04T00:00:00Z',
        flow_versions: null,
        flow_categories: null,
      },
    ]
    mockCreateAdminClient.mockReturnValue(createQueuedSupabaseMock([{ data: rows, error: null }]))

    const result = await getFlows()
    expect(result.error).toBeNull()
    expect(result.flows).toHaveLength(2)
    expect(result.flows[0]).toMatchObject({
      id: 'flow-1',
      name: 'Approvals',
      status: 'published',
      categoryId: 'cat-1',
      categoryName: 'HR',
      categoryColor: '#6366f1',
      versionNumber: 2,
    })
    expect(result.flows[1]).toMatchObject({
      id: 'flow-2',
      categoryId: null,
      categoryName: null,
      categoryColor: null,
      versionNumber: null,
    })
  })

  it('surfaces select errors', async () => {
    mockCreateAdminClient.mockReturnValue(
      createQueuedSupabaseMock([{ data: null, error: { message: 'relation missing' } }])
    )

    const result = await getFlows()
    expect(result.flows).toEqual([])
    expect(result.error).toBe('relation missing')
  })
})

describe('getFlowVersions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAdminSession()
  })

  it('returns version rows for an allowed flow', async () => {
    const rows = [
      {
        id: 'v1',
        version_number: 1,
        published_at: null as string | null,
        created_at: '2026-01-01',
      },
    ]
    mockCreateAdminClient.mockReturnValue(
      createQueuedSupabaseMock([
        { data: { id: 'flow-1' }, error: null },
        { data: rows, error: null },
      ])
    )

    const result = await getFlowVersions('flow-1')
    expect(result.error).toBeUndefined()
    expect(result.versions).toEqual(rows)
  })
})

describe('publishFlow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAdminSession()
  })

  it('publishes when latest_version_id exists', async () => {
    mockCreateAdminClient.mockReturnValue(
      createQueuedSupabaseMock([
        { data: { id: 'flow-1' }, error: null },
        { data: { latest_version_id: 'lv-99' }, error: null },
        { data: null, error: null },
        { data: null, error: null },
      ])
    )

    const result = await publishFlow('flow-1')
    expect(result.error).toBeNull()
  })

  it('fails when flow has no saved version', async () => {
    mockCreateAdminClient.mockReturnValue(
      createQueuedSupabaseMock([
        { data: { id: 'flow-1' }, error: null },
        { data: { latest_version_id: null }, error: null },
      ])
    )

    const result = await publishFlow('flow-1')
    expect(result.error).toBe('Could not find a saved version to publish.')
  })
})

describe('unpublishFlow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAdminSession()
  })

  it('unpublishes an allowed flow', async () => {
    mockCreateAdminClient.mockReturnValue(
      createQueuedSupabaseMock([
        { data: { id: 'flow-1' }, error: null },
        { data: null, error: null },
      ])
    )

    const result = await unpublishFlow('flow-1')
    expect(result.error).toBeNull()
  })
})

describe('restoreVersion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAdminSession()
  })

  it('fails when version does not belong to the flow', async () => {
    mockCreateAdminClient.mockReturnValue(
      createQueuedSupabaseMock([
        { data: { id: 'flow-1' }, error: null },
        { data: null, error: { message: 'not found' } },
      ])
    )

    const result = await restoreVersion('flow-1', 'foreign-version')
    expect(result.error).toBe('Version not found.')
  })

  it('appends a new draft from an existing version graph', async () => {
    const graphPayload = { nodes: [], edges: [], metadata: { schemaVersion: 1 } }
    mockCreateAdminClient.mockReturnValue(
      createQueuedSupabaseMock([
        { data: { id: 'flow-1' }, error: null },
        { data: { graph: graphPayload, version_number: 1 }, error: null },
        { data: { version_number: 3 }, error: null },
        { data: { id: 'ver-4' }, error: null },
        { data: null, error: null },
      ])
    )

    const result = await restoreVersion('flow-1', 'ver-old')
    expect(result.error).toBeNull()
  })
})
