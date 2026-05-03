import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function AppNotFound() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-4">
      <div>
        <p className="text-5xl font-bold text-muted-foreground/30">404</p>
        <h2 className="text-lg font-semibold mt-2">Page not found</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          The page you are looking for does not exist or has been moved.
        </p>
      </div>
      <Button asChild variant="outline">
        <Link href="/dashboard">Go to dashboard</Link>
      </Button>
    </div>
  )
}
