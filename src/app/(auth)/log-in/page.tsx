import Link from 'next/link'
import { AuthCard } from '@/components/auth/auth-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { logIn } from '@/lib/actions/auth'

export default async function LogInPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; invite_token?: string }>
}) {
  const { redirect, invite_token: inviteToken } = await searchParams
  const action = async (formData: FormData) => {
    'use server'
    await logIn(formData, redirect ?? '/app/dashboard')
  }
  return (
    <AuthCard
      title="Welcome back"
      footer={
        <>
          Don&apos;t have an account?{' '}
          <Link
            href="/sign-up"
            className="text-foreground font-medium underline-offset-4 hover:underline"
          >
            Sign up
          </Link>
        </>
      }
    >
      <form action={action} className="space-y-4">
        {inviteToken && <input type="hidden" name="invite_token" value={inviteToken} />}
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link href="/forgot-password" className="text-muted-foreground text-xs hover:underline">
              Forgot?
            </Link>
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>
        <Button type="submit" className="w-full">
          Log in
        </Button>
      </form>
    </AuthCard>
  )
}
