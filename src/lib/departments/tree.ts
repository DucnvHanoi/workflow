export interface FlatDepartment {
  id: string
  name: string
  parent_id: string | null
  created_at: string
  userCount: number
}

export interface DepartmentTreeNode extends FlatDepartment {
  depth: number // 1 = root, 2 = child, 3 = grandchild
  children: DepartmentTreeNode[]
}

export function buildDepartmentTree(flat: FlatDepartment[]): DepartmentTreeNode[] {
  const map = new Map<string, DepartmentTreeNode>()

  // First pass — create all nodes
  for (const d of flat) {
    map.set(d.id, { ...d, depth: 1, children: [] })
  }

  const roots: DepartmentTreeNode[] = []

  // Second pass — attach children to parents
  for (const node of map.values()) {
    if (node.parent_id && map.has(node.parent_id)) {
      map.get(node.parent_id)!.children.push(node)
    } else {
      roots.push(node)
    }
  }

  // Third pass — assign depths recursively
  function assignDepth(node: DepartmentTreeNode, depth: number) {
    node.depth = depth
    for (const child of node.children) assignDepth(child, depth + 1)
  }
  for (const root of roots) assignDepth(root, 1)

  // Sort alphabetically at every level
  function sortNodes(nodes: DepartmentTreeNode[]) {
    nodes.sort((a, b) => a.name.localeCompare(b.name))
    for (const n of nodes) sortNodes(n.children)
  }
  sortNodes(roots)

  return roots
}

// Flatten tree back to ordered rows for table rendering
// Returns rows in display order (parent before children) with depth attached
export function flattenTree(nodes: DepartmentTreeNode[]): DepartmentTreeNode[] {
  const result: DepartmentTreeNode[] = []
  function walk(nodes: DepartmentTreeNode[]) {
    for (const n of nodes) {
      result.push(n)
      walk(n.children)
    }
  }
  walk(nodes)
  return result
}
