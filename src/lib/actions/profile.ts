'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const schema = z.object({ display_name: z.string().min(0).max(80) })

export async function updateProfile(formData: FormData) {
  const parsed = schema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: 'Invalid display name.' }

  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) return { error: 'Not authenticated.' }

  const { error } = await supabase
    .from('profiles')
    .update({
      display_name: parsed.data.display_name || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userData.user.id)
  if (error) return { error: error.message }

  revalidatePath('/app/settings/profile')
  return { ok: true }
}
