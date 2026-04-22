'use client'
import posthog from 'posthog-js'
import { env } from '@/lib/env'

let initialised = false
export function getPosthog() {
  if (typeof window === 'undefined') return null
  if (!env.NEXT_PUBLIC_POSTHOG_KEY) return null
  if (!initialised) {
    posthog.init(env.NEXT_PUBLIC_POSTHOG_KEY, {
      api_host: env.NEXT_PUBLIC_POSTHOG_HOST,
      capture_pageview: true,
      disable_session_recording: true,
    })
    initialised = true
  }
  return posthog
}
