'use client'
import { useEffect } from 'react'
import { getPosthog } from '@/lib/posthog/client'

export function TrackDashboardView() {
  useEffect(() => {
    getPosthog()?.capture('dashboard_viewed')
  }, [])
  return null
}
