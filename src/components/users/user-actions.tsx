'use client'

import { useState } from 'react'
import { MoreHorizontal } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { EditRoleDialog } from './edit-role-dialog'
import { DeleteUserDialog } from './delete-user-dialog'
import { EditManagerDialog } from './edit-manager-dialog'
import { EditProfileDialog } from './edit-profile-dialog'
import { EditDepartmentDialog } from './edit-department-dialog'
import { DeactivateUserDialog } from './deactivate-user-dialog'

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
    is_active: boolean
    manager_id: string | null
    department_id: string | null
  }
  currentUserId: string
  allUsers: UserOption[]
  allDepartments: { id: string; name: string; parent_id: string | null }[]
}

export function UserActions({ user, currentUserId, allUsers, allDepartments }: Props) {
  const [profileOpen, setProfileOpen] = useState(false)
  const [deptOpen, setDeptOpen] = useState(false)
  const [roleOpen, setRoleOpen] = useState(false)
  const [managerOpen, setManagerOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deactivateOpen, setDeactivateOpen] = useState(false)
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
          <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
            Profile
          </DropdownMenuLabel>
          <DropdownMenuItem onSelect={() => setProfileOpen(true)}>
            Edit Name & Email
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setDeptOpen(true)}>Edit Department</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
            Access
          </DropdownMenuLabel>
          <DropdownMenuItem onSelect={() => setRoleOpen(true)}>Edit Role</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setManagerOpen(true)}>Edit Manager</DropdownMenuItem>
          <DropdownMenuSeparator />
          {user.is_active ? (
            <DropdownMenuItem
              onSelect={() => setDeactivateOpen(true)}
              disabled={isSelf}
              className="text-destructive focus:text-destructive"
            >
              Deactivate User
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => setDeactivateOpen(true)}>
              Reactivate User
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onSelect={() => setDeleteOpen(true)}
            disabled={isSelf}
            className="text-destructive focus:text-destructive"
          >
            Delete User
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <EditProfileDialog open={profileOpen} onOpenChange={setProfileOpen} user={user} />

      <EditDepartmentDialog
        open={deptOpen}
        onOpenChange={setDeptOpen}
        user={{ ...user }}
        allDepartments={allDepartments}
      />

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

      <DeactivateUserDialog open={deactivateOpen} onOpenChange={setDeactivateOpen} user={user} />
    </>
  )
}
