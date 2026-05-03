'use client'

import { useState } from 'react'
import { MoreHorizontal } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { EditRoleDialog } from './edit-role-dialog'
import { DeleteUserDialog } from './delete-user-dialog'
import { EditManagerDialog } from './edit-manager-dialog'

type UserOption = {
  id: string
  full_name: string | null
  email: string
}

type Props = {
  user: {
    id: string
    full_name: string | null
    email: string
    role: 'admin' | 'user'
    manager_id: string | null
  }
  currentUserId: string
  allUsers: UserOption[]
}

export function UserActions({ user, currentUserId, allUsers }: Props) {
  const [roleOpen, setRoleOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [managerOpen, setManagerOpen] = useState(false)
  const isSelf = user.id === currentUserId

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
          <DropdownMenuItem onSelect={() => setRoleOpen(true)}>Edit Role</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setManagerOpen(true)}>Edit Manager</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => setDeleteOpen(true)}
            disabled={isSelf}
            className="text-destructive focus:text-destructive"
          >
            Delete User
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <EditRoleDialog
        open={roleOpen}
        onOpenChange={setRoleOpen}
        user={user}
        currentUserId={currentUserId}
      />

      <EditManagerDialog
        open={managerOpen}
        onOpenChange={setManagerOpen}
        user={user}
        allUsers={allUsers}
      />

      <DeleteUserDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        user={user}
        currentUserId={currentUserId}
      />
    </>
  )
}
