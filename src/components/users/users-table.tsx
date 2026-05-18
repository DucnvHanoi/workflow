'use client'

import { useState, useMemo } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { UserActions } from './user-actions'

// ─── Types ────────────────────────────────────────────────────────────────────

export type UserRow = {
  id: string
  email: string
  full_name: string | null
  role: string
  created_at: string
  department_id: string | null
  departments: { id: string; name: string } | null
  manager: { id: string; full_name: string | null; email: string } | null
  headOf: string | null // department name this user heads; null if not a head
}

type UsersTableProps = {
  rows: UserRow[]
  currentUserId: string
  allUsers: { id: string; full_name: string | null; email: string }[]
  allDepartments: { id: string; name: string; parent_id: string | null }[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

// ─── Component ────────────────────────────────────────────────────────────────

export function UsersTable({ rows, currentUserId, allUsers, allDepartments }: UsersTableProps) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = useState('')

  const columns = useMemo<ColumnDef<UserRow>[]>(
    () => [
      {
        accessorKey: 'full_name',
        header: 'Name',
        cell: ({ row }) => {
          const user = row.original
          const name = user.full_name ?? '—'
          const initials = user.full_name
            ? user.full_name
                .split(' ')
                .map((n: string) => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2)
            : user.email[0].toUpperCase()
          return (
            <a href={`/users/${user.id}`} className="flex items-center gap-3 hover:underline">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {initials}
              </div>
              <div>
                <div className="font-medium">{name}</div>
                <div className="text-xs text-muted-foreground">{user.email}</div>
              </div>
            </a>
          )
        },
      },
      {
        accessorKey: 'role',
        header: 'Role',
        cell: ({ getValue }) => {
          const role = getValue() as string
          return <Badge variant={role === 'admin' ? 'default' : 'secondary'}>{role}</Badge>
        },
      },
      {
        accessorKey: 'departments',
        header: 'Department',
        enableSorting: false,
        cell: ({ row }) => {
          const deptName = row.original.departments?.name
          const headOf = row.original.headOf
          return (
            <div className="space-y-1">
              <span>{deptName ?? '—'}</span>
              {headOf && (
                <span className="flex w-fit items-center rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700">
                  Head of {headOf}
                </span>
              )}
            </div>
          )
        },
      },
      {
        accessorKey: 'manager',
        header: 'Manager',
        enableSorting: false,
        cell: ({ row }) => {
          const manager = row.original.manager
          if (!manager) return <span className="text-muted-foreground">—</span>
          return (
            <div>
              <div className="font-medium">{manager.full_name ?? '—'}</div>
              <div className="text-xs text-muted-foreground">{manager.email}</div>
            </div>
          )
        },
      },
      {
        accessorKey: 'created_at',
        header: 'Joined',
        cell: ({ getValue }) => formatDate(getValue() as string),
      },
      {
        id: 'actions',
        cell: ({ row }) => {
          const r = row.original
          return (
            <UserActions
              user={{
                id: r.id,
                full_name: r.full_name,
                email: r.email,
                role: r.role as 'admin' | 'user',
                manager_id: r.manager?.id ?? null,
                department_id: r.department_id,
              }}
              currentUserId={currentUserId}
              allUsers={allUsers}
              allDepartments={allDepartments}
            />
          )
        },
      },
    ],
    [currentUserId, allUsers, allDepartments]
  )

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  return (
    <div className="space-y-4">
      <Input
        placeholder="Search by name or email…"
        value={globalFilter}
        onChange={(e) => setGlobalFilter(e.target.value)}
        className="max-w-sm"
      />

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((header) => {
                  const canSort = header.column.getCanSort()
                  const sorted = header.column.getIsSorted()
                  return (
                    <TableHead
                      key={header.id}
                      onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                      className={canSort ? 'cursor-pointer select-none' : ''}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                      {canSort && (
                        <span className="ml-1 text-muted-foreground">
                          {sorted === 'asc' ? '↑' : sorted === 'desc' ? '↓' : '↕'}
                        </span>
                      )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  {globalFilter
                    ? 'No users match your search.'
                    : 'No users in this tenant yet. Invite someone to get started.'}
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
