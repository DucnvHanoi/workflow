import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getSessionClaims } from '@/lib/supabase/auth-helpers'
import { createAdminClient } from '@/lib/supabase/admin'
import { deserializeGraph } from '@/lib/flows/graph'
import type { SerializedGraph } from '@/lib/flows/graph'
import { CanvasToolbar } from '@/components/canvas/CanvasToolbar'
import FlowCanvas from '@/components/canvas/FlowCanvas'
import { TemplateTopBar } from '@/components/platform/TemplateTopBar'

export default async function TemplateEditPage({ params }: { params: { id: string } }) {
  const { user } = await getSessionClaims()
  const platformEmail = process.env.PLATFORM_ADMIN_EMAIL ?? ''
  if (!user || user.email !== platformEmail) redirect('/unauthorized')

  const db = createAdminClient()
  const { data: template } = await db
    .from('flow_templates')
    .select('id, name, description, category, graph, is_published')
    .eq('id', params.id)
    .single()

  if (!template) redirect('/platform/templates')

  const graph = template.graph as SerializedGraph | null
  const { nodes: initialNodes, edges: initialEdges } = graph
    ? deserializeGraph(graph)
    : { nodes: [], edges: [] }

  return (
    <div className="flex h-screen flex-col">
      {/* Top bar */}
      <div className="flex h-14 flex-shrink-0 items-center gap-3 border-b border-border bg-background px-4">
        <Link
          href="/platform/templates"
          className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Templates
        </Link>

        <span className="text-muted-foreground">/</span>

        <TemplateTopBar
          templateId={template.id}
          initialName={template.name}
          initialDescription={template.description ?? ''}
          initialCategory={template.category}
          initialPublished={template.is_published}
        />

        <CanvasToolbar />
      </div>

      {/* Canvas */}
      <div className="flex-1 overflow-hidden">
        <FlowCanvas
          flowId={template.id}
          flowName={template.name}
          flowStatus="draft"
          users={[]}
          departments={[]}
          initialNodes={initialNodes}
          initialEdges={initialEdges}
          initialAllowedDeptIds={[]}
          templateId={template.id}
        />
      </div>
    </div>
  )
}
