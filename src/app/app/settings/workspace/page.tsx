import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { updateWorkspace } from '@/lib/actions/workspace'
import { createClient } from '@/lib/supabase/server'

export default async function WorkspaceSettingsPage() {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('name, slug')
    .eq('owner_id', userData.user!.id)
    .single()

  const action = async (formData: FormData) => {
    'use server'
    await updateWorkspace(formData)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Workspace</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Workspace name</Label>
            <Input
              id="name"
              name="name"
              defaultValue={workspace?.name ?? ''}
              maxLength={60}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Slug</Label>
            <Input value={workspace?.slug ?? ''} disabled />
            <p className="text-muted-foreground text-xs">
              Slug is generated from the name and cannot be changed in v1.
            </p>
          </div>
          <Button type="submit">Save changes</Button>
        </form>
      </CardContent>
    </Card>
  )
}
