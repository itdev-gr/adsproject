import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

test('full happy path: sign up → onboard → dashboard → sign out', async ({ page }, testInfo) => {
  // Note: hosted Supabase rejects @example.com (in the disposable-email blocklist),
  // so we use a project-specific test domain.
  const email = `test-${Date.now()}@autoads-qa.dev`
  const password = 'Testing123'
  const workspaceName = `WS ${Date.now()}`
  let createdUserId: string | null = null

  // Sign up
  await page.goto('/sign-up')
  await page.fill('input[name="email"]', email)
  await page.fill('input[name="password"]', password)
  await Promise.all([page.waitForURL('**/onboarding'), page.click('button[type="submit"]')])

  // Onboard
  await page.fill('input[name="name"]', workspaceName)
  await Promise.all([page.waitForURL('**/app/dashboard'), page.click('button[type="submit"]')])

  // Dashboard
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  // Workspace name appears in both sidebar and header — assert at least one
  await expect(page.getByText(workspaceName).first()).toBeVisible()

  // Capture user id for cleanup before signing out
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: users } = await admin.auth.admin.listUsers()
  const u = users?.users.find((x) => x.email === email)
  createdUserId = u?.id ?? null
  expect(createdUserId, 'created user should be findable via admin').not.toBeNull()

  // Sign out via user menu
  await page.click('button[aria-label="Open user menu"]')
  await page.click('text=Sign out')
  await page.waitForURL((url) => url.pathname === '/')
  await expect(page.getByRole('link', { name: 'Sign up' })).toBeVisible()

  // Cleanup: delete the test user (cascades to profile + workspace)
  if (createdUserId) {
    await admin.auth.admin.deleteUser(createdUserId)
  }
  testInfo.attachments.push({
    name: 'test-email',
    body: Buffer.from(email),
    contentType: 'text/plain',
  })
})
