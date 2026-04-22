import { describe, expect, it } from 'vitest'
import { slugify, ensureUniqueSlug } from '@/lib/slug'

describe('slugify', () => {
  it('lowercases', () => expect(slugify('Acme Co')).toBe('acme-co'))
  it('removes special chars', () => expect(slugify('Acme & Co.!')).toBe('acme-co'))
  it('collapses whitespace', () => expect(slugify('  Acme   Co  ')).toBe('acme-co'))
  it('handles unicode', () => expect(slugify('Café Münchën')).toBe('cafe-munchen'))
  it('returns "workspace" for empty input', () => expect(slugify('')).toBe('workspace'))
  it('strips leading/trailing hyphens', () => expect(slugify('-acme-')).toBe('acme'))
  it('returns "workspace" for hyphens-only input', () => expect(slugify('---')).toBe('workspace'))
  it('returns "workspace" for special-chars-only input', () =>
    expect(slugify('!!!')).toBe('workspace'))
  it('strips leading/trailing hyphens after collapse', () =>
    expect(slugify('---abc---')).toBe('abc'))
})

describe('ensureUniqueSlug', () => {
  it('returns base when not taken', async () => {
    const taken = new Set<string>()
    expect(await ensureUniqueSlug('acme-co', async (s) => taken.has(s))).toBe('acme-co')
  })
  it('appends -2 when base taken', async () => {
    const taken = new Set(['acme-co'])
    expect(await ensureUniqueSlug('acme-co', async (s) => taken.has(s))).toBe('acme-co-2')
  })
  it('finds next free suffix', async () => {
    const taken = new Set(['acme-co', 'acme-co-2', 'acme-co-3'])
    expect(await ensureUniqueSlug('acme-co', async (s) => taken.has(s))).toBe('acme-co-4')
  })
})
