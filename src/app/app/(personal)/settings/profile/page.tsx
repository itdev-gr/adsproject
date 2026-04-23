import { AvatarUpload } from '@/components/app/avatar-upload'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { updateProfile } from '@/lib/actions/profile'
import { createClient } from '@/lib/supabase/server'

export default async function ProfileSettingsPage() {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  const user = userData.user!
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, avatar_url')
    .eq('id', user.id)
    .single()

  const fallback = (profile?.display_name || user.email || '?').charAt(0).toUpperCase()

  const action = async (formData: FormData) => {
    'use server'
    await updateProfile(formData)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <AvatarUpload
          userId={user.id}
          initialUrl={profile?.avatar_url ?? null}
          fallback={fallback}
        />
        <Separator />
        <form action={action} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="display_name">Display name</Label>
            <Input
              id="display_name"
              name="display_name"
              defaultValue={profile?.display_name ?? ''}
              maxLength={80}
            />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={user.email ?? ''} disabled />
          </div>
          <Button type="submit">Save changes</Button>
        </form>
      </CardContent>
    </Card>
  )
}
