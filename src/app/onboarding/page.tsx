import { AuthCard } from '@/components/auth/auth-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createInitialWorkspace } from '@/lib/actions/onboarding'

export default function OnboardingPage() {
  const action = async (formData: FormData) => {
    'use server'
    await createInitialWorkspace(formData)
  }
  return (
    <AuthCard title="Name your workspace" description="You can rename it any time in Settings.">
      <form action={action} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Workspace name</Label>
          <Input
            id="name"
            name="name"
            type="text"
            required
            maxLength={60}
            placeholder="Acme Co"
            autoFocus
          />
        </div>
        <Button type="submit" className="w-full">
          Continue
        </Button>
      </form>
    </AuthCard>
  )
}
