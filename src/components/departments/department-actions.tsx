'use client'

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

interface Props {
  department: {
    id: string
    name: string
    parent_id: string | null
    userCount: number
  }
  allDepartments: { id: string; name: string; parent_id: string | null }[]
}

export function DepartmentActions({ department, allDepartments }: Props) {
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

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
          <DropdownMenuItem onClick={() => setEditOpen(true)}>Edit</DropdownMenuItem>
          <DropdownMenuSeparator />
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
      <DeleteDepartmentDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        department={department}
      />
    </>
  )
}
