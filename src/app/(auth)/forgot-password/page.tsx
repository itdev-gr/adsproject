import { AuthCard } from '@/components/auth/auth-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { requestPasswordReset } from '@/lib/actions/auth'

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string }>
}) {
  const params = await searchParams
  const sent = params.sent === '1'
  const action = async (formData: FormData) => {
    'use server'
    await requestPasswordReset(formData)
  }
  return (
    <AuthCard
      title="Reset your password"
      description="Enter the email associated with your account."
    >
      <form action={action} className="space-y-4">
        {sent && (
          <Alert>
            <AlertDescription>
              If an account exists for that email, we&apos;ve sent a reset link.
            </AlertDescription>
          </Alert>
        )}
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <Button type="submit" className="w-full">
          Send reset link
        </Button>
      </form>
    </AuthCard>
  )
}
