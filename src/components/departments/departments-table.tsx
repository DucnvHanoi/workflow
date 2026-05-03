'use client'

import { useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { DepartmentActions } from './department-actions'
import type { DepartmentTreeNode } from '@/lib/departments/tree'

interface Props {
  rows: DepartmentTreeNode[] // already flattened in display order
  allDepartments: { id: string; name: string; parent_id: string | null }[]
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

// Indent multiplier per depth level
const INDENT = ['', 'pl-0', 'pl-6', 'pl-12'] as const

export function DepartmentsTable({ rows, allDepartments }: Props) {
  const [search, setSearch] = useState('')

  const filtered = search.trim()
    ? rows.filter((r) => r.name.toLowerCase().includes(search.toLowerCase()))
    : rows

  return (
    <div className="space-y-4">
      <Input
        placeholder="Search departments…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Department Name</TableHead>
              <TableHead>Members</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                  {search
                    ? 'No departments match your search.'
                    : 'No departments yet. Create one to get started.'}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <div className={`flex items-center gap-2 ${INDENT[row.depth] ?? 'pl-12'}`}>
                      {/* Tree connector for non-root items */}
                      {row.depth > 1 && (
                        <span className="text-muted-foreground text-xs select-none">↳</span>
                      )}
                      <span className={row.depth === 1 ? 'font-medium' : ''}>{row.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.userCount} {row.userCount === 1 ? 'user' : 'users'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(row.created_at)}
                  </TableCell>
                  <TableCell>
                    <DepartmentActions department={row} allDepartments={allDepartments} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
