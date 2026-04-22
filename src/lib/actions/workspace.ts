'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const schema = z.object({ name: z.string().min(1).max(60) })

export async function updateWorkspace(formData: FormData) {
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
  return { ok: true }
}
