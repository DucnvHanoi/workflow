import type { SupabaseClient } from '@supabase/supabase-js'

export interface ExportCsvs {
  users: string
  flowInstances: string
  departments: string
}

function escapeCsv(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v)
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers, ...rows].map((r) => r.map(escapeCsv).join(','))
  return '﻿' + lines.join('\r\n')
}

export async function buildExportCsvs(db: SupabaseClient, tenantId: string): Promise<ExportCsvs> {
  const [usersRes, instancesRes, deptsRes] = await Promise.all([
    db
      .from('users')
      .select('id, full_name, email, role, department_id, is_active, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at'),
    db
      .from('flow_instances')
      .select('id, status, triggered_by, created_at, updated_at')
      .eq('tenant_id', tenantId)
      .order('created_at'),
    db
      .from('departments')
      .select('id, name, parent_id, head_user_id, created_at')
      .eq('tenant_id', tenantId)
      .order('name'),
  ])

  const deptNameMap = new Map((deptsRes.data ?? []).map((d) => [d.id as string, d.name as string]))

  const usersCsv = toCsv(
    ['id', 'full_name', 'email', 'role', 'department', 'is_active', 'created_at'],
    (usersRes.data ?? []).map((u) => [
      u.id,
      u.full_name,
      u.email,
      u.role,
      u.department_id ? (deptNameMap.get(u.department_id) ?? '') : '',
      u.is_active,
      u.created_at,
    ])
  )

  const instancesCsv = toCsv(
    ['id', 'status', 'triggered_by', 'created_at', 'updated_at'],
    (instancesRes.data ?? []).map((i) => [
      i.id,
      i.status,
      i.triggered_by,
      i.created_at,
      i.updated_at,
    ])
  )

  const deptsCsv = toCsv(
    ['id', 'name', 'parent_id', 'head_user_id', 'created_at'],
    (deptsRes.data ?? []).map((d) => [
      d.id,
      d.name,
      d.parent_id ?? '',
      d.head_user_id ?? '',
      d.created_at,
    ])
  )

  return { users: usersCsv, flowInstances: instancesCsv, departments: deptsCsv }
}
