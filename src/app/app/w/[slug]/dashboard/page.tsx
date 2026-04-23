import { Plug } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { StatCard } from '@/components/shared/stat-card'
import { EmptyState } from '@/components/shared/empty-state'

export default async function DashboardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-muted-foreground text-sm">Overview · Last 7 days</p>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Spend" value="—" />
        <StatCard label="Clicks" value="—" />
        <StatCard label="Conversions" value="—" />
        <StatCard label="ROAS" value="—" />
      </div>
      <EmptyState
        icon={Plug}
        title="No connected accounts yet"
        description="Connect your Google Ads or Meta Ads account to see live performance data here."
        action={
          <Button render={<Link href={`/app/w/${slug}/connections`} />}>Connect an account</Button>
        }
      />
    </div>
  )
}
