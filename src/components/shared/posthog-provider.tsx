'use client'
import { useEffect } from 'react'
import { getPosthog } from '@/lib/posthog/client'

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    getPosthog()
  }, [])
  return <>{children}</>
}
