// FILE PATH: src/app/api/admin/export/route.ts
// Admin CSV export endpoint. Two modes via ?type=:
//   - instances   → one row per flow instance, with dynamically flattened
//                    step-variable columns (union across the filtered set).
//   - attachments → one row per uploaded file, with a signed download URL.
//
// Respects the same filters as the /admin/instances client (flowId, status,
// userId, dateFrom, dateTo, search). Admin-only: middleware does NOT guard
// /api/admin (only /admin), so we authorise here explicitly per CLAUDE.md.

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionClaims } from '@/lib/supabase/auth-helpers'

// ─── Minimal local graph shapes (avoid importing the client canvas store) ─────

type ExportField = { id: string; type?: string; label?: string }
type ExportNode = {
  id: string
  type?: string
  data?: { label?: string; formSchema?: ExportField[] }
}
type ExportGraph = { nodes?: ExportNode[] }

// ─── CSV helpers ──────────────────────────────────────────────────────────────

function escapeCsv(value: string): string {
  // Neutralise spreadsheet formula injection: prefix cells that start with
  // a formula-trigger character so Excel/LibreOffice treat them as text.
  const sanitized = /^[=+\-@\t]/.test(value) ? `'${value}` : value
  if (/[",\r\n]/.test(sanitized)) {
    return `"${sanitized.replace(/"/g, '""')}"`
  }
  return sanitized
}

function toCsv(headers: string[], rows: string[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(escapeCsv).join(','))
  // BOM so Excel reads UTF-8 correctly; CRLF line endings for Excel friendliness.
  return '﻿' + lines.join('\r\n')
}

function formatCell(value: unknown, fieldType?: string): string {
  if (value === null || value === undefined) return ''
  if (Array.isArray(value)) {
    if (fieldType === 'file') return `${value.length} file(s)`
    return value.map((v) => formatCell(v)).join('; ')
  }
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function csvResponse(csv: string, filename: string): NextResponse {
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}

// ─── Shared types ───────────────────────────────────────────────────────────

type Filters = {
  flowId: string
  status: string
  userId: string
  dateFrom: string
  dateTo: string
  search: string
}

type LoadedInstance = {
  id: string
  status: string
  triggeredBy: string
  triggeredByName: string
  triggeredByEmail: string
  createdAt: string
  updatedAt: string
  flowId: string
  flowName: string
  graph: ExportGraph
}

// ─── Tenant-scoped data load + filtering ──────────────────────────────────────

async function loadFilteredInstances(
  db: ReturnType<typeof createAdminClient>,
  tenantId: string,
  filters: Filters
): Promise<{ instances: LoadedInstance[]; stepsByInstance: Map<string, StepRow[]> }> {
  // 1. Tenant flows
  const { data: flowRows } = await db.from('flows').select('id, name').eq('tenant_id', tenantId)

  const flowNameById = new Map<string, string>()
  for (const f of (flowRows ?? []) as { id: string; name: string }[]) {
    flowNameById.set(f.id, f.name)
  }
  const flowIds = Array.from(flowNameById.keys())
  if (flowIds.length === 0) return { instances: [], stepsByInstance: new Map() }

  // 2. Versions for those flows (graph needed for field labels)
  const { data: versionRows } = await db
    .from('flow_versions')
    .select('id, flow_id, graph')
    .in('flow_id', flowIds)

  const versionById = new Map<string, { flowId: string; graph: ExportGraph }>()
  for (const v of (versionRows ?? []) as { id: string; flow_id: string; graph: ExportGraph }[]) {
    versionById.set(v.id, { flowId: v.flow_id, graph: v.graph ?? { nodes: [] } })
  }
  const versionIds = Array.from(versionById.keys())
  if (versionIds.length === 0) return { instances: [], stepsByInstance: new Map() }

  // 3. Instances on those versions
  const { data: instanceRows } = await db
    .from('flow_instances')
    .select('id, status, triggered_by, created_at, updated_at, flow_version_id')
    .in('flow_version_id', versionIds)
    .order('created_at', { ascending: false })

  type RawInstance = {
    id: string
    status: string
    triggered_by: string
    created_at: string
    updated_at: string
    flow_version_id: string
  }
  const raw = (instanceRows ?? []) as RawInstance[]

  // 4. Resolve triggerer names
  const userIds = Array.from(new Set(raw.map((r) => r.triggered_by).filter(Boolean)))
  const userById = new Map<string, { name: string; email: string }>()
  if (userIds.length > 0) {
    const { data: users } = await db.from('users').select('id, full_name, email').in('id', userIds)
    for (const u of (users ?? []) as { id: string; full_name: string | null; email: string }[]) {
      userById.set(u.id, { name: u.full_name ?? u.email, email: u.email })
    }
  }

  // 5. Map to LoadedInstance + apply filters (mirrors instances-client.tsx)
  const q = filters.search.toLowerCase().trim()
  const instances: LoadedInstance[] = []
  for (const r of raw) {
    const version = versionById.get(r.flow_version_id)
    if (!version) continue
    const user = userById.get(r.triggered_by) ?? { name: 'Unknown', email: '' }
    const inst: LoadedInstance = {
      id: r.id,
      status: r.status,
      triggeredBy: r.triggered_by,
      triggeredByName: user.name,
      triggeredByEmail: user.email,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      flowId: version.flowId,
      flowName: flowNameById.get(version.flowId) ?? 'Unknown Flow',
      graph: version.graph,
    }

    if (filters.flowId && filters.flowId !== 'all' && inst.flowId !== filters.flowId) continue
    if (filters.status && filters.status !== 'all' && inst.status !== filters.status) continue
    if (filters.userId && filters.userId !== 'all' && inst.triggeredBy !== filters.userId) continue
    if (filters.dateFrom && inst.createdAt < filters.dateFrom) continue
    if (filters.dateTo && inst.createdAt > filters.dateTo + 'T23:59:59.999Z') continue
    if (q) {
      const haystack =
        `${inst.flowName} ${inst.triggeredByName} ${inst.triggeredByEmail}`.toLowerCase()
      if (!haystack.includes(q)) continue
    }
    instances.push(inst)
  }

  // 6. Step instances for the filtered set
  const stepsByInstance = new Map<string, StepRow[]>()
  const instanceIds = instances.map((i) => i.id)
  if (instanceIds.length > 0) {
    const { data: stepRows } = await db
      .from('step_instances')
      .select('id, instance_id, step_id, form_data, status, completed_at, created_at')
      .in('instance_id', instanceIds)

    for (const s of (stepRows ?? []) as StepRow[]) {
      const list = stepsByInstance.get(s.instance_id) ?? []
      list.push(s)
      stepsByInstance.set(s.instance_id, list)
    }
  }

  return { instances, stepsByInstance }
}

type StepRow = {
  id: string
  instance_id: string
  step_id: string
  form_data: Record<string, unknown>
  status: string
  completed_at: string | null
  created_at: string
}

// ─── Instances CSV ──────────────────────────────────────────────────────────

function buildInstancesCsv(
  instances: LoadedInstance[],
  stepsByInstance: Map<string, StepRow[]>
): string {
  const baseHeaders = [
    'Instance ID',
    'Flow',
    'Status',
    'Triggered By',
    'Triggered By Email',
    'Started At',
    'Last Updated',
    'Total Steps',
    'Completed Steps',
    'Pending Steps',
  ]

  // Build the union of dynamic step-variable columns, ordered by first appearance.
  const dynamicHeaderOrder: string[] = []
  const dynamicHeaderSeen = new Set<string>()
  // For value lookup we resolve each (instance, field) to a header key.
  const fieldTypeByHeader = new Map<string, string>()

  const headerFor = (stepLabel: string, field: ExportField): string => {
    const fieldLabel = field.label && field.label.trim() !== '' ? field.label : field.id
    return `${stepLabel} · ${fieldLabel}`
  }

  // First pass: discover columns in a stable order.
  for (const inst of instances) {
    const nodeById = new Map<string, ExportNode>()
    for (const n of inst.graph.nodes ?? []) nodeById.set(n.id, n)
    const steps = stepsByInstance.get(inst.id) ?? []
    for (const step of steps) {
      const node = nodeById.get(step.step_id)
      const fields = node?.data?.formSchema ?? []
      const stepLabel = node?.data?.label?.trim() || node?.type || step.step_id
      for (const field of fields) {
        const header = headerFor(stepLabel, field)
        if (!dynamicHeaderSeen.has(header)) {
          dynamicHeaderSeen.add(header)
          dynamicHeaderOrder.push(header)
          if (field.type) fieldTypeByHeader.set(header, field.type)
        }
      }
    }
  }

  const headers = [...baseHeaders, ...dynamicHeaderOrder]

  const rows: string[][] = instances.map((inst) => {
    const nodeById = new Map<string, ExportNode>()
    for (const n of inst.graph.nodes ?? []) nodeById.set(n.id, n)
    const steps = stepsByInstance.get(inst.id) ?? []

    const total = steps.length
    const completed = steps.filter((s) => s.status === 'completed').length
    const pending = steps.filter((s) => s.status === 'pending').length

    // Per-header value for this instance
    const valueByHeader = new Map<string, string>()
    for (const step of steps) {
      const node = nodeById.get(step.step_id)
      const fields = node?.data?.formSchema ?? []
      const stepLabel = node?.data?.label?.trim() || node?.type || step.step_id
      for (const field of fields) {
        const header = headerFor(stepLabel, field)
        valueByHeader.set(header, formatCell(step.form_data?.[field.id], field.type))
      }
    }

    return [
      inst.id,
      inst.flowName,
      inst.status,
      inst.triggeredByName,
      inst.triggeredByEmail,
      inst.createdAt,
      inst.updatedAt,
      String(total),
      String(completed),
      String(pending),
      ...dynamicHeaderOrder.map((h) => valueByHeader.get(h) ?? ''),
    ]
  })

  return toCsv(headers, rows)
}

// ─── Attachments CSV ──────────────────────────────────────────────────────────

async function buildAttachmentsCsv(
  db: ReturnType<typeof createAdminClient>,
  instances: LoadedInstance[],
  stepsByInstance: Map<string, StepRow[]>
): Promise<string> {
  const headers = [
    'Flow',
    'Instance ID',
    'Step',
    'Field',
    'Filename',
    'Size (bytes)',
    'Uploaded At',
    'Storage Path',
    'Download URL',
  ]

  // Index step instances → owning flow instance, plus resolve step/field labels.
  const stepInstanceMeta = new Map<
    string,
    { instanceId: string; flowName: string; node?: ExportNode }
  >()
  for (const inst of instances) {
    const nodeById = new Map<string, ExportNode>()
    for (const n of inst.graph.nodes ?? []) nodeById.set(n.id, n)
    for (const step of stepsByInstance.get(inst.id) ?? []) {
      stepInstanceMeta.set(step.id, {
        instanceId: inst.id,
        flowName: inst.flowName,
        node: nodeById.get(step.step_id),
      })
    }
  }

  const stepInstanceIds = Array.from(stepInstanceMeta.keys())
  if (stepInstanceIds.length === 0) return toCsv(headers, [])

  const { data: attachmentRows } = await db
    .from('step_attachments')
    .select('step_instance_id, field_key, storage_path, filename, size_bytes, created_at')
    .in('step_instance_id', stepInstanceIds)
    .order('created_at', { ascending: true })

  type AttachmentRow = {
    step_instance_id: string
    field_key: string
    storage_path: string
    filename: string
    size_bytes: number
    created_at: string
  }
  const attachments = (attachmentRows ?? []) as AttachmentRow[]
  if (attachments.length === 0) return toCsv(headers, [])

  // Signed URLs (7-day) — batched in one call.
  const SEVEN_DAYS = 60 * 60 * 24 * 7
  const urlByPath = new Map<string, string>()
  const { data: signed } = await db.storage.from('step-attachments').createSignedUrls(
    attachments.map((a) => a.storage_path),
    SEVEN_DAYS
  )
  for (const s of signed ?? []) {
    if (s.path && s.signedUrl) urlByPath.set(s.path, s.signedUrl)
  }

  const rows: string[][] = attachments.map((a) => {
    const meta = stepInstanceMeta.get(a.step_instance_id)
    const stepLabel = meta?.node?.data?.label?.trim() || meta?.node?.type || ''
    const field = meta?.node?.data?.formSchema?.find((f) => f.id === a.field_key)
    const fieldLabel = field?.label?.trim() || a.field_key
    return [
      meta?.flowName ?? '',
      meta?.instanceId ?? '',
      stepLabel,
      fieldLabel,
      a.filename,
      String(a.size_bytes),
      a.created_at,
      a.storage_path,
      urlByPath.get(a.storage_path) ?? '',
    ]
  })

  return toCsv(headers, rows)
}

// ─── Route ──────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { user, claims } = await getSessionClaims()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  if (claims.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!claims.tenant_id) return NextResponse.json({ error: 'Tenant not found' }, { status: 400 })

  const sp = req.nextUrl.searchParams
  const type = sp.get('type') === 'attachments' ? 'attachments' : 'instances'
  const filters: Filters = {
    flowId: sp.get('flowId') ?? '',
    status: sp.get('status') ?? '',
    userId: sp.get('userId') ?? '',
    dateFrom: sp.get('dateFrom') ?? '',
    dateTo: sp.get('dateTo') ?? '',
    search: sp.get('search') ?? '',
  }

  const db = createAdminClient()
  const { instances, stepsByInstance } = await loadFilteredInstances(db, claims.tenant_id, filters)

  const stamp = new Date().toISOString().slice(0, 10)

  if (type === 'attachments') {
    const csv = await buildAttachmentsCsv(db, instances, stepsByInstance)
    return csvResponse(csv, `attachments-export-${stamp}.csv`)
  }

  const csv = buildInstancesCsv(instances, stepsByInstance)
  return csvResponse(csv, `instances-export-${stamp}.csv`)
}
