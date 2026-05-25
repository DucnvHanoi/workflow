'use client'

// FILE PATH: src/components/departments/department-actions.tsx

import { useState } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { EditDepartmentDialog } from './rename-department-dialog'
import { DeleteDepartmentDialog } from './delete-department-dialog'
import { SetDepartmentHeadDialog } from './set-department-head-dialog'
import { DepartmentMembersPanel } from './department-members-panel'
import { MergeDepartmentDialog } from './merge-department-dialog'

interface DeptUser {
  id: string
  full_name: string | null
  email: string
  department_id: string | null
}

interface Props {
  department: {
    id: string
    name: string
    parent_id: string | null
    userCount: number
    head_user_id: string | null
    head_name: string | null
  }
  allDepartments: { id: string; name: string; parent_id: string | null }[]
  allUsers: DeptUser[]
}

export function DepartmentActions({ department, allDepartments, allUsers }: Props) {
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [setHeadOpen, setSetHeadOpen] = useState(false)
  const [membersOpen, setMembersOpen] = useState(false)
  const [mergeOpen, setMergeOpen] = useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">Open menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setMembersOpen(true)}>Members</DropdownMenuItem>
          <DropdownMenuItem onClick={() => setEditOpen(true)}>Edit</DropdownMenuItem>
          <DropdownMenuItem onClick={() => setSetHeadOpen(true)}>Set Head</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setMergeOpen(true)}>Merge into…</DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setDeleteOpen(true)}
            className="text-destructive focus:text-destructive"
          >
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <EditDepartmentDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        department={department}
        allDepartments={allDepartments}
      />
      <SetDepartmentHeadDialog
        open={setHeadOpen}
        onOpenChange={setSetHeadOpen}
        department={department}
        allUsers={allUsers}
      />
      <DeleteDepartmentDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        department={department}
        userCount={department.userCount}
      />
      <DepartmentMembersPanel
        department={department}
        allUsers={allUsers}
        open={membersOpen}
        onOpenChange={setMembersOpen}
      />
      <MergeDepartmentDialog
        department={department}
        allDepartments={allDepartments}
        open={mergeOpen}
        onOpenChange={setMergeOpen}
      />
    </>
  )
}
