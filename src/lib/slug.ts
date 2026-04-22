export function slugify(input: string): string {
  const normalised = input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
  return normalised || 'workspace'
}

export async function ensureUniqueSlug(
  base: string,
  isTaken: (slug: string) => Promise<boolean>,
): Promise<string> {
  if (!(await isTaken(base))) return base
  for (let i = 2; i < 1000; i++) {
    const candidate = `${base}-${i}`
    if (!(await isTaken(candidate))) return candidate
  }
  throw new Error(`could not find a free slug for base "${base}"`)
}
