import { createClient } from '@supabase/supabase-js'

// Service role client — ONLY use in Server Actions and Route Handlers
// Never import this in any client component or expose to the browser
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
