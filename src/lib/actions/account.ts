'use server'

import { redirect } from 'next/navigation'
import { createClient as createServer } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { env } from '@/lib/env'

export async function deleteAccount() {
  const supabase = await createServer()
  const { data } = await supabase.auth.getUser()
  if (!data.user) return { error: 'Not authenticated.' }

  const admin = createAdmin(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { error } = await admin.auth.admin.deleteUser(data.user.id)
  if (error) return { error: error.message }

  await supabase.auth.signOut()
  redirect('/')
}
