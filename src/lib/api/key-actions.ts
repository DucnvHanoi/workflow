'use server'

import { createHash, randomBytes } from 'crypto'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionClaims } from '@/lib/supabase/auth-helpers'

export interface ApiKeyRow {
  id: string
  name: string
  lastUsedAt: string | null
  callCount30d: number
  createdAt: string
  revokedAt: string | null
}

async function requireAdmin() {
  const { user, claims } = await getSessionClaims()
  if (!user || claims?.role !== 'admin') throw new Error('Unauthorized')
  return { userId: user.id, tenantId: claims.tenant_id as string }
}

export async function getApiKeys(): Promise<{ keys: ApiKeyRow[] }> {
  try {
    const { tenantId } = await requireAdmin()
    const db = createAdminClient()
    const { data } = await db
      .from('tenant_api_keys')
      .select('id, name, last_used_at, call_count_30d, created_at, revoked_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })

    return {
      keys: (data ?? []).map((r) => ({
        id: r.id as string,
        name: r.name as string,
        lastUsedAt: (r.last_used_at as string | null) ?? null,
        callCount30d: (r.call_count_30d as number) ?? 0,
        createdAt: r.created_at as string,
        revokedAt: (r.revoked_at as string | null) ?? null,
      })),
    }
  } catch {
    return { keys: [] }
  }
}

export async function createApiKey(name: string): Promise<{ rawKey: string } | { error: string }> {
  const trimmed = name.trim()
  if (!trimmed) return { error: 'Key name is required.' }
  if (trimmed.length > 80) return { error: 'Key name must be 80 characters or fewer.' }

  try {
    const { userId, tenantId } = await requireAdmin()
    const raw = randomBytes(32).toString('hex') // 64-char hex
    const keyHash = createHash('sha256').update(raw).digest('hex')

    const db = createAdminClient()
    const { error } = await db.from('tenant_api_keys').insert({
      tenant_id: tenantId,
      name: trimmed,
      key_hash: keyHash,
      created_by: userId,
    })

    if (error) return { error: error.message }
    revalidatePath('/settings')
    return { rawKey: raw }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Unexpected error.' }
  }
}

export async function revokeApiKey(keyId: string): Promise<{ error?: string }> {
  try {
    const { tenantId } = await requireAdmin()
    const db = createAdminClient()
    const { error } = await db
      .from('tenant_api_keys')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', keyId)
      .eq('tenant_id', tenantId)
      .is('revoked_at', null)

    if (error) return { error: error.message }
    revalidatePath('/settings')
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Unexpected error.' }
  }
}

export async function deleteApiKey(keyId: string): Promise<{ error?: string }> {
  try {
    const { tenantId } = await requireAdmin()
    const db = createAdminClient()
    const { error } = await db
      .from('tenant_api_keys')
      .delete()
      .eq('id', keyId)
      .eq('tenant_id', tenantId)

    if (error) return { error: error.message }
    revalidatePath('/settings')
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Unexpected error.' }
  }
}
