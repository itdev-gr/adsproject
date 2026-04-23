'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/membership'

const schema = z.object({ name: z.string().min(1).max(60) })

/**
 * Update a workspace's name.
 * - New shape (Task 7+): updateWorkspace(slug, formData)
 * - Legacy shape (Foundation): updateWorkspace(formData) — used by Foundation's
 *   /app/settings/workspace page until Task 11 moves it. Looks up the caller's
 *   single workspace by owner_id (Foundation's "one workspace per user" assumption).
 *   Remove this overload after Task 11.
 */
export async function updateWorkspace(slugOrFormData: string | FormData, maybeFormData?: FormData) {
  if (typeof slugOrFormData === 'string') {
    return updateBySlug(slugOrFormData, maybeFormData!)
  }
  return updateLegacyByOwner(slugOrFormData)
}

async function updateBySlug(slug: string, formData: FormData) {
  const m = await requireRole(slug, ['owner', 'admin'])
  const parsed = schema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: 'Invalid workspace name.' }
  const supabase = await createClient()
  const { error } = await supabase
    .from('workspaces')
    .update({ name: parsed.data.name, updated_at: new Date().toISOString() })
    .eq('id', m.workspaceId)
  if (error) return { error: error.message }
  revalidatePath(`/app/w/${slug}`, 'layout')
  return { ok: true as const }
}

async function updateLegacyByOwner(formData: FormData) {
  const parsed = schema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: 'Invalid workspace name.' }
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) return { error: 'Not authenticated.' }
  const { error } = await supabase
    .from('workspaces')
    .update({ name: parsed.data.name, updated_at: new Date().toISOString() })
    .eq('owner_id', userData.user.id)
  if (error) return { error: error.message }
  revalidatePath('/app', 'layout')
  return { ok: true as const }
}
