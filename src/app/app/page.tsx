import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function AppIndex() {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) redirect('/log-in')

  const { data: rows } = await supabase
    .from('workspace_members')
    .select('joined_at, workspaces!inner(slug)')
    .eq('user_id', userData.user.id)
    .order('joined_at', { ascending: false })

  const slugs = (rows ?? [])
    .map((r) => (Array.isArray(r.workspaces) ? r.workspaces[0]?.slug : r.workspaces?.slug))
    .filter((s): s is string => Boolean(s))

  if (slugs.length === 0) redirect('/onboarding')

  const cookieSlug = (await cookies()).get('recent_workspace_slug')?.value
  const target = cookieSlug && slugs.includes(cookieSlug) ? cookieSlug : slugs[0]

  redirect(`/app/w/${target}/dashboard`)
}
