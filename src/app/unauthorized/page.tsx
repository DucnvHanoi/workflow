import Link from 'next/link'
import { ShieldX } from 'lucide-react'

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-4 text-center">
      <div className="flex items-center justify-center w-14 h-14 rounded-full bg-red-100 mb-4">
        <ShieldX className="w-7 h-7 text-red-500" />
      </div>
      <h1 className="text-xl font-semibold text-slate-800">Access denied</h1>
      <p className="mt-2 text-sm text-slate-500 max-w-sm">
        You do not have permission to view this page. Contact your administrator if you believe this
        is a mistake.
      </p>
      <div className="mt-6 flex gap-3">
        <Link
          href="/tasks"
          className="px-4 py-2 rounded-lg bg-indigo-600 text-sm text-white hover:bg-indigo-700 transition-colors"
        >
          Go to app
        </Link>
        <Link
          href="/login"
          className="px-4 py-2 rounded-lg border border-slate-300 text-sm text-slate-700 hover:bg-slate-100 transition-colors"
        >
          Sign in with different account
        </Link>
      </div>
    </div>
  )
}
