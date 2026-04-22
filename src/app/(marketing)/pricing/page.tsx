import { PricingTierCards } from '@/components/marketing/pricing-tier-cards'

export const metadata = { title: 'Pricing — autoads' }

export default function PricingPage() {
  return (
    <>
      <section className="mx-auto max-w-2xl px-6 pt-16 pb-12 text-center">
        <h1 className="text-4xl font-bold">Simple pricing</h1>
        <p className="text-muted-foreground mt-3">Start free. Upgrade when you need more.</p>
      </section>
      <PricingTierCards />
    </>
  )
}
