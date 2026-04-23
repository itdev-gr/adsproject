import { BarChart3 } from 'lucide-react'
import { EmptyState } from '@/components/shared/empty-state'

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Reports</h1>
      <EmptyState
        icon={BarChart3}
        title="No reports yet"
        description="Custom reporting will land in a future release."
      />
    </div>
  )
}
