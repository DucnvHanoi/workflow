// FILE PATH: src/store/canvas-store.ts

import { create } from 'zustand'
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from '@xyflow/react'
import { serializeGraph, deserializeGraph, type SerializedGraph } from '@/lib/flows/graph'
import { saveDraftVersion, updateDraftGraph } from '@/lib/flows/actions'

// ─── Types ───────────────────────────────────────────────────────────────────

export type FormFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'dropdown'
  | 'radio'
  | 'checkbox'
  | 'file'
  | 'date'

export interface FormField {
  id: string
  type: FormFieldType
  label: string
  required: boolean
  options?: string[] // for dropdown, radio, and checkbox
}

export interface BranchCondition {
  id: string
  fieldId: string
  nodeId?: string // which upstream node owns this field; undefined = use immediately preceding step (legacy)
  operator: 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains'
  value: string
  handleId: 'yes' | 'no'
}

export type AssigneeRuleType =
  | 'requester'
  | 'fixed'
  | 'manager_of_requestor'
  | 'skip_level'
  | 'department_head'
  | 'requester_dept_head'
  | 'role_in_dept'

export type AssigneeRule =
  | { type: 'requester' }
  | { type: 'fixed'; email: string }
  | { type: 'manager_of_requestor' }
  | { type: 'skip_level' }
  | { type: 'department_head'; departmentId: string }
  | { type: 'requester_dept_head' }
  | { type: 'role_in_dept'; departmentId: string; role: string }
  | null

export interface NodeData {
  label: string
  description?: string
  formSchema: FormField[]
  assigneeRule: AssigneeRule
  branchConditions: BranchCondition[]
  slaHours?: number // optional SLA; runtime computes due_at = now() + slaHours
  escalateAfterHours?: number // optional; escalate to manager this many hours after due_at
  [key: string]: unknown // required by React Flow's NodeData constraint
}

// ─── Tenant data types (passed in from server) ───────────────────────────────

export interface TenantUser {
  id: string
  full_name: string | null
  email: string
}

export interface TenantDepartment {
  id: string
  name: string
  parent_id: string | null
}

// ─── Store ───────────────────────────────────────────────────────────────────

export interface CanvasStore {
  saveStatus: 'idle' | 'saving' | 'saved' | 'error'
  latestVersionId: string | null
  flowId: string | null
  _debounceTimer: ReturnType<typeof setTimeout> | null

  isReadOnly: boolean

  // When set, triggerSave/triggerPositionSave call this instead of the default
  // flow-version save. Used by the platform template editor so saves go to
  // flow_templates.graph rather than flow_versions.
  _customSaveFn: ((graph: SerializedGraph) => Promise<{ versionId: string; error?: string }>) | null

  nodes: Node[]
  edges: Edge[]
  selectedNodeId: string | null

  onNodesChange: (changes: NodeChange[]) => void
  onEdgesChange: (changes: EdgeChange[]) => void
  onConnect: (connection: Connection) => void

  setSelectedNodeId: (id: string | null) => void
  addNode: (type: string, position?: { x: number; y: number }) => void
  updateNodeData: (id: string, partialData: Partial<NodeData>) => void

  addFormField: (nodeId: string, type: FormFieldType) => void
  updateFormField: (nodeId: string, fieldId: string, patch: Partial<FormField>) => void
  removeFormField: (nodeId: string, fieldId: string) => void
  reorderFormFields: (nodeId: string, fields: FormField[]) => void

  setAssigneeRule: (nodeId: string, rule: AssigneeRule) => void

  setSaveStatus: (status: 'idle' | 'saving' | 'saved' | 'error') => void
  setLatestVersionId: (id: string | null) => void
  setFlowId: (id: string) => void
  setCustomSaveFn: (
    fn: ((graph: SerializedGraph) => Promise<{ versionId: string; error?: string }>) | null
  ) => void

  setReadOnly: (val: boolean) => void
  loadVersion: (graph: SerializedGraph) => void

