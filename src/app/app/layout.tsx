import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppSidebar } from '@/components/app/app-sidebar'
import { AppHeader } from '@/components/app/app-header'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) redirect('/log-in')

  const [{ data: profile }, { data: workspace }] = await Promise.all([
    supabase
      .from('profiles')
      .select('display_name, avatar_url')
      .eq('id', userData.user.id)
      .single(),
    supabase.from('workspaces').select('name').eq('owner_id', userData.user.id).single(),
  ])
  if (!workspace) redirect('/onboarding')

  return (
    <div className="flex h-dvh">
      <AppSidebar workspaceName={workspace.name} />
      <div className="flex flex-1 flex-col">
        <AppHeader
          email={userData.user.email ?? ''}
          displayName={profile?.display_name ?? null}
          avatarUrl={profile?.avatar_url ?? null}
          workspaceName={workspace.name}
        />
        <main className="bg-muted/20 flex-1 overflow-auto p-8">{children}</main>
      </div>
    </div>
  )
}
