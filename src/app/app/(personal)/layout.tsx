import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ThemeToggle } from '@/components/shared/theme-toggle'
import { UserMenu } from '@/components/app/user-menu'
import { WorkspaceSwitcher } from '@/components/app/workspace-switcher'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) redirect('/log-in')

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, avatar_url')
    .eq('id', userData.user.id)
    .single()

  // Fetch all workspaces the caller belongs to (for the switcher).
  const { data: rows } = await supabase
    .from('workspace_members')
    .select('workspaces!inner(id, name, slug)')
    .eq('user_id', userData.user.id)
  const workspaces = (rows ?? [])
    .map((r) => (Array.isArray(r.workspaces) ? r.workspaces[0] : r.workspaces))
    .filter((w): w is { id: string; name: string; slug: string } => Boolean(w))

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="bg-card flex h-14 items-center justify-between border-b px-6">
        <WorkspaceSwitcher workspaces={workspaces} activeSlug={null} />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <UserMenu
            email={userData.user.email ?? ''}
            displayName={profile?.display_name ?? null}
            avatarUrl={profile?.avatar_url ?? null}
          />
        </div>
      </header>
      <main className="bg-muted/20 flex-1 overflow-auto p-8">{children}</main>
    </div>
  )
}
