'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/membership'

const schema = z.object({ name: z.string().min(1).max(60) })

export async function updateWorkspace(slug: string, formData: FormData) {
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
