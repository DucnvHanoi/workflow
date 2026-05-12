// FILE PATH: src/components/canvas/panels/AssigneePanel.tsx

'use client'

import { useState, useEffect } from 'react'
import type { Node } from '@xyflow/react'
import {
  useCanvasStore,
  type AssigneeRule,
  type AssigneeRuleType,
  type NodeData,
  type TenantUser,
  type TenantDepartment,
} from '@/store/canvas-store'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AssigneePanelProps {
  node: Node
  users: TenantUser[]
  departments: TenantDepartment[]
}

// ─── Rule type options ────────────────────────────────────────────────────────
// ADD: 'requester' at the top — most common self-service use case

const RULE_OPTIONS: { type: AssigneeRuleType; label: string; description: string }[] = [
  {
    type: 'requester',
    label: 'Requester',
    description: 'Assigned back to whoever triggered the flow',
  },
  {
    type: 'fixed',
    label: 'Fixed person',
    description: 'Always assigned to a specific user',
  },
  {
    type: 'manager_of_requestor',
    label: "Requestor's manager",
    description: 'Direct manager of whoever triggers the flow',
  },
  {
    type: 'skip_level',
    label: 'Skip-level manager',
    description: "Manager's manager of the requestor",
  },
  {
    type: 'department_head',
    label: 'Department head',
    description: 'First user in a chosen department',
  },
  {
    type: 'role_in_dept',
    label: 'Role in department',
    description: 'First user with a specific role in a department',
  },
]

// ─── Component ────────────────────────────────────────────────────────────────

