import { describe, expect, it } from 'vitest'

const PROTECTED_PREFIXES = ['/app', '/onboarding']
const PUBLIC_AUTH_PATHS = ['/sign-up', '/log-in', '/forgot-password', '/reset-password']

function isProtected(pathname: string) {
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

function isAuthPage(pathname: string) {
  return PUBLIC_AUTH_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

describe('proxy path matching', () => {
  describe('isProtected', () => {
    it('protects /app exactly', () => expect(isProtected('/app')).toBe(true))
    it('protects /app/dashboard', () => expect(isProtected('/app/dashboard')).toBe(true))
    it('protects /app/settings/profile (deep)', () =>
      expect(isProtected('/app/settings/profile')).toBe(true))
    it('protects /onboarding exactly', () => expect(isProtected('/onboarding')).toBe(true))
    it('does not protect / (landing)', () => expect(isProtected('/')).toBe(false))
    it('does not protect /pricing', () => expect(isProtected('/pricing')).toBe(false))
    it('does not protect /api/health', () => expect(isProtected('/api/health')).toBe(false))
    it('does not protect /apparel (avoids /app prefix bug)', () =>
      expect(isProtected('/apparel')).toBe(false))
  })

  describe('isAuthPage', () => {
    it('matches /sign-up', () => expect(isAuthPage('/sign-up')).toBe(true))
    it('matches /log-in', () => expect(isAuthPage('/log-in')).toBe(true))
    it('matches /forgot-password', () => expect(isAuthPage('/forgot-password')).toBe(true))
    it('matches /reset-password', () => expect(isAuthPage('/reset-password')).toBe(true))
    it('does not match /sign-up-something (false positive guard)', () =>
      expect(isAuthPage('/sign-up-something')).toBe(false))
    it('does not match / (landing)', () => expect(isAuthPage('/')).toBe(false))
  })
})
