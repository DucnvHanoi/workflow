import {
  LayoutDashboard,
  CheckSquare,
  GitBranch,
  Users,
  Building2,
  UserPlus,
  PlayCircle,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  adminOnly: boolean
  hideFromAdmin?: boolean // ← new flag
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
  // Admin-only items
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, adminOnly: true },
  { label: 'Flow Builder', href: '/flows', icon: GitBranch, adminOnly: true },
  { label: 'Users', href: '/users', icon: Users, adminOnly: true },
  { label: 'Departments', href: '/departments', icon: Building2, adminOnly: true },
  { label: 'Invite', href: '/invite', icon: UserPlus, adminOnly: true },
]

export function getNavItems(role: string): NavItem[] {
  if (role === 'admin') {
    // Admins see all items except those explicitly hidden from them
    return NAV_ITEMS.filter((item) => !item.hideFromAdmin)
  }
  // Regular users see only non-adminOnly items
  return NAV_ITEMS.filter((item) => !item.adminOnly)
}
