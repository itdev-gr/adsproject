import Link from 'next/link'
import { Button } from '@/components/ui/button'

export function CTASection() {
  return (
    <section className="bg-primary text-primary-foreground mx-auto my-16 max-w-3xl rounded-2xl px-8 py-16 text-center">
      <h2 className="text-3xl font-bold">Ready to consolidate your ad ops?</h2>
      <p className="text-primary-foreground/80 mx-auto mt-3 max-w-xl">
        Get started in under a minute. Free during beta.
      </p>
      <Button size="lg" variant="secondary" className="mt-6" render={<Link href="/sign-up" />}>
        Start free
      </Button>
    </section>
  )
}
