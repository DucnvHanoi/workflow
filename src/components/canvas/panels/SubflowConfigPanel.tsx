'use client'

import { useEffect, useState, useTransition } from 'react'
import type { Node } from '@xyflow/react'
import { Loader2, GitMerge, Clock, Zap, AlertTriangle } from 'lucide-react'
import { useCanvasStore } from '@/store/canvas-store'
import { getPublishedFlowsForSubflow } from '@/lib/flows/actions'

interface Props {
  node: Node
}

interface FlowOption {
  id: string
  name: string
}

export default function SubflowConfigPanel({ node }: Props) {
  const { updateNodeData, flowId } = useCanvasStore()
  const data = node.data as {
    subflowId?: string
    subflowName?: string
    waitForCompletion?: boolean
  }

  const [flows, setFlows] = useState<FlowOption[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isFetching, startFetch] = useTransition()

  // Load published flows on mount
  useEffect(() => {
    startFetch(async () => {
      const result = await getPublishedFlowsForSubflow()
      if (result.error) {
        setLoadError(result.error)
      } else {
        // Exclude the current flow to prevent trivial self-loops
        setFlows(result.flows.filter((f) => f.id !== flowId))
      }
    })
  }, [flowId]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleFlowChange(selectedId: string) {
    if (selectedId === 'none') {
      updateNodeData(node.id, { subflowId: undefined, subflowName: undefined })
      return
    }
    const selected = flows.find((f) => f.id === selectedId)
    updateNodeData(node.id, {
      subflowId: selectedId,
      subflowName: selected?.name ?? '',
    })
  }

  function handleWaitToggle(wait: boolean) {
    updateNodeData(node.id, { waitForCompletion: wait })
  }

  const selectedId = data.subflowId ?? 'none'
  const waits = !!data.waitForCompletion

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <GitMerge className="h-4 w-4 text-orange-500" />
        <p className="text-sm font-semibold text-foreground">Sub-flow</p>
      </div>

      {/* Flow picker */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Target flow</label>
        {isFetching ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading flows…
          </div>
        ) : loadError ? (
          <div className="flex items-start gap-1.5 text-xs text-destructive">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            {loadError}
          </div>
        ) : (
          <select
            value={selectedId}
            onChange={(e) => handleFlowChange(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="none">— Select a flow —</option>
            {flows.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        )}
        <p className="text-[10px] text-muted-foreground">
          Only published flows in this workspace are available.
        </p>
      </div>

      {/* Wait toggle */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">After triggering</label>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => handleWaitToggle(true)}
            className={`flex flex-col items-center gap-1 rounded-md border px-2 py-2.5 text-xs transition-colors ${
              waits
                ? 'border-orange-400 bg-orange-50 text-orange-700'
                : 'border-border text-muted-foreground hover:bg-muted'
            }`}
          >
            <Clock className="h-4 w-4" />
            <span className="font-medium">Wait</span>
            <span className="text-[10px] leading-tight text-center">
              Pause until sub-flow completes
            </span>
          </button>
          <button
            onClick={() => handleWaitToggle(false)}
            className={`flex flex-col items-center gap-1 rounded-md border px-2 py-2.5 text-xs transition-colors ${
              !waits
                ? 'border-orange-400 bg-orange-50 text-orange-700'
                : 'border-border text-muted-foreground hover:bg-muted'
            }`}
          >
            <Zap className="h-4 w-4" />
            <span className="font-medium">Continue</span>
            <span className="text-[10px] leading-tight text-center">
              Fire &amp; continue independently
            </span>
          </button>
        </div>
      </div>

      {/* Context note */}
      {data.subflowId && (
        <div className="rounded-md bg-muted/50 px-3 py-2 text-[11px] text-muted-foreground space-y-1">
          <p>
            <strong>Triggered by:</strong> inherited from parent (same requester)
          </p>
          {waits ? (
            <p>
              Parent flow pauses here until the sub-flow reaches <strong>Complete</strong>.
            </p>
          ) : (
            <p>Both flows run in parallel after this point.</p>
          )}
        </div>
      )}
    </div>
  )
}