  triggerSave: () => void
  triggerPositionSave: () => void
  reset: () => void
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateId(): string {
  return Math.random().toString(36).slice(2, 9)
}

function defaultData(): NodeData {
  return {
    label: 'New Step',
    description: '',
    formSchema: [],
    assigneeRule: null,
    branchConditions: [],
  }
}

// ─── Store implementation ─────────────────────────────────────────────────────

export const useCanvasStore = create<CanvasStore>((set, get) => {
  // Shared debounced save (300ms). `saver` decides the persistence semantics:
  //   - saveDraftVersion → INSERT a new version (structural edits)
  //   - updateDraftGraph → UPDATE the latest draft in place (position-only moves)
  const runDebouncedSave = (
    saver: (
      flowId: string,
      graph: SerializedGraph
    ) => Promise<{ versionId: string; error?: string }>
  ) => {
    const state = get()
    if (!state.flowId) return
    if (state.isReadOnly) return

    if (state._debounceTimer) clearTimeout(state._debounceTimer)

    set({ saveStatus: 'saving' })

    const timer = setTimeout(async () => {
      const { nodes, edges, flowId } = get()
      if (!flowId) return

      try {
        const graph = serializeGraph(nodes as Node<NodeData>[], edges)
        const result = await saver(flowId, graph)
        if (result.error) {
          set({ saveStatus: 'error' })
        } else {
          set({ saveStatus: 'saved', latestVersionId: result.versionId })
          setTimeout(() => set({ saveStatus: 'idle' }), 2000)
        }
      } catch {
        set({ saveStatus: 'error' })
      }
    }, 300)

    set({ _debounceTimer: timer })
  }

  return {
    saveStatus: 'idle',
    latestVersionId: null,
    flowId: null,
    _debounceTimer: null,
    isReadOnly: false,
    _customSaveFn: null,

    nodes: [],
    edges: [],
    selectedNodeId: null,

    onNodesChange: (changes) => {
      set((state) => ({ nodes: applyNodeChanges(changes, state.nodes) })) // _changes is unused parameter
    },

    onEdgesChange: (changes) => {
      set((state) => ({ edges: applyEdgeChanges(changes, state.edges) })) // _changes is unused parameter
    },

    onConnect: (connection) => {
      set((state) => ({ edges: addEdge(connection, state.edges) })) // _connection is unused parameter
    },

    setSelectedNodeId: (id) => set({ selectedNodeId: id }),

    addNode: (type, position = { x: 250, y: 150 }) => {
      const id = generateId()
      const labelMap: Record<string, string> = {
        trigger: 'Trigger',
        action: 'New Action',
        branch: 'Branch',
        complete: 'Complete',
      }
      const newNode: Node = {
        id,
        type,
        position,
        data: {
          ...defaultData(),
          label: labelMap[type] ?? 'New Step',
        },
      }
      set((state) => ({ nodes: [...state.nodes, newNode] }))
    },

    updateNodeData: (id, partialData) => {
      set((state) => ({
        nodes: state.nodes.map((node) =>
          node.id === id ? { ...node, data: { ...node.data, ...partialData } } : node
        ),
      }))
    },

    addFormField: (nodeId, type) => {
      const fieldId = generateId()
      const newField: FormField = {
        id: fieldId,
        type,
        label: '',
        required: false,
        ...(type === 'dropdown' || type === 'radio' || type === 'checkbox'
          ? { options: ['', ''] }
          : {}),
      }
      set((state) => ({
        nodes: state.nodes.map((node) => {
          if (node.id !== nodeId) return node
          const data = node.data as NodeData
          return {
            ...node,
            data: { ...data, formSchema: [...data.formSchema, newField] },
          }
        }),
      }))
    },

    updateFormField: (nodeId, fieldId, patch) => {
      set((state) => ({
        nodes: state.nodes.map((node) => {
          if (node.id !== nodeId) return node
          const data = node.data as NodeData
          return {
            ...node,
            data: {
              ...data,
              formSchema: data.formSchema.map((f) => (f.id === fieldId ? { ...f, ...patch } : f)),
            },
          }
        }),
      }))
    },

    removeFormField: (nodeId, fieldId) => {
      set((state) => ({
        nodes: state.nodes.map((node) => {
          if (node.id !== nodeId) return node
          const data = node.data as NodeData
          return {
            ...node,
            data: {
              ...data,
              formSchema: data.formSchema.filter((f) => f.id !== fieldId),
            },
          }
        }),
      }))
    },

    reorderFormFields: (nodeId, fields) => {
      set((state) => ({
        nodes: state.nodes.map((node) => {
          if (node.id !== nodeId) return node
          const data = node.data as NodeData
          return { ...node, data: { ...data, formSchema: fields } }
        }),
      }))
    },

    setAssigneeRule: (nodeId, rule) => {
      set((state) => ({
        nodes: state.nodes.map((node) =>
          node.id === nodeId ? { ...node, data: { ...node.data, assigneeRule: rule } } : node
        ),
      }))
    },

    setSaveStatus: (status) => set({ saveStatus: status }),
    setLatestVersionId: (id) => set({ latestVersionId: id }),
    setFlowId: (id) => set({ flowId: id }),
    setCustomSaveFn: (fn) => set({ _customSaveFn: fn }),

    setReadOnly: (val) => set({ isReadOnly: val }),

    loadVersion: (graph: SerializedGraph) => {
      const { nodes, edges } = deserializeGraph(graph)
      set({
        nodes,
        edges,
        selectedNodeId: null,
        isReadOnly: true,
      })
    },

    // Structural edits (add/remove node, edge changes, field/assignee/branch
    // edits) → new version snapshot. If a custom save fn is set (template
    // editor), route through that instead.
    triggerSave: () => {
      const fn = get()._customSaveFn
      if (fn) {
        runDebouncedSave((_, graph) => fn(graph))
      } else {
        runDebouncedSave(saveDraftVersion)
      }
    },

    // Position-only node moves → overwrite the latest draft in place (no new
    // version). Avoids ballooning version_number on every drag.
    triggerPositionSave: () => {
      const fn = get()._customSaveFn
      if (fn) {
        runDebouncedSave((_, graph) => fn(graph))
      } else {
        runDebouncedSave(updateDraftGraph)
      }
    },

    reset: () => {
      const state = get()
      if (state._debounceTimer) clearTimeout(state._debounceTimer)
      set({
        nodes: [],
        edges: [],
        selectedNodeId: null,
        saveStatus: 'idle',
        latestVersionId: null,
        flowId: null,
        _debounceTimer: null,
        isReadOnly: false,
        _customSaveFn: null,
      })
    },
  }
})
