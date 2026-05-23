import { redirect } from 'next/navigation'
import { getSessionClaims } from '@/lib/supabase/auth-helpers'
import { BulkImportClient } from './import-client'

export default async function BulkImportPage() {
  const { user, claims } = await getSessionClaims()
  if (!user) redirect('/login')
  if (claims.role !== 'admin') redirect('/tasks')

  return (
    <main className="max-w-3xl mx-auto px-6 py-10">
      <div className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight">Bulk User Import</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Add multiple users from a CSV file without sending invitation emails.
        </p>
      </div>
      <BulkImportClient />
    </main>
  )
}
