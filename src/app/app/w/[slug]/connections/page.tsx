import { Plug } from 'lucide-react'
import { EmptyState } from '@/components/shared/empty-state'

export default function ConnectionsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Connections</h1>
      <EmptyState
        icon={Plug}
        title="No accounts connected"
        description="Google Ads and Meta Ads connections will be available in the next release."
      />
    </div>
  )
}
