import { Megaphone } from 'lucide-react'
import { EmptyState } from '@/components/shared/empty-state'

export default function CampaignsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Campaigns</h1>
      <EmptyState
        icon={Megaphone}
        title="No campaigns yet"
        description="Once you connect an ad account, your campaigns will appear here."
      />
    </div>
  )
}
