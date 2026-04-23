import Link from 'next/link'
import { AuthCard } from '@/components/auth/auth-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { signUp } from '@/lib/actions/auth'

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ invite_token?: string; email?: string }>
}) {
  const sp = await searchParams
  const inviteToken = sp.invite_token ?? ''
  const prefilledEmail = sp.email ?? ''
  const action = async (formData: FormData) => {
    'use server'
    await signUp(formData)
  }
  return (
    <AuthCard
      title="Create your account"
      description="Start managing Google + Meta ads in one place."
      footer={
        <>
          Already have an account?{' '}
          <Link
            href="/log-in"
            className="text-foreground font-medium underline-offset-4 hover:underline"
          >
            Log in
          </Link>
        </>
      }
    >
      <form action={action} className="space-y-4">
        {inviteToken && <input type="hidden" name="invite_token" value={inviteToken} />}
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            defaultValue={prefilledEmail}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
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
          Create account
        </Button>
      </form>
    </AuthCard>
  )
}
