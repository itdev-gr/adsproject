import { Plug, BarChart3, Cog, Megaphone } from 'lucide-react'

const FEATURES = [
  {
    icon: Plug,
    title: 'Unified connections',
    body: 'OAuth into Google Ads and Meta Ads. We handle the token plumbing.',
  },
  {
    icon: BarChart3,
    title: 'One dashboard',
    body: 'Spend, ROAS, conversions across both platforms with daily granularity.',
  },
  {
    icon: Megaphone,
    title: 'Create ads in-app',
    body: 'Launch a Google Search or Meta single-image ad without context-switching.',
  },
  {
    icon: Cog,
    title: 'Automation rules',
    body: 'Pause underperformers and reallocate budget automatically.',
  },
] as const

export function FeatureGrid() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-16">
      <div className="mb-12 text-center">
        <h2 className="text-3xl font-bold">Everything you need, nothing you don&apos;t</h2>
      </div>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map(({ icon: Icon, title, body }) => (
          <div key={title} className="rounded-lg border p-6">
            <Icon className="text-primary h-8 w-8" />
            <h3 className="mt-4 text-lg font-semibold">{title}</h3>
            <p className="text-muted-foreground mt-2 text-sm">{body}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
