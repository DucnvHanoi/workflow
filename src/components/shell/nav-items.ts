// FILE PATH: src/components/shell/nav-items.ts

import {
  LayoutDashboard,
  CheckSquare,
  GitBranch,
  Users,
  Building2,
  UserPlus,
  PlayCircle,
  List,
  ScrollText,
  Clock,
  Upload,
  Network,
  BookUser,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  adminOnly: boolean
  hideFromAdmin?: boolean
  /** Match only the exact href, not children, for active-link detection */
  exact?: boolean
}

export const NAV_ITEMS: NavItem[] = [
  // Normal user items (visible to all roles)
  { label: 'My Tasks', href: '/tasks', icon: CheckSquare, adminOnly: false },
  {
    label: 'Start a Flow',
    href: '/flows',
    icon: PlayCircle,
    adminOnly: false,
    hideFromAdmin: true,
  },
  { label: 'Directory', href: '/directory', icon: BookUser, adminOnly: false },
  { label: 'Org Chart', href: '/org-chart', icon: Network, adminOnly: false },
  // Admin-only items
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, adminOnly: true },
  { label: 'Flow Builder', href: '/flows', icon: GitBranch, adminOnly: true },
  { label: 'Instances', href: '/admin/instances', icon: List, adminOnly: true },
  { label: 'Audit Trail', href: '/admin/audit', icon: ScrollText, adminOnly: true },
  { label: 'Users', href: '/users', icon: Users, adminOnly: true },
  { label: 'Departments', href: '/departments', icon: Building2, adminOnly: true },
  { label: 'Invite', href: '/invite', icon: UserPlus, adminOnly: true, exact: true },
  { label: 'Bulk Import', href: '/invite/import', icon: Upload, adminOnly: true },
  { label: 'Pending Invites', href: '/invite/pending', icon: Clock, adminOnly: true },
]

export function getNavItems(role: string): NavItem[] {
  if (role === 'admin') {
    return NAV_ITEMS.filter((item) => !item.hideFromAdmin)
  }
  return NAV_ITEMS.filter((item) => !item.adminOnly)
}
