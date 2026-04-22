import { ThemeToggle } from '@/components/shared/theme-toggle'
import { UserMenu } from './user-menu'

export function AppHeader({
  email,
  displayName,
  avatarUrl,
  workspaceName,
}: {
  email: string
  displayName: string | null
  avatarUrl: string | null
  workspaceName: string
}) {
  return (
    <header className="bg-card flex h-14 items-center justify-between border-b px-6">
      <p className="text-sm font-medium">{workspaceName}</p>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <UserMenu email={email} displayName={displayName} avatarUrl={avatarUrl} />
      </div>
    </header>
  )
}
