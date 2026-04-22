import Link from 'next/link'
import { Logo } from '@/components/shared/logo'

export function MarketingFooter() {
  return (
    <footer className="mt-24 border-t">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-6 py-12 md:grid-cols-4">
        <div>
          <Logo />
          <p className="text-muted-foreground mt-2 text-sm">
            Manage Google + Meta Ads from one place.
          </p>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold">Product</h4>
          <ul className="text-muted-foreground space-y-2 text-sm">
            <li>
              <Link href="/features" className="hover:text-foreground">
                Features
              </Link>
            </li>
            <li>
              <Link href="/pricing" className="hover:text-foreground">
                Pricing
              </Link>
            </li>
            <li>
              <Link href="/faq" className="hover:text-foreground">
                FAQ
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold">Resources</h4>
          <ul className="text-muted-foreground space-y-2 text-sm">
            <li>
              <Link href="/blog" className="hover:text-foreground">
                Blog
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold">Legal</h4>
          <ul className="text-muted-foreground space-y-2 text-sm">
            <li>
              <Link href="/legal/privacy" className="hover:text-foreground">
                Privacy
              </Link>
            </li>
            <li>
              <Link href="/legal/terms" className="hover:text-foreground">
                Terms
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="text-muted-foreground border-t py-6 text-center text-xs">
        © {new Date().getFullYear()} autoads. All rights reserved.
      </div>
    </footer>
  )
}
