import Link from 'next/link'
import { requireMember } from '@/lib/auth/membership'

export default async function WorkspaceSettingsLayout({
  params,
  children,
}: {
  params: Promise<{ slug: string }>
  children: React.ReactNode
}) {
  const { slug } = await params
  const m = await requireMember(slug)

  const tabs = [
    { href: `/app/w/${slug}/settings/general`, label: 'General' },
    { href: `/app/w/${slug}/settings/members`, label: 'Members' },
    ...(m.role === 'owner'
      ? [{ href: `/app/w/${slug}/settings/danger`, label: 'Danger zone' }]
      : []),
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Workspace settings</h1>
      <div className="flex gap-1 border-b">
        {tabs.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="text-muted-foreground hover:border-muted-foreground/30 hover:text-foreground border-b-2 border-transparent px-3 py-2 text-sm"
          >
            {t.label}
          </Link>
        ))}
      </div>
      {children}
    </div>
  )
}
