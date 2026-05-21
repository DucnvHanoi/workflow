'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { DeactivateUserDialog } from './deactivate-user-dialog'
import { BulkReassignDialog } from './bulk-reassign-dialog'

type Props = {
  user: { id: string; full_name: string | null; email: string; is_active: boolean }
  pendingCount: number
  activeUsers: { id: string; full_name: string | null; email: string }[]
  isSelf: boolean
}

export function UserProfileActions({ user, pendingCount, activeUsers, isSelf }: Props) {
  const [deactivateOpen, setDeactivateOpen] = useState(false)
  const [reassignOpen, setReassignOpen] = useState(false)

  return (
    <div className="flex items-center gap-2">
      {pendingCount > 0 && (
        <Button variant="outline" size="sm" onClick={() => setReassignOpen(true)}>
          Reassign {pendingCount} pending task{pendingCount !== 1 ? 's' : ''}
        </Button>
      )}

      {!isSelf && (
        <Button
          variant={user.is_active ? 'destructive' : 'outline'}
          size="sm"
          onClick={() => setDeactivateOpen(true)}
        >
          {user.is_active ? 'Deactivate' : 'Reactivate'}
        </Button>
      )}

      <DeactivateUserDialog user={user} open={deactivateOpen} onOpenChange={setDeactivateOpen} />

      <BulkReassignDialog
        fromUser={user}
        pendingCount={pendingCount}
        activeUsers={activeUsers}
        open={reassignOpen}
        onOpenChange={setReassignOpen}
      />
    </div>
  )
}
