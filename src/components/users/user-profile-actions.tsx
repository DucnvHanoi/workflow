'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { DeactivateUserDialog } from './deactivate-user-dialog'
import { BulkReassignDialog } from './bulk-reassign-dialog'
import { OffboardingWizard } from './offboarding-wizard'

type ActiveUser = { id: string; full_name: string | null; email: string }

type Props = {
  user: { id: string; full_name: string | null; email: string; is_active: boolean }
  pendingCount: number
  activeUsers: ActiveUser[]
  directReports: ActiveUser[]
  deptHeadOf: { id: string; name: string }[]
  isSelf: boolean
}

export function UserProfileActions({
  user,
  pendingCount,
  activeUsers,
  directReports,
  deptHeadOf,
  isSelf,
}: Props) {
  const [deactivateOpen, setDeactivateOpen] = useState(false)
  const [reassignOpen, setReassignOpen] = useState(false)
  const [offboardOpen, setOffboardOpen] = useState(false)

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Quick task reassign — useful even outside offboarding */}
      {pendingCount > 0 && (
        <Button variant="outline" size="sm" onClick={() => setReassignOpen(true)}>
          Reassign {pendingCount} pending task{pendingCount !== 1 ? 's' : ''}
        </Button>
      )}

      {!isSelf && user.is_active && (
        <Button variant="destructive" size="sm" onClick={() => setOffboardOpen(true)}>
          Offboard
        </Button>
      )}

      {!isSelf && !user.is_active && (
        <Button variant="outline" size="sm" onClick={() => setDeactivateOpen(true)}>
          Reactivate
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

      <OffboardingWizard
        user={user}
        pendingCount={pendingCount}
        activeUsers={activeUsers}
        directReports={directReports}
        deptHeadOf={deptHeadOf}
        open={offboardOpen}
        onOpenChange={setOffboardOpen}
      />
    </div>
  )
}
