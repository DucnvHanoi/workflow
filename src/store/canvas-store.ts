import { create } from 'zustand'
import {
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
} from '@xyflow/react'

export type NodeType = 'trigger' | 'action' | 'branch' | 'complete'

export type BranchCondition = {
  id: string
  fieldId: string
  operator: 'eq'
  value: string
  handleId: 'yes' | 'no'
}

export type AssigneeRule =
  | { type: 'fixed'; email: string }
  | { type: 'manager_of_requestor' }
  | { type: 'skip_level' }
  | { type: 'department_head'; departmentId: string }
  | { type: 'role_in_dept'; departmentId: string; role: string }
  | null

export type FormField = {
  id: string
  type: 'text' | 'dropdown' | 'radio' | 'checkbox' | 'file'
  label: string
  required: boolean
  options?: string[]
}

export type NodeData = {
  label: string
  description?: string
  formSchema: FormField[]
  assigneeRule: AssigneeRule
  branchConditions: BranchCondition[]
}

export interface CanvasState {
  nodes: Node[]
  edges: Edge[]
  selectedNodeId: string | null
  onNodesChange: OnNodesChange
  onEdgesChange: OnEdgesChange
  onConnect: OnConnect
  setNodes: (nodes: Node[]) => void
  setEdges: (edges: Edge[]) => void
  setSelectedNodeId: (id: string | null) => void
  updateNodeData: (id: string, data: Partial<NodeData>) => void
  addNode: (type: NodeType, position?: { x: number; y: number }) => void
  reset: () => void
}

let nodeIdCounter = 1
const getId = () => `node_${Date.now()}_${nodeIdCounter++}`

export const useCanvasStore = create<CanvasState>((set, get) => ({
  nodes: [],
  edges: [],
  selectedNodeId: null,

  onNodesChange: (changes) => set({ nodes: applyNodeChanges(changes, get().nodes) }),

  onEdgesChange: (changes) => set({ edges: applyEdgeChanges(changes, get().edges) }),

  onConnect: (connection) =>
    set({ edges: addEdge({ ...connection, animated: false }, get().edges) }),

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),

  setSelectedNodeId: (id) => set({ selectedNodeId: id }),

  // Merges partial data into existing node.data — preserves all other fields
  updateNodeData: (id, partialData) =>
    set({
      nodes: get().nodes.map((node) =>
        node.id === id ? { ...node, data: { ...node.data, ...partialData } } : node
      ),
    }),

  addNode: (type, position = { x: 250, y: 150 }) => {
    const id = getId()
    const labels: Record<NodeType, string> = {
      trigger: 'Start',
      action: 'Action',
      branch: 'Branch',
      complete: 'Complete',
    }
    const newNode: Node = {
      id,
      type,
      position,
      data: {
        label: labels[type],
        description: '',
        formSchema: [],
        assigneeRule: null,
        branchConditions: [],
      },
    }
    set({ nodes: [...get().nodes, newNode] })
  },

  reset: () => set({ nodes: [], edges: [], selectedNodeId: null }),
}))
