'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { getNavItems } from './nav-items'
import { cn } from '@/lib/utils'
import { Workflow } from 'lucide-react'

interface SidebarProps {
  role: string
}

export function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname()
  const navItems = getNavItems(role)

  return (
    <aside className="flex flex-col w-56 border-r bg-card shrink-0 h-screen">
      {/* Brand */}
      <div className="flex items-center gap-2 px-4 h-14 border-b shrink-0">
        <div className="flex items-center justify-center w-7 h-7 rounded-md bg-primary">
          <Workflow className="h-4 w-4 text-primary-foreground" />
        </div>
        <span className="font-semibold text-sm tracking-tight">Workflow</span>
      </div>

      {/* Nav links */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
          const Icon = item.icon

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
