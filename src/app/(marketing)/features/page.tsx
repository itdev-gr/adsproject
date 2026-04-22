import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const FEATURES = [
  {
    href: '/features/google-ads',
    title: 'Google Ads',
    body: 'Manage Search, Display, and Performance Max campaigns.',
  },
  {
    href: '/features/meta-ads',
    title: 'Meta Ads',
    body: 'Manage Facebook and Instagram campaigns from one place.',
  },
  {
    href: '/features/automation',
    title: 'Automation',
    body: 'Set up rules that pause, resume, and rebudget automatically.',
  },
] as const

export const metadata = { title: 'Features — autoads' }

export default function FeaturesPage() {
  return (
    <>
      <section className="mx-auto max-w-2xl px-6 pt-16 pb-12 text-center">
        <h1 className="text-4xl font-bold">Features</h1>
        <p className="text-muted-foreground mt-3">Everything you need to run paid campaigns.</p>
      </section>
      <div className="mx-auto grid max-w-5xl gap-6 px-6 md:grid-cols-3">
        {FEATURES.map((f) => (
          <Link key={f.href} href={f.href}>
            <Card className="hover:border-primary h-full transition-colors">
              <CardHeader>
                <CardTitle>{f.title}</CardTitle>
                <CardDescription>{f.body}</CardDescription>
              </CardHeader>
              <CardContent>
                <span className="text-primary text-sm font-medium">Learn more →</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </>
  )
}
