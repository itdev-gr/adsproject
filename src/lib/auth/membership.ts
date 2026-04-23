import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type WorkspaceRole = 'owner' | 'admin' | 'member'

export interface Membership {
  role: WorkspaceRole
  workspaceId: string
  workspaceName: string
}

/**
 * Returns the caller's membership in the workspace identified by `slug`,
 * or null if not authenticated or not a member.
 */
export async function getMembership(slug: string): Promise<Membership | null> {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) return null

  const { data, error } = await supabase
    .from('workspaces')
    .select('id, name, workspace_members!inner(role)')
    .eq('slug', slug)
    .eq('workspace_members.user_id', userData.user.id)
    .maybeSingle()

  if (error || !data) return null
  const memberRow = Array.isArray(data.workspace_members)
    ? data.workspace_members[0]
    : data.workspace_members
  if (!memberRow) return null
  return {
    role: memberRow.role as WorkspaceRole,
    workspaceId: data.id,
    workspaceName: data.name,
  }
}

/** Throws redirect to /app if not a member of `slug`. */
export async function requireMember(slug: string): Promise<Membership> {
  const m = await getMembership(slug)
  if (!m) redirect('/app')
  return m
}

/** Throws redirect to /app/w/<slug>/dashboard if role not in `allowed`. */
export async function requireRole(slug: string, allowed: WorkspaceRole[]): Promise<Membership> {
  const m = await requireMember(slug)
  if (!allowed.includes(m.role)) redirect(`/app/w/${slug}/dashboard`)
  return m
}
