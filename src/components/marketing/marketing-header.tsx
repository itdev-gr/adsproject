import Link from 'next/link'
import { Logo } from '@/components/shared/logo'
import { Button } from '@/components/ui/button'

const NAV = [
  { href: '/features', label: 'Features' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/faq', label: 'FAQ' },
  { href: '/blog', label: 'Blog' },
] as const

export function MarketingHeader() {
  return (
    <header className="bg-background/80 sticky top-0 z-40 border-b backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <div className="flex items-center gap-8">
          <Logo />
          <nav className="text-muted-foreground hidden gap-6 text-sm md:flex">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="hover:text-foreground">
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" render={<Link href="/log-in" />}>
            Log in
          </Button>
          <Button size="sm" render={<Link href="/sign-up" />}>
            Sign up
          </Button>
        </div>
      </div>
    </header>
  )
}
