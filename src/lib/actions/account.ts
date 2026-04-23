'use server'

import { redirect } from 'next/navigation'
import { createClient as createServer } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { env } from '@/lib/env'

export async function deleteAccount() {
  const supabase = await createServer()
  const { data } = await supabase.auth.getUser()
  if (!data.user) return { error: 'Not authenticated.' }

  // Last-owner protection: block deletion if user owns any multi-member workspace.
  const { data: ownedRows } = await supabase
    .from('workspace_members')
    .select('workspace_id, workspaces!inner(name, slug)')
    .eq('user_id', data.user.id)
    .eq('role', 'owner')

  if (ownedRows && ownedRows.length > 0) {
    const adminClient = createAdmin(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    for (const row of ownedRows) {
      const { count } = await adminClient
        .from('workspace_members')
        .select('user_id', { count: 'exact', head: true })
        .eq('workspace_id', row.workspace_id)
      if ((count ?? 0) > 1) {
        const ws = Array.isArray(row.workspaces) ? row.workspaces[0] : row.workspaces
        return {
          error: `You own "${ws?.name}" with other members. Transfer ownership or delete the workspace first.`,
          blockingWorkspaceSlug: ws?.slug,
        }
      }
    }
  }

  const adminClient = createAdmin(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { error } = await adminClient.auth.admin.deleteUser(data.user.id)
  if (error) return { error: error.message }

  await supabase.auth.signOut()
  redirect('/')
}
