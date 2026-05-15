// FILE PATH: src/app/(app)/tasks/page.tsx
//
// Server component — fetches pending tasks AND completed task history for the
// current user, then passes both to TasksClient.

import { getMyTasks, getMyCompletedTasks } from '@/lib/flows/actions'
import { TasksClient } from './tasks-client'

export const dynamic = 'force-dynamic'

export default async function TasksPage() {
  // Fetch both in parallel — neither depends on the other
  const [
    { tasks: pendingTasks, error: pendingError },
    { tasks: completedTasks, error: completedError },
  ] = await Promise.all([getMyTasks(), getMyCompletedTasks()])

  const error = pendingError ?? completedError

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">My Tasks</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Steps assigned to you — pending actions and completed history.
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Failed to load tasks: {error}
        </div>
      ) : (
        <TasksClient pendingTasks={pendingTasks} completedTasks={completedTasks} />
      )}
    </div>
  )
}
