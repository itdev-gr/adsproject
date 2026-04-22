import { test, expect } from '@playwright/test'

const PUBLIC_PATHS = [
  '/',
  '/pricing',
  '/faq',
  '/features',
  '/features/google-ads',
  '/features/meta-ads',
  '/features/automation',
  '/blog',
  '/legal/privacy',
  '/legal/terms',
]

test('marketing pages render with no console errors', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`${msg.location().url}: ${msg.text()}`)
  })

  for (const path of PUBLIC_PATHS) {
    const response = await page.goto(path)
    expect(response?.status(), `status for ${path}`).toBeLessThan(400)
    await expect(page).toHaveTitle(/autoads/i)
  }

  expect(errors, 'console errors during marketing tour').toEqual([])
})
