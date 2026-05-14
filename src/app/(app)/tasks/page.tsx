// FILE PATH: src/app/(app)/tasks/page.tsx
//
// Server component — fetches all pending tasks assigned to the current user
// and passes them to the client component for rendering + modal interaction.

import { getMyTasks } from '@/lib/flows/actions'
import { TasksClient } from './tasks-client'

export const dynamic = 'force-dynamic'

export default async function TasksPage() {
  const { tasks, error } = await getMyTasks()

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">My Tasks</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Steps assigned to you that are waiting for your action.
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Failed to load tasks: {error}
        </div>
      ) : (
        <TasksClient tasks={tasks} />
      )}
    </div>
  )
}
