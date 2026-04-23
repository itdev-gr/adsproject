import { Cog } from 'lucide-react'
import { EmptyState } from '@/components/shared/empty-state'

export default function AutomationPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Automation</h1>
      <EmptyState
        icon={Cog}
        title="No rules yet"
        description="Define rules to automatically pause, resume, or change budgets based on performance."
      />
    </div>
  )
}
