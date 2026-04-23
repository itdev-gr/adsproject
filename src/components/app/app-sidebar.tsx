'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Megaphone, Plug, Cog, BarChart3, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Logo } from '@/components/shared/logo'

export function AppSidebar({
  workspaceSlug,
  workspaceName,
}: {
  workspaceSlug: string
  workspaceName: string
}) {
  const pathname = usePathname()
  const NAV = [
    { href: `/app/w/${workspaceSlug}/dashboard`, label: 'Dashboard', icon: LayoutDashboard },
    { href: `/app/w/${workspaceSlug}/campaigns`, label: 'Campaigns', icon: Megaphone },
    { href: `/app/w/${workspaceSlug}/connections`, label: 'Connections', icon: Plug },
    { href: `/app/w/${workspaceSlug}/automation`, label: 'Automation', icon: Cog },
    { href: `/app/w/${workspaceSlug}/reports`, label: 'Reports', icon: BarChart3 },
    { href: `/app/w/${workspaceSlug}/settings/general`, label: 'Settings', icon: Settings },
  ]
  return (
    <aside className="bg-card flex h-full w-60 shrink-0 flex-col border-r">
      <div className="px-5 py-4">
        <Logo href={`/app/w/${workspaceSlug}/dashboard`} />
        <p className="text-muted-foreground mt-1 text-xs">{workspaceName}</p>
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                active
                  ? 'bg-muted text-foreground font-medium'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