export default function AssigneePanel({ node, users, departments }: AssigneePanelProps) {
  const { setAssigneeRule } = useCanvasStore()
  const triggerSave = useCanvasStore((s) => s.triggerSave)

  const data = node.data as NodeData
  const currentRule = data.assigneeRule

  const [selectedType, setSelectedType] = useState<AssigneeRuleType | null>(
    currentRule?.type ?? null
  )
  const [fixedEmail, setFixedEmail] = useState(
    currentRule?.type === 'fixed' ? currentRule.email : ''
  )
  const [fixedSearch, setFixedSearch] = useState('')
  const [deptId, setDeptId] = useState(
    currentRule?.type === 'department_head'
      ? currentRule.departmentId
      : currentRule?.type === 'role_in_dept'
        ? currentRule.departmentId
        : ''
  )
  const [roleValue, setRoleValue] = useState(
    currentRule?.type === 'role_in_dept' ? currentRule.role : ''
  )

  // Sync local state when a different node is selected
  useEffect(() => {
    const rule = (node.data as NodeData).assigneeRule
    setSelectedType(rule?.type ?? null)
    setFixedEmail(rule?.type === 'fixed' ? rule.email : '')
    setFixedSearch('')
    setDeptId(
      rule?.type === 'department_head'
        ? rule.departmentId
        : rule?.type === 'role_in_dept'
          ? rule.departmentId
          : ''
    )
    setRoleValue(rule?.type === 'role_in_dept' ? rule.role : '')
  }, [node.id])

  // ── Persist helper ───────────────────────────────────────────────────────

  function persist(
    type: AssigneeRuleType | null,
    email: string,
    departmentId: string,
    role: string
  ) {
    let rule: AssigneeRule = null

    switch (type) {
      case 'requester': // ADD
        rule = { type: 'requester' } // ADD
        break // ADD
      case 'fixed':
        rule = email ? { type: 'fixed', email } : null
        break
      case 'manager_of_requestor':
        rule = { type: 'manager_of_requestor' }
        break
      case 'skip_level':
        rule = { type: 'skip_level' }
        break
      case 'department_head':
        rule = departmentId ? { type: 'department_head', departmentId } : null
        break
      case 'role_in_dept':
        rule = departmentId && role ? { type: 'role_in_dept', departmentId, role } : null
        break
      default:
        rule = null
    }

    setAssigneeRule(node.id, rule)
    triggerSave()
  }

  // ── Rule type change ─────────────────────────────────────────────────────

  function handleTypeChange(type: AssigneeRuleType) {
    setSelectedType(type)
    setFixedEmail('')
    setFixedSearch('')
    setDeptId('')
    setRoleValue('')
    persist(type, '', '', '')
  }

  // ── Fixed person: filtered user list ─────────────────────────────────────

  const filteredUsers = fixedSearch.trim()
    ? users.filter(
        (u) =>
          u.email.toLowerCase().includes(fixedSearch.toLowerCase()) ||
          (u.full_name ?? '').toLowerCase().includes(fixedSearch.toLowerCase())
      )
    : users

  // ── Department label helper ───────────────────────────────────────────────

  function deptLabel(id: string): string {
    const dept = departments.find((d) => d.id === id)
    if (!dept) return '—'
    if (dept.parent_id) {
      const parent = departments.find((d) => d.id === dept.parent_id)
      return parent ? `${parent.name} › ${dept.name}` : dept.name
    }
    return dept.name
  }

  // ── Current rule summary ──────────────────────────────────────────────────

  function ruleSummary(): string | null {
    if (!currentRule) return null
    switch (currentRule.type) {
      case 'requester':
        return 'Requester (self)' // ADD
      case 'fixed':
        return `Fixed: ${currentRule.email}`
      case 'manager_of_requestor':
        return "Requestor's manager"
      case 'skip_level':
        return 'Skip-level manager'
      case 'department_head':
        return `Dept head: ${deptLabel(currentRule.departmentId)}`
      case 'role_in_dept':
        return `Role "${currentRule.role}" in ${deptLabel(currentRule.departmentId)}`
    }
  }

  const summary = ruleSummary()

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-2">
      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Assigned to
        </p>
        {currentRule && (
          <button
            onClick={() => {
              setSelectedType(null)
              setFixedEmail('')
              setFixedSearch('')
              setDeptId('')
              setRoleValue('')
              setAssigneeRule(node.id, null)
              triggerSave()
            }}
            className="text-[10px] text-muted-foreground underline-offset-2 hover:text-destructive hover:underline"
          >
            Clear
          </button>
        )}
      </div>

      {/* ── Saved rule summary pill ───────────────────────────────────── */}
      {summary && (
        <div className="rounded-md bg-primary/8 border border-primary/20 px-2.5 py-1.5">
          <p className="text-xs font-medium text-primary">{summary}</p>
        </div>
      )}

      {/* ── Rule type radio group ─────────────────────────────────────── */}
      <div className="flex flex-col gap-1">
        {RULE_OPTIONS.map(({ type, label, description }) => {
          const isSelected = selectedType === type
          return (
            <button
              key={type}
              onClick={() => handleTypeChange(type)}
              className={`flex flex-col rounded-md border px-2.5 py-2 text-left transition-colors ${
                isSelected
                  ? 'border-primary bg-primary/5'
                  : 'border-border bg-background hover:bg-muted/50'
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`mt-0.5 flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-full border ${
                    isSelected ? 'border-primary' : 'border-muted-foreground'
                  }`}
                >
                  {isSelected && <span className="h-2 w-2 rounded-full bg-primary" />}
                </span>
                <span className="text-sm font-medium text-foreground">{label}</span>
              </div>
              <p className="ml-5 text-xs text-muted-foreground">{description}</p>
            </button>
          )
        })}
      </div>

      {/* ── Sub-fields per rule type ──────────────────────────────────── */}

      {/* Fixed person — searchable user list */}
      {selectedType === 'fixed' && (
        <div className="flex flex-col gap-1.5 rounded-md border border-border bg-muted/20 p-2">
          <p className="text-xs font-medium text-foreground">Select user</p>
          <input
            type="text"
            value={fixedSearch}
            onChange={(e) => setFixedSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
          <div className="max-h-36 overflow-y-auto rounded border border-border bg-background">
            {filteredUsers.length === 0 && (
              <p className="px-2 py-2 text-xs text-muted-foreground">No users found</p>
            )}
            {filteredUsers.map((u) => {
              const isChosen = fixedEmail === u.email
              return (
                <button
                  key={u.id}
                  onClick={() => {
                    setFixedEmail(u.email)
                    setFixedSearch('')
                    persist('fixed', u.email, '', '')
                  }}
                  className={`flex w-full flex-col px-2 py-1.5 text-left transition-colors hover:bg-muted ${
                    isChosen ? 'bg-primary/8 font-medium' : ''
                  }`}
                >
                  <span className="text-xs text-foreground">{u.full_name ?? u.email}</span>
                  {u.full_name && (
                    <span className="text-[10px] text-muted-foreground">{u.email}</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Department head — department dropdown */}
      {selectedType === 'department_head' && (
        <div className="flex flex-col gap-1.5 rounded-md border border-border bg-muted/20 p-2">
          <p className="text-xs font-medium text-foreground">Department</p>
          <select
            value={deptId}
            onChange={(e) => {
              setDeptId(e.target.value)
              persist('department_head', '', e.target.value, '')
            }}
            className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
          >
            <option value="">— Select department —</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.parent_id ? `  ↳ ${d.name}` : d.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Role in department — department dropdown + role input */}
      {selectedType === 'role_in_dept' && (
        <div className="flex flex-col gap-1.5 rounded-md border border-border bg-muted/20 p-2">
          <p className="text-xs font-medium text-foreground">Department</p>
          <select
            value={deptId}
            onChange={(e) => {
              setDeptId(e.target.value)
              persist('role_in_dept', '', e.target.value, roleValue)
            }}
            className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
          >
            <option value="">— Select department —</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.parent_id ? `  ↳ ${d.name}` : d.name}
              </option>
            ))}
          </select>

          <p className="text-xs font-medium text-foreground">Role</p>
          <input
            type="text"
            value={roleValue}
            onChange={(e) => {
              setRoleValue(e.target.value)
              persist('role_in_dept', '', deptId, e.target.value)
            }}
            placeholder="e.g. admin, manager, reviewer"
            className="w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
        </div>
      )}

      {/* ADD: requester, manager_of_requestor, skip_level — no sub-fields needed */}
      {(selectedType === 'requester' ||
        selectedType === 'manager_of_requestor' ||
        selectedType === 'skip_level') && (
        <p className="text-xs text-muted-foreground italic">
          No extra configuration needed for this rule.
        </p>
      )}
    </div>
  )
}
