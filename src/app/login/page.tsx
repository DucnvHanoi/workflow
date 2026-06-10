// FILE PATH: src/app/login/page.tsx

import Image from 'next/image'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LoginForm } from '@/components/auth/login-form'

export default async function LoginPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Already logged in — send to tasks
  if (user) redirect('/tasks') // ← was /dashboard

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        {/* Brand mark */}
        <div className="mb-8 text-center">
          <Image
            src="/logo.png"
            alt="Aitomic Flow"
            width={200}
            height={200}
            className="mx-auto mb-3 h-28 w-28 object-contain"
            priority
          />
          <p className="text-sm text-muted-foreground mt-1">Sign in to your workspace</p>
        </div>

        <LoginForm />
      </div>
    </main>
  )
}
