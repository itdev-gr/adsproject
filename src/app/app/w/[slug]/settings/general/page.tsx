import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/membership'
import { updateWorkspace } from '@/lib/actions/workspace'

export default async function WorkspaceGeneralSettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  await requireRole(slug, ['owner', 'admin'])

  const supabase = await createClient()
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('name, slug')
    .eq('slug', slug)
    .single()

  const action = async (formData: FormData) => {
    'use server'
    await updateWorkspace(slug, formData)
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
              Slug is generated from the name and cannot be changed.
            </p>
          </div>
          <Button type="submit">Save changes</Button>
        </form>
      </CardContent>
    </Card>
  )
}
