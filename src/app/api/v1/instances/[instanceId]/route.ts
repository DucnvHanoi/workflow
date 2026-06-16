import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyBearerKey } from '@/lib/api/auth'

export async function GET(request: NextRequest, { params }: { params: { instanceId: string } }) {
  const { context, error: authError } = await verifyBearerKey(request.headers.get('authorization'))
  if (!context) {
    return NextResponse.json({ error: authError }, { status: 401 })
  }

  const { instanceId } = params
  const { tenantId } = context
  const db = createAdminClient()

  // Load instance — join to flows for tenant isolation
  const { data: instance, error: instanceErr } = await db
    .from('flow_instances')
    .select(
      `id, status, created_at, updated_at, current_step_id,
       flow_versions!flow_version_id (
         flows!flow_id ( id, name, tenant_id )
       )`
    )
    .eq('id', instanceId)
    .maybeSingle()

  if (instanceErr || !instance) {
    return NextResponse.json({ error: 'Instance not found.' }, { status: 404 })
  }

  // Tenant isolation
  const raw = instance as unknown as {
    id: string
    status: string
    created_at: string
    updated_at: string
    current_step_id: string | null
    flow_versions: { flows: { id: string; name: string; tenant_id: string } } | null
  }
  const flow = raw.flow_versions?.flows ?? null

  if (!flow || flow.tenant_id !== tenantId) {
    return NextResponse.json({ error: 'Instance not found.' }, { status: 404 })
  }

  // Load current step separately to avoid complex join inference
  let currentStepOut: {
    stepInstanceId: string
    stepId: string
    status: string
    assignedTo: { name: string; email: string } | null
    dueAt: string | null
    completedAt: string | null
  } | null = null

  if (raw.current_step_id) {
    const { data: step } = await db
      .from('step_instances')
      .select('id, status, step_id, due_at, completed_at, users!assigned_to ( full_name, email )')
      .eq('id', raw.current_step_id)
      .maybeSingle()

    if (step) {
      const s = step as unknown as {
        id: string
        status: string
        step_id: string
        due_at: string | null
        completed_at: string | null
        users: { full_name: string | null; email: string } | null
      }
      currentStepOut = {
        stepInstanceId: s.id,
        stepId: s.step_id,
        status: s.status,
        assignedTo: s.users
          ? { name: s.users.full_name ?? s.users.email, email: s.users.email }
          : null,
        dueAt: s.due_at,
        completedAt: s.completed_at,
      }
    }
  }

  return NextResponse.json({
    instanceId: raw.id,
    status: raw.status,
    flowId: flow.id,
    flowName: flow.name,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    currentStep: currentStepOut,
  })
}
