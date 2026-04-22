import Link from 'next/link'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

type Tier = {
  name: string
  blurb: string
  price: string
  cta: string
  features: readonly string[]
  highlighted?: boolean
}

const TIERS: readonly Tier[] = [
  {
    name: 'Free',
    blurb: 'For getting started.',
    price: 'Free',
    cta: 'Start free',
    features: ['1 workspace', '1 connected account', 'Read-only dashboard', 'Community support'],
  },
  {
    name: 'Pro',
    blurb: 'For growing teams.',
    price: 'Pricing announced soon',
    cta: 'Notify me',
    features: ['Up to 10 workspaces', '10 connected accounts', 'Ad creation', 'Email support'],
    highlighted: true,
  },
  {
    name: 'Business',
    blurb: 'For agencies and at-scale teams.',
    price: 'Pricing announced soon',
    cta: 'Notify me',
    features: [
      'Unlimited workspaces',
      'Unlimited connected accounts',
      'Automation rules',
      'Priority support',
    ],
  },
]

export function PricingTierCards() {
  return (
    <div className="mx-auto grid max-w-5xl gap-6 px-6 md:grid-cols-3">
      {TIERS.map((t) => (
        <Card key={t.name} className={t.highlighted ? 'border-primary' : undefined}>
          <CardHeader>
            <CardTitle>{t.name}</CardTitle>
            <CardDescription>{t.blurb}</CardDescription>
            <p className="pt-4 text-2xl font-semibold">{t.price}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2">
              {t.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <Check className="text-primary mt-0.5 h-4 w-4" /> {f}
                </li>
              ))}
            </ul>
            <Button
              className="w-full"
              variant={t.highlighted ? 'default' : 'outline'}
              render={<Link href="/sign-up" />}
            >
              {t.cta}
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
