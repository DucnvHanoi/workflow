'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionClaims } from '@/lib/supabase/auth-helpers'
import type { SerializedGraph } from '@/lib/flows/graph'

async function assertPlatformAdmin() {
  const { user } = await getSessionClaims()
  const platformEmail = process.env.PLATFORM_ADMIN_EMAIL ?? ''
  if (!user || user.email !== platformEmail) throw new Error('Forbidden')
}

export async function createTemplate() {
  await assertPlatformAdmin()
  const db = createAdminClient()

  const { data, error } = await db
    .from('flow_templates')
    .insert({ name: 'Untitled Template' })
    .select('id')
    .single()

  if (error || !data) throw new Error('Failed to create template')
  redirect(`/platform/templates/${data.id}/edit`)
}

export async function saveTemplateGraph(
  templateId: string,
  graph: SerializedGraph
): Promise<{ versionId: string; error?: string }> {
  try {
    await assertPlatformAdmin()
  } catch {
    return { versionId: '', error: 'Forbidden' }
  }

  const db = createAdminClient()
  const { error } = await db
    .from('flow_templates')
    .update({ graph, updated_at: new Date().toISOString() })
    .eq('id', templateId)

  if (error) return { versionId: '', error: error.message }
  return { versionId: templateId }
}

export async function updateTemplateMeta(
  templateId: string,
  patch: { name?: string; description?: string; category?: string }
): Promise<{ error?: string }> {
  try {
    await assertPlatformAdmin()
  } catch {
    return { error: 'Forbidden' }
  }

  const db = createAdminClient()
  const { error } = await db
    .from('flow_templates')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', templateId)

  if (error) return { error: error.message }
  revalidatePath('/platform/templates')
  return {}
}

export async function toggleTemplatePublished(
  templateId: string,
  published: boolean
): Promise<{ error?: string }> {
  try {
    await assertPlatformAdmin()
  } catch {
    return { error: 'Forbidden' }
  }

  const db = createAdminClient()
  const { error } = await db
    .from('flow_templates')
    .update({ is_published: published, updated_at: new Date().toISOString() })
    .eq('id', templateId)

  if (error) return { error: error.message }
  revalidatePath('/platform/templates')
  return {}
}

export async function deleteTemplate(templateId: string): Promise<{ error?: string }> {
  try {
    await assertPlatformAdmin()
  } catch {
    return { error: 'Forbidden' }
  }

  const db = createAdminClient()
  const { error } = await db.from('flow_templates').delete().eq('id', templateId)

  if (error) return { error: error.message }
  revalidatePath('/platform/templates')
  redirect('/platform/templates')
}
