import Link from 'next/link'
import { Button } from '@/components/ui/button'

export function FeaturePageHero({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string
  title: string
  body: string
}) {
  return (
    <section className="mx-auto max-w-4xl px-6 pt-16 pb-12 text-center">
      <p className="text-primary text-sm font-semibold tracking-wider uppercase">{eyebrow}</p>
      <h1 className="mt-2 text-4xl font-bold tracking-tight text-balance md:text-5xl">{title}</h1>
      <p className="text-muted-foreground mx-auto mt-6 max-w-2xl text-lg">{body}</p>
      <div className="mt-8">
        <Button size="lg" render={<Link href="/sign-up" />}>
          Start free
        </Button>
      </div>
    </section>
  )
}
