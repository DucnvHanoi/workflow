'use client'

import { Fragment, useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { getNavItems } from './nav-items'
import { cn } from '@/lib/utils'
import { Workflow, PanelLeftClose, PanelLeftOpen, Menu, X } from 'lucide-react'

interface SidebarProps {
  role: string
}

export function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname()
  const navItems = getNavItems(role)
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  // Close mobile drawer on navigation
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  return (
    <>
      {/* ── Mobile backdrop ── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Mobile hamburger — fixed in topbar area, hidden on desktop ── */}
      <button
        className="fixed left-0 top-0 z-50 flex h-14 w-14 items-center justify-center text-muted-foreground hover:text-foreground md:hidden"
        onClick={() => setMobileOpen(true)}
        aria-label="Open navigation menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* ── Sidebar ── */}
      <aside
        className={cn(
          'flex flex-col border-r bg-card shrink-0 h-screen',
          // Mobile: fixed full-height drawer, slides in from left
          'fixed inset-y-0 left-0 z-50 w-72 transition-transform duration-200',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
          // Desktop: back in flex flow, no transform, collapsible width
          'md:relative md:translate-x-0 md:transition-none',
          collapsed ? 'md:w-14' : 'md:w-56'
        )}
      >
        {/* Brand */}
        <div className="flex h-14 shrink-0 items-center justify-between border-b px-4">
          <div
            className={cn('flex items-center gap-2', collapsed && 'md:w-full md:justify-center')}
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary">
              <Workflow className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className={cn('text-sm font-semibold tracking-tight', collapsed && 'md:hidden')}>
              Workflow
            </span>
          </div>

          {/* Close button — mobile only */}
          <button
            onClick={() => setMobileOpen(false)}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground md:hidden"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
          {navItems.map((item, idx) => {
            const isGroupBoundary = item.group && item.group !== navItems[idx - 1]?.group
            const isActive = item.exact
              ? pathname === item.href
              : pathname === item.href ||
                (item.href !== '/' && pathname.startsWith(item.href + '/'))
            const Icon = item.icon

            return (
              <Fragment key={item.href + (item.exact ? '|exact' : '')}>
                {/* Group header — hidden on desktop when collapsed */}
                {isGroupBoundary && (
                  <p
                    className={cn(
                      'select-none px-3 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50',
                      collapsed && 'md:hidden'
                    )}
                  >
                    {item.group}
                  </p>
                )}

                <Link
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  data-tour={item.tourKey}
                  className={cn(
                    'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
                    // Desktop collapsed: center icon, remove gap/horizontal padding
                    collapsed && 'md:justify-center md:gap-0 md:px-2',
                    isActive
                      ? 'bg-primary font-medium text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {/* Always visible on mobile; hidden on desktop when collapsed */}
                  <span className={cn(collapsed && 'md:hidden')}>{item.label}</span>
                </Link>
              </Fragment>
            )
          })}
        </nav>

        {/* Legal links — hidden on desktop when collapsed */}
        <div className={cn('flex shrink-0 items-center gap-3 px-3 pb-2', collapsed && 'md:hidden')}>
          <Link
            href="/privacy"
            className="text-[10px] text-muted-foreground/50 transition-colors hover:text-muted-foreground"
          >
            Privacy
          </Link>
          <Link
            href="/terms"
            className="text-[10px] text-muted-foreground/50 transition-colors hover:text-muted-foreground"
          >
            Terms
          </Link>
        </div>

        {/* Collapse toggle — desktop only */}
        <div
          className={cn(
            'hidden shrink-0 border-t p-2 md:flex',
            collapsed ? 'justify-center' : 'justify-end'
          )}
        >
          <button
            onClick={() => setCollapsed((c) => !c)}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </button>
        </div>
      </aside>
    </>
  )
}
