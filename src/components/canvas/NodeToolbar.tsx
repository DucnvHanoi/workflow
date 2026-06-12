'use client'

import { Play, CheckSquare, GitBranch, Flag, GitMerge, Sparkles } from 'lucide-react'
import { useCanvasStore } from '@/store/canvas-store'

const NODE_TYPES: { type: string; label: string; icon: React.ReactNode; color: string }[] = [
  {
    type: 'trigger',
    label: 'Trigger',
    icon: <Play className="h-4 w-4" />,
    color: 'text-emerald-600 hover:bg-emerald-50 border-emerald-200',
  },
  {
    type: 'action',
    label: 'Action',
    icon: <CheckSquare className="h-4 w-4" />,
    color: 'text-blue-600 hover:bg-blue-50 border-blue-200',
  },
  {
    type: 'branch',
    label: 'Branch',
    icon: <GitBranch className="h-4 w-4" />,
    color: 'text-amber-600 hover:bg-amber-50 border-amber-200',
  },
  {
    type: 'complete',
    label: 'Complete',
    icon: <Flag className="h-4 w-4" />,
    color: 'text-purple-600 hover:bg-purple-50 border-purple-200',
  },
  {
    type: 'subflow',
    label: 'Sub-flow',
    icon: <GitMerge className="h-4 w-4" />,
    color: 'text-orange-600 hover:bg-orange-50 border-orange-200',
  },
]

interface NodeToolbarProps {
  onAiClick: () => void
}

export function NodeToolbar({ onAiClick }: NodeToolbarProps) {
  const addNode = useCanvasStore((s) => s.addNode)

  return (
    <div className="absolute left-4 top-1/2 z-10 flex -translate-y-1/2 flex-col gap-2 rounded-xl border bg-white p-2 shadow-md">
      {NODE_TYPES.map(({ type, label, icon, color }) => (
        <button
          key={type}
          onClick={() => addNode(type)}
          className={`flex flex-col items-center gap-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${color}`}
          title={`Add ${label} node`}
        >
          {icon}
          {label}
        </button>
      ))}

      <div className="border-t border-border my-0.5" />

      <button
        onClick={onAiClick}
        className="flex flex-col items-center gap-1 rounded-lg border border-violet-200 px-3 py-2 text-xs font-medium text-violet-600 transition-colors hover:bg-violet-50"
        title="Generate flow with AI"
      >
        <Sparkles className="h-4 w-4" />
        AI
      </button>
    </div>
  )
}
