import { describe, expect, it } from 'vitest'
import { createEnv } from '@t3-oss/env-nextjs'
import { z } from 'zod'

describe('env schema (validation behaviour)', () => {
  it('throws when a required server var is missing', () => {
    expect(() =>
      createEnv({
        server: { REQUIRED_VAR: z.string().min(1) },
        runtimeEnv: { REQUIRED_VAR: undefined },
        emptyStringAsUndefined: true,
      }),
    ).toThrow()
  })

  it('throws when a URL var is malformed', () => {
    expect(() =>
      createEnv({
        client: { NEXT_PUBLIC_URL: z.string().url() },
        runtimeEnv: { NEXT_PUBLIC_URL: 'not-a-url' },
        emptyStringAsUndefined: true,
      }),
    ).toThrow()
  })

  it('coerces empty string to undefined for optional vars', () => {
    const env = createEnv({
      server: { OPTIONAL_VAR: z.string().optional() },
      runtimeEnv: { OPTIONAL_VAR: '' },
      emptyStringAsUndefined: true,
    })
    expect(env.OPTIONAL_VAR).toBeUndefined()
  })

  it('applies defaults for missing optional vars', () => {
    const env = createEnv({
      client: { NEXT_PUBLIC_HOST: z.string().url().default('https://example.com') },
      runtimeEnv: { NEXT_PUBLIC_HOST: undefined },
      emptyStringAsUndefined: true,
    })
    expect(env.NEXT_PUBLIC_HOST).toBe('https://example.com')
  })
})
