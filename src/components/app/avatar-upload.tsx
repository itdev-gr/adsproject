'use client'

import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'

export function AvatarUpload({
  userId,
  initialUrl,
  fallback,
}: {
  userId: string
  initialUrl: string | null
  fallback: string
}) {
  const [url, setUrl] = useState(initialUrl)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const onFile = async (file: File) => {
    setBusy(true)
    const ext = file.name.split('.').pop() || 'png'
    const path = `${userId}/avatar.${ext}`
    const { error } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true, contentType: file.type })
    if (error) {
      toast.error(error.message)
      setBusy(false)
      return
    }
    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    const newUrl = `${data.publicUrl}?t=${Date.now()}`
    await supabase.from('profiles').update({ avatar_url: newUrl }).eq('id', userId)
    setUrl(newUrl)
    setBusy(false)
    toast.success('Avatar updated')
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar className="size-16">
        {url && <AvatarImage src={url} alt="" />}
        <AvatarFallback>{fallback}</AvatarFallback>
      </Avatar>
      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? 'Uploading…' : 'Upload new image'}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) onFile(f)
          }}
        />
        <p className="text-muted-foreground mt-1 text-xs">PNG, JPG, or WEBP. Max 2 MB.</p>
      </div>
    </div>
  )
}
