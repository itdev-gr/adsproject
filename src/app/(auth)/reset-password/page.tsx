import { AuthCard } from '@/components/auth/auth-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { resetPassword } from '@/lib/actions/auth'

export default function ResetPasswordPage() {
  const action = async (formData: FormData) => {
    'use server'
    await resetPassword(formData)
  }
  return (
    <AuthCard title="Choose a new password">
      <form action={action} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password">New password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
          />
          <p className="text-muted-foreground text-xs">8+ characters, with letters and digits.</p>
        </div>
        <Button type="submit" className="w-full">
          Update password
        </Button>
      </form>
    </AuthCard>
  )
}
