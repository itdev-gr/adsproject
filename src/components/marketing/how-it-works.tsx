const STEPS = [
  {
    n: '01',
    title: 'Sign up free',
    body: 'Create an account in 30 seconds. No credit card required.',
  },
  {
    n: '02',
    title: 'Connect your ad accounts',
    body: 'OAuth into Google Ads and Meta Ads. Read-only by default.',
  },
  {
    n: '03',
    title: 'Optimise and grow',
    body: 'Use the dashboard, run automation rules, create new ads in-app.',
  },
] as const

export function HowItWorks() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-16">
      <div className="mb-12 text-center">
        <h2 className="text-3xl font-bold">How it works</h2>
      </div>
      <div className="grid gap-8 md:grid-cols-3">
        {STEPS.map(({ n, title, body }) => (
          <div key={n}>
            <p className="text-primary text-sm font-semibold">{n}</p>
            <h3 className="mt-2 text-xl font-semibold">{title}</h3>
            <p className="text-muted-foreground mt-2">{body}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
