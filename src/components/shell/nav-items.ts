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
  BarChart2,
  Settings,
  Bot,
  TrendingUp,
  ShieldCheck,
  BookOpen,
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
  /** Visual group label rendered above the first item in each group */
  group?: string
  /** data-tour attribute value for tooltip tour targeting */
  tourKey?: string
}

export const NAV_ITEMS: NavItem[] = [
  // Visible to all roles
  { label: 'My Tasks', href: '/tasks', icon: CheckSquare, adminOnly: false },
  {
    label: 'Start a Flow',
    href: '/flows',
    icon: PlayCircle,
    adminOnly: false,
    hideFromAdmin: true,
    tourKey: 'nav-start-flow',
  },
  // Admin-only workflow items
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, adminOnly: true },
  {
    label: 'Flow Builder',
    href: '/flows',
    icon: GitBranch,
    adminOnly: true,
    tourKey: 'nav-flow-builder',
  },
  { label: 'Instances', href: '/admin/instances', icon: List, adminOnly: true },
  { label: 'Audit Trail', href: '/admin/audit', icon: ScrollText, adminOnly: true },
  { label: 'AI Spend', href: '/admin/ai-usage', icon: Bot, adminOnly: true },
  // Departments group
  {
    label: 'Management',
    href: '/departments',
    icon: Building2,
    adminOnly: true,
    exact: true,
    group: 'Departments',
  },
  {
    label: 'Workload',
    href: '/departments/workload',
    icon: BarChart2,
    adminOnly: true,
    group: 'Departments',
  },
  // Users group — admin sees management items, all users see Directory + Org Chart
  { label: 'Users', href: '/users', icon: Users, adminOnly: true, group: 'Users' },
  {
    label: 'Invite',
    href: '/invite',
    icon: UserPlus,
    adminOnly: true,
    exact: true,
    group: 'Users',
    tourKey: 'nav-invite',
  },
  {
    label: 'Pending Invites',
    href: '/invite/pending',
    icon: Clock,
    adminOnly: true,
    group: 'Users',
  },
  { label: 'Bulk Import', href: '/invite/import', icon: Upload, adminOnly: true, group: 'Users' },
  { label: 'Directory', href: '/directory', icon: BookUser, adminOnly: false, group: 'Users' },
  { label: 'Org Chart', href: '/org-chart', icon: Network, adminOnly: false, group: 'Users' },
  // Reports group (admin only)
  {
    label: 'Flow Performance',
    href: '/admin/reports/flows',
    icon: TrendingUp,
    adminOnly: true,
    group: 'Reports',
  },
  {
    label: 'SLA Adherence',
    href: '/admin/reports/sla',
    icon: ShieldCheck,
    adminOnly: true,
    group: 'Reports',
  },
  {
    label: 'User Performance',
    href: '/admin/reports/users',
    icon: Users,
    adminOnly: true,
    group: 'Reports',
  },
  // Settings group (admin only)
  { label: 'Settings', href: '/settings', icon: Settings, adminOnly: true, group: 'Settings' },
  // Help — visible to all roles
  { label: 'Help', href: '/help', icon: BookOpen, adminOnly: false, group: 'Support' },
]

export function getNavItems(role: string): NavItem[] {
  if (role === 'admin') {
    return NAV_ITEMS.filter((item) => !item.hideFromAdmin)
  }
  return NAV_ITEMS.filter((item) => !item.adminOnly)
}
