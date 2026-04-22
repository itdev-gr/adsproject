'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { ensureUniqueSlug, slugify } from '@/lib/slug'

const schema = z.object({ name: z.string().min(1).max(60) })

export async function createInitialWorkspace(formData: FormData) {
  const parsed = schema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: 'Workspace name is required (max 60 chars).' }

  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) return { error: 'Not authenticated.' }

  const base = slugify(parsed.data.name)
  const slug = await ensureUniqueSlug(base, async (s) => {
    const { count } = await supabase
      .from('workspaces')
      .select('id', { count: 'exact', head: true })
      .eq('slug', s)
    return (count ?? 0) > 0
  })

  const { error } = await supabase
    .from('workspaces')
    .insert({ name: parsed.data.name, slug, owner_id: userData.user.id })
  if (error) return { error: error.message }

  redirect('/app/dashboard')
}
