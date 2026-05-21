// FILE PATH: src/app/api/flows/versions/[versionId]/route.ts
// Lightweight GET endpoint used by VersionListPanel to load a single version's
// graph for canvas preview. We don't include graph in the version list query
// (would fetch up to 20 large JSONB blobs at once), so previewing fetches just
// the one version's graph on demand via this route.

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionClaims } from '@/lib/supabase/auth-helpers'

export async function GET(_req: NextRequest, { params }: { params: { versionId: string } }) {
  // This route uses the service-role client (bypasses RLS), so we MUST enforce
  // tenant ownership in-app — otherwise any authenticated user could read any
  // tenant's flow graph by guessing a version id.
  const { user, claims } = await getSessionClaims()
  if (!user || !claims.tenant_id) {
    return NextResponse.json({ graph: null, error: 'Unauthorized' }, { status: 401 })
  }

  const db = createAdminClient()

  // Two queries instead of an embedded join: flow_versions↔flows is ambiguous
  // in PostgREST (flow_versions.flow_id and flows.latest_version_id both link
  // the tables), so we resolve the owning flow's tenant separately.
  const { data: version, error } = await db
    .from('flow_versions')
    .select('graph, flow_id')
    .eq('id', params.versionId)
    .single()

  if (error || !version) {
    return NextResponse.json({ graph: null, error: 'Version not found.' }, { status: 404 })
  }

  const { data: flow } = await db
    .from('flows')
    .select('tenant_id')
    .eq('id', version.flow_id)
    .single()

  // Wrong tenant → respond exactly like "not found" so existence isn't revealed.
  if (!flow || flow.tenant_id !== claims.tenant_id) {
    return NextResponse.json({ graph: null, error: 'Version not found.' }, { status: 404 })
  }

  return NextResponse.json({ graph: version.graph, error: null })
}
