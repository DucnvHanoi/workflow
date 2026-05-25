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
  type RowSelectionState,
} from '@tanstack/react-table'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Trash2, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { UserActions } from './user-actions'
import { deleteUsers, getUsersDeleteImpact } from '@/app/(app)/users/actions'

// ─── Types ────────────────────────────────────────────────────────────────────

export type UserRow = {
  id: string
  email: string
  full_name: string | null
  role: string
  created_at: string
  is_active: boolean
  department_id: string | null
  departments: { id: string; name: string } | null
  manager: { id: string; full_name: string | null; email: string } | null
  headOf: string | null
  avatar_url: string | null
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
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [loadingImpact, setLoadingImpact] = useState(false)
  const [impact, setImpact] = useState<{
    pendingTasks: number
    directReports: number
    deptHeadRoles: number
    activeFlows: number
  } | null>(null)

  const selectedIds = Object.keys(rowSelection).filter((id) => rowSelection[id])

  async function handleOpenDelete() {
    setLoadingImpact(true)
    try {
      const data = await getUsersDeleteImpact(selectedIds)
      setImpact(data)
      setDeleteOpen(true)
    } catch {
      toast.error('Could not load impact data')
    } finally {
      setLoadingImpact(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      const { deleted } = await deleteUsers(selectedIds)
      toast.success(`Deleted ${deleted} user${deleted !== 1 ? 's' : ''}`)
      setRowSelection({})
      setImpact(null)
      setDeleteOpen(false)
    } catch {
      toast.error('Failed to delete selected users')
    } finally {
      setDeleting(false)
    }
  }

  const columns = useMemo<ColumnDef<UserRow>[]>(
    () => [
      {
        id: 'select',
        header: ({ table }) => (
          <input
            type="checkbox"
            className="h-4 w-4 cursor-pointer accent-primary"
            checked={table.getIsAllPageRowsSelected()}
            onChange={table.getToggleAllPageRowsSelectedHandler()}
            title="Select all"
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            className="h-4 w-4 cursor-pointer accent-primary disabled:cursor-not-allowed disabled:opacity-30"
            checked={row.getIsSelected()}
            disabled={!row.getCanSelect()}
            onChange={row.getToggleSelectedHandler()}
          />
        ),
        enableSorting: false,
      },
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
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold overflow-hidden ${user.is_active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}
              >
                {user.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.avatar_url} alt={name} className="w-full h-full object-cover" />
                ) : (
                  initials
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{name}</span>
                  {!user.is_active && (
                    <Badge variant="outline" className="text-xs text-muted-foreground">
                      Inactive
                    </Badge>
                  )}
                </div>
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
                is_active: r.is_active,
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
    getRowId: (row) => row.id,
    enableRowSelection: (row) => row.original.id !== currentUserId,
    state: { sorting, globalFilter, rowSelection },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        <Input
          placeholder="Search by name or email…"
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="max-w-sm"
        />

        {selectedIds.length > 0 && (
          <>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleOpenDelete}
              disabled={loadingImpact}
            >
              {loadingImpact ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-1.5" />
              )}
              Delete {selectedIds.length} selected
            </Button>

            <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Delete {selectedIds.length} user{selectedIds.length !== 1 ? 's' : ''}?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently removes the selected user
                    {selectedIds.length !== 1 ? 's' : ''} and their login access. This cannot be
                    undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>

                {/* Impact summary */}
                {impact && (
                  <>
                    {impact.pendingTasks > 0 ||
                    impact.activeFlows > 0 ||
                    impact.directReports > 0 ||
                    impact.deptHeadRoles > 0 ? (
                      <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2.5 space-y-1.5 text-sm">
                        <p className="font-medium text-amber-800 flex items-center gap-1.5">
                          <AlertTriangle className="h-4 w-4 shrink-0" />
                          The following will be affected:
                        </p>
                        {impact.pendingTasks > 0 && (
                          <p className="text-amber-700 pl-5">
                            • {impact.pendingTasks} pending task
                            {impact.pendingTasks !== 1 ? 's' : ''} will become unassigned and stall
                          </p>
                        )}
                        {impact.activeFlows > 0 && (
                          <p className="text-amber-700 pl-5">
                            • {impact.activeFlows} active flow
                            {impact.activeFlows !== 1 ? 's' : ''} they triggered are still in
                            progress
                          </p>
                        )}
                        {impact.directReports > 0 && (
                          <p className="text-amber-700 pl-5">
                            • {impact.directReports} direct report
                            {impact.directReports !== 1 ? 's' : ''} will have no manager
                          </p>
                        )}
                        {impact.deptHeadRoles > 0 && (
                          <p className="text-amber-700 pl-5">
                            • {impact.deptHeadRoles} department
                            {impact.deptHeadRoles !== 1 ? 's' : ''} will lose their head
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="rounded-md bg-green-50 border border-green-200 px-3 py-2.5 text-sm text-green-700 flex items-center gap-1.5">
                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                        No pending tasks, active flows, direct reports, or dept head roles — safe to
                        delete.
                      </div>
                    )}
                  </>
                )}

                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={handleDelete}
                    disabled={deleting}
                  >
                    {deleting && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </div>

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
                <TableRow
                  key={row.id}
                  className={!row.original.is_active ? 'opacity-60' : undefined}
                  data-state={row.getIsSelected() ? 'selected' : undefined}
                >
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
