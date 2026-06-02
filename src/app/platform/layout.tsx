import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSessionClaims } from '@/lib/supabase/auth-helpers'
import {
  LayoutDashboard,
  Users,
  Settings2,
  Zap,
  LayoutTemplate,
  Headphones,
  BookOpen,
  Bot,
} from 'lucide-react'

const NAV = [
  { href: '/platform/tenants', label: 'Tenants', icon: Users },
  { href: '/platform/plan-config', label: 'Plan Config', icon: Settings2 },
  { href: '/platform/ai-overrides', label: 'AI Overrides', icon: Zap },
  { href: '/platform/ai-settings', label: 'AI Settings', icon: Bot },
  { href: '/platform/templates', label: 'Templates', icon: LayoutTemplate },
  { href: '/platform/support', label: 'Support', icon: Headphones },
  { href: '/platform/support/knowledge', label: 'Knowledge Base', icon: BookOpen },
]

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const { user } = await getSessionClaims()
  if (!user) redirect('/login')
  // email guard is enforced in middleware; layout just provides the shell

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Top bar */}
      <header className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 flex items-center gap-6 h-14">
          <Link
            href="/platform/tenants"
            className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100 shrink-0"
          >
            <LayoutDashboard className="h-4 w-4 text-indigo-600" />
            Platform Admin
          </Link>
          <nav className="flex items-center gap-1">
            {NAV.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto text-xs text-slate-400">{user.email}</div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">{children}</div>
    </div>
  )
}
