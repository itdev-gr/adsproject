import { Plug } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { StatCard } from '@/components/shared/stat-card'
import { EmptyState } from '@/components/shared/empty-state'
import { TrackDashboardView } from '@/components/app/track-dashboard-view'

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <TrackDashboardView />
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
        action={<Button render={<Link href="/app/connections" />}>Connect an account</Button>}
      />
    </div>
  )
}
