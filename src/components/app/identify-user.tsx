'use client'
import { useEffect } from 'react'
import { getPosthog } from '@/lib/posthog/client'

export function IdentifyUser({ id, email }: { id: string; email: string }) {
  useEffect(() => {
    const ph = getPosthog()
    if (ph) ph.identify(id, { email })
  }, [id, email])
  return null
}
