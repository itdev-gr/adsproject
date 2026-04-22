import Link from 'next/link'

const TABS = [
  { href: '/app/settings/profile', label: 'Profile' },
  { href: '/app/settings/workspace', label: 'Workspace' },
  { href: '/app/settings/account', label: 'Account' },
] as const

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <div className="flex gap-1 border-b">
        {TABS.map((t) => (
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
