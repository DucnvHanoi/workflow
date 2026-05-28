// FILE PATH: src/app/(app)/tasks/page.tsx
//
// Server component — fetches:
//   1. Pending tasks assigned to the current user
//   2. Completed task history for the current user
//   3. All flow instances triggered by the current user (My Flows tab)
// All three fetches run in parallel.
//
// Also reads session claims so TasksClient can pass currentUserId, tenantId,
// and isAdmin down to the InstanceDetailClient rendered inside the panel.

import { getMyTasks, getMyCompletedTasks, getMyInstances } from '@/lib/flows/actions'
import { getSessionClaims } from '@/lib/supabase/auth-helpers'
import { getAdminChecklistState } from '@/lib/onboarding/actions'
import { redirect } from 'next/navigation'
import { TasksClient } from './tasks-client'

export const dynamic = 'force-dynamic'

export default async function TasksPage() {
  const { user, claims } = await getSessionClaims()
  if (!user) redirect('/login')

  const isAdmin = claims.role === 'admin'

  const [
    { tasks: pendingTasks, error: pendingError },
    { tasks: completedTasks, error: completedError },
    { instances: myFlowInstances, error: instancesError },
    adminChecklist,
  ] = await Promise.all([
    getMyTasks(),
    getMyCompletedTasks(),
    getMyInstances(),
    isAdmin ? getAdminChecklistState() : Promise.resolve(null),
  ])

  const error = pendingError ?? completedError ?? instancesError

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">My Tasks</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your pending actions, flows you started, and completed history.
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Failed to load tasks: {error}
        </div>
      ) : (
        <TasksClient
          pendingTasks={pendingTasks}
          completedTasks={completedTasks}
          myFlowInstances={myFlowInstances}
          currentUserId={user.id}
          tenantId={claims.tenant_id!}
          isAdmin={isAdmin}
          adminChecklist={adminChecklist}
        />
      )}
    </div>
  )
}
