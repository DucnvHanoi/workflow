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
import { saveDraftVersion } from '@/lib/flows/actions'

// ─── Types ───────────────────────────────────────────────────────────────────

export type FormFieldType = 'text' | 'dropdown' | 'radio' | 'checkbox' | 'file'

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
  operator: 'eq'
  value: string
  handleId: 'yes' | 'no'
}

export type AssigneeRuleType =
  | 'requester'
  | 'fixed'
  | 'manager_of_requestor'
  | 'skip_level'
  | 'department_head'
  | 'role_in_dept'

export type AssigneeRule =
  | { type: 'requester' }
  | { type: 'fixed'; email: string }
  | { type: 'manager_of_requestor' }
  | { type: 'skip_level' }
  | { type: 'department_head'; departmentId: string }
  | { type: 'role_in_dept'; departmentId: string; role: string }
  | null

export interface NodeData {
  label: string
  description?: string
  formSchema: FormField[]
  assigneeRule: AssigneeRule
  branchConditions: BranchCondition[]
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

  // When true: canvas is showing a historical version preview.
  // All panels hide their edit controls; auto-save is suppressed.
  isReadOnly: boolean

  nodes: Node[]
  edges: Edge[]
  selectedNodeId: string | null

  // React Flow handlers
  onNodesChange: (changes: NodeChange[]) => void
  onEdgesChange: (changes: EdgeChange[]) => void
  onConnect: (connection: Connection) => void

  // Node helpers
  setSelectedNodeId: (id: string | null) => void
  addNode: (type: string, position?: { x: number; y: number }) => void
  updateNodeData: (id: string, partialData: Partial<NodeData>) => void

  // Form field actions
  addFormField: (nodeId: string, type: FormFieldType) => void
  updateFormField: (nodeId: string, fieldId: string, patch: Partial<FormField>) => void
  removeFormField: (nodeId: string, fieldId: string) => void
  reorderFormFields: (nodeId: string, fields: FormField[]) => void

  // Assignee action
  setAssigneeRule: (nodeId: string, rule: AssigneeRule) => void

  // Save status + flowId setters
  setSaveStatus: (status: 'idle' | 'saving' | 'saved' | 'error') => void
  setLatestVersionId: (id: string | null) => void
  setFlowId: (id: string) => void

  // Read-only / version preview
  setReadOnly: (val: boolean) => void
  loadVersion: (graph: SerializedGraph) => void

  triggerSave: () => void
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

export const useCanvasStore = create<CanvasStore>((set, get) => ({
  saveStatus: 'idle',
  latestVersionId: null,
  flowId: null,
  _debounceTimer: null,
  isReadOnly: false,

  nodes: [],
  edges: [],
  selectedNodeId: null,

  // ── React Flow handlers ──────────────────────────────────────────────────

  onNodesChange: (changes) => {
    set((state) => ({ nodes: applyNodeChanges(changes, state.nodes) }))
  },

  onEdgesChange: (changes) => {
    set((state) => ({ edges: applyEdgeChanges(changes, state.edges) }))
  },

  onConnect: (connection) => {
    set((state) => ({ edges: addEdge(connection, state.edges) }))
  },

  // ── Node helpers ─────────────────────────────────────────────────────────

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

  // ── Form field actions ───────────────────────────────────────────────────

  addFormField: (nodeId, type) => {
    const fieldId = generateId()
    const newField: FormField = {
      id: fieldId,
      type,
      label: '',
      required: false,
      // FIX: checkbox also needs options — previously only dropdown and radio
      // were included, causing checkbox fields to be saved with no options array.
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

  // ── Assignee action ──────────────────────────────────────────────────────

  setAssigneeRule: (nodeId, rule) => {
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === nodeId ? { ...node, data: { ...node.data, assigneeRule: rule } } : node
      ),
    }))
  },

  // ── Save status + flowId ─────────────────────────────────────────────────

  setSaveStatus: (status) => set({ saveStatus: status }),
  setLatestVersionId: (id) => set({ latestVersionId: id }),
  setFlowId: (id) => set({ flowId: id }),

  // ── Read-only / version preview ──────────────────────────────────────────

  setReadOnly: (val) => set({ isReadOnly: val }),

  // Loads an old version's graph into the canvas and locks it read-only.
  loadVersion: (graph: SerializedGraph) => {
    const { nodes, edges } = deserializeGraph(graph)
    set({
      nodes,
      edges,
      selectedNodeId: null,
      isReadOnly: true,
    })
  },

  // ── triggerSave ──────────────────────────────────────────────────────────
  // Debounced 300ms. Suppressed when isReadOnly (version preview).

  triggerSave: () => {
    const state = get()
    if (!state.flowId) return
    if (state.isReadOnly) return

    if (state._debounceTimer) clearTimeout(state._debounceTimer)

    set({ saveStatus: 'saving' })

    const timer = setTimeout(async () => {
      const { nodes, edges, flowId } = get()
      if (!flowId) return

      try {
        // Cast needed: store types nodes as Node[] (React Flow base) but
        // serializeGraph expects Node<NodeData>[]. Data is always NodeData
        // at runtime — the cast is safe.
        const graph = serializeGraph(nodes as Node<NodeData>[], edges)
        const result = await saveDraftVersion(flowId, graph)
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
  },

  // ── Reset ────────────────────────────────────────────────────────────────

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
    })
  },
}))
