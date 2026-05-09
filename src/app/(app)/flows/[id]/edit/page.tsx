import { createClient } from '@/lib/supabase/server'
import { getSessionClaims } from '@/lib/supabase/auth-helpers'
import { redirect } from 'next/navigation'
import { FlowCanvas } from '@/components/canvas/FlowCanvas'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

interface Props {
  params: { id: string }
}

export default async function FlowEditPage({ params }: Props) {
  const { user, claims } = await getSessionClaims()
  if (!user) redirect('/login')
  if (claims.role !== 'admin') redirect('/unauthorized')

  const supabase = createClient()
  const { data: flow, error } = await supabase
    .from('flows')
    .select('id, name, status')
    .eq('id', params.id)
    .single()

  if (error || !flow) redirect('/flows')

  return (
    <div className="flex h-screen flex-col">
      {/* Top bar */}
      <div className="flex h-14 shrink-0 items-center gap-4 border-b bg-white px-4">
        <Link
          href="/flows"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Flows
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="text-sm font-medium">{flow.name}</span>
        <span
          className={`ml-1 rounded-full px-2 py-0.5 text-xs font-medium ${
            flow.status === 'published'
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-gray-100 text-gray-600'
          }`}
        >
          {flow.status}
        </span>
      </div>

      {/* Canvas — takes remaining height */}
      <div className="flex-1 overflow-hidden">
        <FlowCanvas flowId={flow.id} />
      </div>
    </div>
  )
}
