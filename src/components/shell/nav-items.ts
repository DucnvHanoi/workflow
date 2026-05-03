import {
  LayoutDashboard,
  CheckSquare,
  GitBranch,
  Users,
  Building2,
  UserPlus,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  adminOnly: boolean
}

export const NAV_ITEMS: NavItem[] = [
  // Normal user items
  { label: 'My Tasks', href: '/tasks', icon: CheckSquare, adminOnly: false },
  { label: 'My Flows', href: '/my-flows', icon: GitBranch, adminOnly: false },
  // Admin-only items
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, adminOnly: true },
  { label: 'Flow Builder', href: '/flows', icon: GitBranch, adminOnly: true },
  { label: 'Users', href: '/users', icon: Users, adminOnly: true },
  { label: 'Departments', href: '/departments', icon: Building2, adminOnly: true },
  { label: 'Invite', href: '/invite', icon: UserPlus, adminOnly: true },
]

export function getNavItems(role: string): NavItem[] {
  if (role === 'admin') return NAV_ITEMS
  return NAV_ITEMS.filter((item) => !item.adminOnly)
}
