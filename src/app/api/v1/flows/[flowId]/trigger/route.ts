import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyBearerKey } from '@/lib/api/auth'
import { checkApiKeyRate } from '@/lib/rate-limit'
import { fireWebhookEvent } from '@/lib/webhooks/deliver'
import type { SerializedGraph } from '@/lib/flows/graph'

function computeDueAt(slaHours: number | undefined | null): string | null {
  if (!slaHours || slaHours <= 0) return null
  return new Date(Date.now() + slaHours * 3_600_000).toISOString()
}

export async function POST(request: NextRequest, { params }: { params: { flowId: string } }) {
  // 1. Verify Bearer API key
  const { context, error: authError } = await verifyBearerKey(request.headers.get('authorization'))
  if (!context) {
    return NextResponse.json({ error: authError }, { status: 401 })
  }

  // 2. Rate limit: 60 req/min per key
  const allowed = await checkApiKeyRate(context.keyId)
  if (!allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Max 60 requests per minute.' },
      { status: 429, headers: { 'Retry-After': '60' } }
    )
  }

  // 3. Parse optional formData from body
  let formData: Record<string, unknown> = {}
  try {
    const body = await request.json()
    if (body && typeof body.formData === 'object' && body.formData !== null) {
      formData = body.formData as Record<string, unknown>
    }
  } catch {
    // No body or non-JSON — formData stays empty
  }

  const { flowId } = params
  const { tenantId, userId } = context
  const db = createAdminClient()
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.aitomicflow.com'

  // 4. Load flow — must belong to this tenant and be published
  const { data: flow, error: flowErr } = await db
    .from('flows')
    .select('id, name, status, latest_version_id')
    .eq('id', flowId)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (flowErr || !flow) {
    return NextResponse.json({ error: 'Flow not found.' }, { status: 404 })
  }
  if (flow.status !== 'published') {
    return NextResponse.json({ error: 'Flow is not published.' }, { status: 400 })
  }
  if (!flow.latest_version_id) {
    return NextResponse.json({ error: 'Flow has no published version.' }, { status: 400 })
  }

  const flowName = (flow.name as string) ?? 'Flow'

  // 5. Load flow version graph
  const { data: version, error: versionErr } = await db
    .from('flow_versions')
    .select('id, graph')
    .eq('id', flow.latest_version_id)
    .single()

  if (versionErr || !version) {
    return NextResponse.json({ error: 'Could not load flow version.' }, { status: 500 })
  }

  const graph = version.graph as SerializedGraph
  const triggerNode = graph.nodes.find((n) => n.type === 'trigger')
  if (!triggerNode) {
    return NextResponse.json({ error: 'Flow has no trigger node.' }, { status: 400 })
  }

  // 6. Create flow instance
  const { data: instance, error: instanceErr } = await db
    .from('flow_instances')
    .insert({
      flow_version_id: version.id,
      triggered_by: userId,
      current_step_id: null,
      status: 'pending',
    })
    .select('id')
    .single()

  if (instanceErr || !instance) {
    return NextResponse.json({ error: 'Could not create flow instance.' }, { status: 500 })
  }

  const instanceId = instance.id as string

  // 7. Log flow_triggered event
  await db.from('flow_event_logs').insert({
    instance_id: instanceId,
    step_instance_id: null,
    tenant_id: tenantId,
    actor_id: userId,
    event_type: 'flow_triggered',
    description: 'Flow triggered via REST API.',
    metadata: { flowId, versionId: version.id, source: 'api' },
  })

  // 8. Find first step node
  const firstEdge = graph.edges.find((e) => e.source === triggerNode.id)
  const firstNode = firstEdge ? graph.nodes.find((n) => n.id === firstEdge.target) : null

  // Trivial flow: immediate complete
  if (!firstNode || firstNode.type === 'complete') {
    await db
      .from('flow_instances')
      .update({ status: 'completed', updated_at: new Date().toISOString() })
      .eq('id', instanceId)
    await db.from('flow_event_logs').insert({
      instance_id: instanceId,
      step_instance_id: null,
      tenant_id: tenantId,
      actor_id: null,
      event_type: 'flow_completed',
      description: 'Flow completed instantly (no steps configured).',
      metadata: {},
    })
    void fireWebhookEvent(tenantId, 'flow_triggered', {
      instanceId,
      flowId,
      flowName,
      actorName: 'API',
    })
    void fireWebhookEvent(tenantId, 'flow_completed', { instanceId, flowName })

    return NextResponse.json(
      { instanceId, status: 'completed', detailUrl: `${siteUrl}/instances/${instanceId}` },
      { status: 201 }
    )
  }

  // 9. Create first step instance (pre-filled with provided formData)
  const { data: stepInstance, error: stepErr } = await db
    .from('step_instances')
    .insert({
      instance_id: instanceId,
      step_id: firstNode.id,
      assigned_to: userId,
      form_data: formData,
      status: 'pending',
      due_at: computeDueAt(firstNode.data?.slaHours as number | undefined),
      escalate_after_hours: (firstNode.data?.escalateAfterHours as number | undefined) ?? null,
    })
    .select('id')
    .single()

  if (stepErr || !stepInstance) {
    return NextResponse.json({ error: 'Could not create step instance.' }, { status: 500 })
  }

  // 10. Link step to instance
  await db
    .from('flow_instances')
    .update({ current_step_id: stepInstance.id, updated_at: new Date().toISOString() })
    .eq('id', instanceId)

  const stepLabel = (firstNode.data?.label as string | undefined) ?? 'Step'
  await db.from('flow_event_logs').insert({
    instance_id: instanceId,
    step_instance_id: stepInstance.id,
    tenant_id: tenantId,
    actor_id: null,
    event_type: 'step_assigned',
    description: `"${stepLabel}" assigned via API trigger.`,
    metadata: { stepId: firstNode.id, assignedTo: userId },
  })

  // 11. Fire outbound webhook
  void fireWebhookEvent(tenantId, 'flow_triggered', {
    instanceId,
    flowId,
    flowName,
    actorName: 'API',
  })

  return NextResponse.json(
    { instanceId, status: 'pending', detailUrl: `${siteUrl}/instances/${instanceId}` },
    { status: 201 }
  )
}
