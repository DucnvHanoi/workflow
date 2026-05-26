'use server'

import { createAdminClient } from '@/lib/supabase/admin'

export type SignupResult = { success: true } | { error: string }

export async function createTenantAccount(email: string, password: string): Promise<SignupResult> {
  const admin = createAdminClient()

  // 1. Create auth user — email_confirm:true skips confirmation email
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (authError) {
    const msg = authError.message.toLowerCase()
    if (
      msg.includes('already been registered') ||
      msg.includes('already exists') ||
      (msg.includes('email address') && msg.includes('taken'))
    ) {
      return { error: 'An account with this email already exists. Try logging in instead.' }
    }
    return { error: authError.message }
  }

  const userId = authData.user.id

  // 2. Create tenant (plan defaults to 'free' via DB CHECK constraint default)
  const { data: tenant, error: tenantError } = await admin
    .from('tenants')
    .insert({ name: 'My Organization', plan: 'free' })
    .select('id')
    .single()

  if (tenantError || !tenant) {
    await admin.auth.admin.deleteUser(userId)
    return { error: 'Failed to set up your workspace. Please try again.' }
  }

  const tenantId = tenant.id

  // 3. Create user row linking auth identity to tenant
  const { error: userError } = await admin
    .from('users')
    .insert({ id: userId, tenant_id: tenantId, email, role: 'admin' })

  if (userError) {
    await admin.auth.admin.deleteUser(userId)
    await admin.from('tenants').delete().eq('id', tenantId)
    return { error: 'Failed to set up your workspace. Please try again.' }
  }

  // 4. Stamp app_metadata so every issued JWT carries tenant_id + role
  const { error: metaError } = await admin.auth.admin.updateUserById(userId, {
    app_metadata: { tenant_id: tenantId, role: 'admin' },
  })

  if (metaError) {
    await admin.auth.admin.deleteUser(userId)
    await admin.from('tenants').delete().eq('id', tenantId)
    return { error: 'Failed to set up your workspace. Please try again.' }
  }

  return { success: true }
}
