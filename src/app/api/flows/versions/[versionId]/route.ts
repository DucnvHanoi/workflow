// FILE PATH: src/app/api/flows/versions/[versionId]/route.ts
// Lightweight GET endpoint used by VersionListPanel to load a single version's
// graph for canvas preview. We don't include graph in the version list query
// (would fetch up to 20 large JSONB blobs at once), so previewing fetches just
// the one version's graph on demand via this route.

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(_req: NextRequest, { params }: { params: { versionId: string } }) {
  const db = createAdminClient()

  const { data, error } = await db
    .from('flow_versions')
    .select('graph')
    .eq('id', params.versionId)
    .single()

  if (error || !data) {
    return NextResponse.json({ graph: null, error: 'Version not found.' }, { status: 404 })
  }

  return NextResponse.json({ graph: data.graph, error: null })
}
