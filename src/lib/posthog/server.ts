import { PostHog } from 'posthog-node'
import { env } from '@/lib/env'

let client: PostHog | null = null
export function getServerPosthog() {
  if (!env.NEXT_PUBLIC_POSTHOG_KEY) return null
  if (!client) {
    client = new PostHog(env.NEXT_PUBLIC_POSTHOG_KEY, {
      host: env.NEXT_PUBLIC_POSTHOG_HOST,
      flushAt: 1,
      flushInterval: 0,
    })
  }
  return client
}

export async function captureServer(
  distinctId: string,
  event: string,
  props?: Record<string, unknown>,
) {
  const ph = getServerPosthog()
  if (!ph) return
  ph.capture({ distinctId, event, properties: props })
  await ph.shutdown()
}
