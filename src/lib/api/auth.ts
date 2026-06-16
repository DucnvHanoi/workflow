import { createHash } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'

export interface ApiKeyContext {
  keyId: string
  tenantId: string
  userId: string
}

export async function verifyBearerKey(
  authHeader: string | null
): Promise<{ context: ApiKeyContext | null; error: string | null }> {
  if (!authHeader?.startsWith('Bearer ')) {
    return { context: null, error: 'Missing or invalid Authorization header.' }
  }

  const rawKey = authHeader.slice(7).trim()
  if (!rawKey) return { context: null, error: 'Missing API key.' }

  const keyHash = createHash('sha256').update(rawKey).digest('hex')

  const db = createAdminClient()
  const { data, error } = await db
    .from('tenant_api_keys')
    .select('id, tenant_id, created_by, revoked_at, call_count_30d')
    .eq('key_hash', keyHash)
    .maybeSingle()

  if (error || !data) return { context: null, error: 'Invalid API key.' }
  if (data.revoked_at) return { context: null, error: 'API key has been revoked.' }

  void db
    .from('tenant_api_keys')
    .update({
      last_used_at: new Date().toISOString(),
      call_count_30d: ((data.call_count_30d as number) ?? 0) + 1,
    })
    .eq('id', data.id)

  return {
    context: {
      keyId: data.id as string,
      tenantId: data.tenant_id as string,
      userId: data.created_by as string,
    },
    error: null,
  }
}
