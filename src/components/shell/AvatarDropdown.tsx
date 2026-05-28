'use client'

import { useRouter } from 'next/navigation'
import { User, Settings, LogOut, MapPin } from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useTour } from '@/components/onboarding/TourProvider'

interface Props {
  initials: string
  displayName: string
  email: string
  role: string
}

export function AvatarDropdown({ initials, displayName, email, role }: Props) {
  const router = useRouter()
  const { startTour } = useTour()

  async function handleSignOut() {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground select-none hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          title={displayName || email}
        >
          {initials}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="font-normal">
          <p className="text-sm font-medium text-foreground truncate">{displayName || email}</p>
          {displayName && <p className="text-xs text-muted-foreground truncate">{email}</p>}
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuItem onSelect={() => router.push('/profiles')}>
          <User className="mr-2 h-4 w-4" />
          Profile
        </DropdownMenuItem>

        {role === 'admin' && (
          <DropdownMenuItem onSelect={() => router.push('/settings')}>
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </DropdownMenuItem>
        )}

        <DropdownMenuItem onSelect={startTour}>
          <MapPin className="mr-2 h-4 w-4" />
          Take the tour
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onSelect={handleSignOut}
          className="text-destructive focus:text-destructive"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
