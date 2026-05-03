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

// ─── types ───────────────────────────────────────────────────────────────────

export type UserRow = {
  id: string
  email: string
  full_name: string | null
  role: string
  created_at: string
  departments: { id: string; name: string } | null // single object, not array
  manager: { id: string; full_name: string | null; email: string } | null
}

type UsersTableProps = {
  rows: UserRow[]
  currentUserId: string
  allUsers: { id: string; full_name: string | null; email: string }[]
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function initials(name: string | null, email: string) {
  if (name) {
    return name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }
  return email.slice(0, 2).toUpperCase()
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

// ─── component ────────────────────────────────────────────────────────────────

export function UsersTable({ rows, currentUserId, allUsers }: UsersTableProps) {
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
        accessorKey: 'email',
        header: 'Email',
        cell: ({ getValue }) => (
          <span className="text-muted-foreground">{getValue() as string}</span>
        ),
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
        cell: ({ row }) => row.original.departments?.name ?? '—',
      },
      {
        accessorKey: 'manager',
        header: 'Manager',
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
                manager_id: r.manager?.id ?? null, // now clean — no cast needed
              }}
              currentUserId={currentUserId}
              allUsers={allUsers}
            />
          )
        },
      },
    ],
    [currentUserId]
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
      {/* Search */}
      <Input
        placeholder="Search by name or email…"
        value={globalFilter}
        onChange={(e) => setGlobalFilter(e.target.value)}
        className="max-w-sm"
      />

      {/* Table */}
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
