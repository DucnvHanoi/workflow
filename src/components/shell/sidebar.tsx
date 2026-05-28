'use client'

import { Fragment, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { getNavItems } from './nav-items'
import { cn } from '@/lib/utils'
import { Workflow, PanelLeftClose, PanelLeftOpen } from 'lucide-react'

interface SidebarProps {
  role: string
}

export function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname()
  const navItems = getNavItems(role)
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      className={cn(
        'flex flex-col border-r bg-card shrink-0 h-screen transition-all duration-200',
        collapsed ? 'w-14' : 'w-56'
      )}
    >
      {/* Brand */}
      <div
        className={cn(
          'flex items-center h-14 border-b shrink-0',
          collapsed ? 'justify-center' : 'gap-2 px-4'
        )}
      >
        <div className="flex items-center justify-center w-7 h-7 rounded-md bg-primary shrink-0">
          <Workflow className="h-4 w-4 text-primary-foreground" />
        </div>
        {!collapsed && <span className="font-semibold text-sm tracking-tight">Workflow</span>}
      </div>

      {/* Nav links */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {navItems.map((item, idx) => {
          const showGroup = !collapsed && item.group && item.group !== navItems[idx - 1]?.group
          const isActive = item.exact
            ? pathname === item.href
            : pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href + '/'))
          const Icon = item.icon

          return (
            <Fragment key={item.href + (item.exact ? '|exact' : '')}>
              {showGroup && (
                <p className="px-3 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 select-none">
                  {item.group}
                </p>
              )}
              <Link
                href={item.href}
                title={collapsed ? item.label : undefined}
                data-tour={item.tourKey}
                className={cn(
                  'flex items-center rounded-md text-sm transition-colors',
                  collapsed ? 'justify-center py-2' : 'gap-2.5 px-3 py-2',
                  isActive
                    ? 'bg-primary text-primary-foreground font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed && item.label}
              </Link>
            </Fragment>
          )
        })}
      </nav>

      {/* Legal links */}
      {!collapsed && (
        <div className="px-3 pb-2 flex items-center gap-3 shrink-0">
          <Link
            href="/privacy"
            className="text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
          >
            Privacy
          </Link>
          <Link
            href="/terms"
            className="text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
          >
            Terms
          </Link>
        </div>
      )}

      {/* Collapse toggle */}
      <div
        className={cn(
          'border-t p-2 shrink-0',
          collapsed ? 'flex justify-center' : 'flex justify-end'
        )}
      >
        <button
          onClick={() => setCollapsed((c) => !c)}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </button>
      </div>
    </aside>
  )
}
