// FILE PATH: src/app/(app)/my-flows/[id]/types.ts
// Shared types for the instance detail route.
// Kept in a separate file so both page.tsx (server) and
// instance-detail-client.tsx (client) can import them without
// page.tsx needing to export anything beyond the default component.

import type { SerializedGraph } from '@/lib/flows/graph'

export type StepInstanceRow = {
  id: string
  step_id: string
  assigned_to: string | null
  form_data: Record<string, unknown>
  status: 'pending' | 'completed' | 'skipped'
  completed_at: string | null
  created_at: string
  due_at: string | null
  assignee_name: string | null
}

export type InstanceDetail = {
  id: string
  status: 'pending' | 'completed' | 'cancelled' | 'error'
  triggered_by: string
  triggered_by_name: string | null
  current_step_id: string | null
  created_at: string
  updated_at: string
  flow_name: string
  flow_description: string | null
  graph: SerializedGraph
  steps: StepInstanceRow[]
  viewer_is_assignee: boolean
  isAdmin: boolean
  show_full_comment_history: boolean
}
