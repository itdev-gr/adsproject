import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { deleteAccount } from '@/lib/actions/account'
import { logOut } from '@/lib/actions/auth'

export default function AccountSettingsPage() {
  const signOutAction = async () => {
    'use server'
    await logOut()
  }

  const deleteAccountAction = async () => {
    'use server'
    await deleteAccount()
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Sign out</CardTitle>
          <CardDescription>Sign out of this device.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={signOutAction}>
            <Button type="submit" variant="outline">
              Sign out
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive">Delete account</CardTitle>
          <CardDescription>
            Permanently delete your account, profile, workspace, and all associated data. This
            cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={deleteAccountAction}>
            <Button type="submit" variant="destructive">
              Delete my account
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
