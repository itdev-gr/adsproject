import Link from 'next/link'
import { Button } from '@/components/ui/button'

export function Hero() {
  return (
    <section className="mx-auto max-w-4xl px-6 pt-20 pb-16 text-center">
      <h1 className="text-4xl font-bold tracking-tight text-balance md:text-6xl">
        Smarter ad campaigns, <span className="text-primary">less manual work.</span>
      </h1>
      <p className="text-muted-foreground mx-auto mt-6 max-w-2xl text-lg">
        Connect Google Ads and Meta Ads in 60 seconds. Get unified reporting, automate the busywork,
        and ship better campaigns faster.
      </p>
      <div className="mt-8 flex justify-center gap-3">
        <Button size="lg" render={<Link href="/sign-up" />}>
          Get started free
        </Button>
        <Button size="lg" variant="outline" render={<Link href="/features" />}>
          See features
        </Button>
      </div>
    </section>
  )
}
