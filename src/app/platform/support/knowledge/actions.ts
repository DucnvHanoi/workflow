'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionClaims } from '@/lib/supabase/auth-helpers'

// ---------------------------------------------------------------------------
// Auth guard
// ---------------------------------------------------------------------------

async function assertPlatformAdmin() {
  const { user } = await getSessionClaims()
  const platformEmail = process.env.PLATFORM_ADMIN_EMAIL
  if (!user || !platformEmail || user.email !== platformEmail) {
    throw new Error('Unauthorized')
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface KbArticleRow {
  id: string
  title: string
  slug: string
  category: string
  is_active: boolean
  updated_at: string
  created_at: string
}

export interface KbArticleFull extends KbArticleRow {
  content_markdown: string
}

// ---------------------------------------------------------------------------
// getArticles
// ---------------------------------------------------------------------------

export async function getArticles(): Promise<KbArticleRow[]> {
  await assertPlatformAdmin()
  const db = createAdminClient()
  const { data, error } = await db
    .from('knowledge_base')
    .select('id, title, slug, category, is_active, updated_at, created_at')
    .order('category', { ascending: true })
    .order('title', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as KbArticleRow[]
}

// ---------------------------------------------------------------------------
// getArticle
// ---------------------------------------------------------------------------

export async function getArticle(id: string): Promise<KbArticleFull | null> {
  await assertPlatformAdmin()
  const db = createAdminClient()
  const { data, error } = await db
    .from('knowledge_base')
    .select('id, title, slug, category, is_active, content_markdown, updated_at, created_at')
    .eq('id', id)
    .single()
  if (error || !data) return null
  return data as KbArticleFull
}

// ---------------------------------------------------------------------------
// createArticle
// ---------------------------------------------------------------------------

export async function createArticle(formData: FormData): Promise<void> {
  await assertPlatformAdmin()

  const title = (formData.get('title') as string).trim()
  const slug = (formData.get('slug') as string).trim()
  const category = formData.get('category') as string
  const content_markdown = (formData.get('content_markdown') as string).trim()

  if (!title || !slug || !category) throw new Error('Title, slug and category are required')

  const db = createAdminClient()
  const { error } = await db.from('knowledge_base').insert({
    title,
    slug,
    category,
    content_markdown,
    is_active: true,
  })
  if (error) throw new Error(error.message)

  revalidatePath('/platform/support/knowledge')
  revalidatePath('/help')
  redirect('/platform/support/knowledge')
}

// ---------------------------------------------------------------------------
// updateArticle
// ---------------------------------------------------------------------------

export async function updateArticle(id: string, formData: FormData): Promise<void> {
  await assertPlatformAdmin()

  const title = (formData.get('title') as string).trim()
  const slug = (formData.get('slug') as string).trim()
  const category = formData.get('category') as string
  const content_markdown = (formData.get('content_markdown') as string).trim()

  if (!title || !slug || !category) throw new Error('Title, slug and category are required')

  const db = createAdminClient()
  const { error } = await db
    .from('knowledge_base')
    .update({ title, slug, category, content_markdown })
    .eq('id', id)
  if (error) throw new Error(error.message)

  revalidatePath('/platform/support/knowledge')
  revalidatePath('/help')
  revalidatePath(`/help/${slug}`)
  redirect('/platform/support/knowledge')
}

// ---------------------------------------------------------------------------
// toggleActive
// ---------------------------------------------------------------------------

export async function toggleActive(id: string, is_active: boolean): Promise<void> {
  await assertPlatformAdmin()
  const db = createAdminClient()
  const { error } = await db.from('knowledge_base').update({ is_active }).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/platform/support/knowledge')
  revalidatePath('/help')
}

// ---------------------------------------------------------------------------
// deleteArticle
// ---------------------------------------------------------------------------

export async function deleteArticle(id: string): Promise<void> {
  await assertPlatformAdmin()
  const db = createAdminClient()
  const { error } = await db.from('knowledge_base').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/platform/support/knowledge')
  revalidatePath('/help')
}
