'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { env } from '@/lib/env'
import { ensureUniqueSlug, slugify } from '@/lib/slug'
import { requireRole, requireMember } from '@/lib/auth/membership'

const RECENT_COOKIE = 'recent_workspace_slug'
const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 60 * 60 * 24 * 30, // 30 days
  path: '/',
}

function admin() {
  return createAdmin(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

function makeUrlSafeToken(token: string) {
  return token.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function fromUrlSafeToken(urlSafe: string) {
  // Reverse of makeUrlSafeToken — produces the canonical base64 form stored in DB.
  // 24-byte payloads produce 32-char base64 with no `=` padding, so we don't re-add any.
  return urlSafe.replace(/-/g, '+').replace(/_/g, '/')
}

// ────────────── createWorkspace ──────────────

const createSchema = z.object({ name: z.string().min(1).max(60) })

export async function createWorkspace(formData: FormData) {
  const parsed = createSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: 'Workspace name is required (max 60 chars).' }

  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) return { error: 'Not authenticated.' }

  const base = slugify(parsed.data.name)
  const slug = await ensureUniqueSlug(base, async (s) => {
    const { count } = await supabase
      .from('workspaces')
      .select('id', { count: 'exact', head: true })
      .eq('slug', s)
    return (count ?? 0) > 0
  })

  const { error } = await supabase
    .from('workspaces')
    .insert({ name: parsed.data.name, slug, owner_id: userData.user.id })
  if (error) return { error: error.message }
  ;(await cookies()).set(RECENT_COOKIE, slug, COOKIE_OPTS)
  redirect(`/app/w/${slug}/dashboard`)
}

// ────────────── inviteMember ──────────────

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'member']),
})

export async function inviteMember(slug: string, formData: FormData) {
  const m = await requireRole(slug, ['owner', 'admin'])

  const parsed = inviteSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: 'Valid email and role required.' }

  const email = parsed.data.email.toLowerCase()
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('invitations')
    .select('id, token')
    .eq('workspace_id', m.workspaceId)
    .eq('email', email)
    .is('accepted_at', null)
    .maybeSingle()

  let invitationId: string
  let token: string

  if (existing) {
    invitationId = existing.id
    token = existing.token
  } else {
    const { data: inserted, error } = await supabase
      .from('invitations')
      .insert({
        workspace_id: m.workspaceId,
        email,
        role: parsed.data.role,
        invited_by: (await supabase.auth.getUser()).data.user!.id,
      })
      .select('id, token')
      .single()
    if (error || !inserted) return { error: error?.message ?? 'Failed to create invitation.' }
    invitationId = inserted.id
    token = inserted.token
  }

  const safeToken = makeUrlSafeToken(token)
  const link = `${env.NEXT_PUBLIC_SITE_URL}/invite/${safeToken}`

  // Best-effort email send via Supabase Auth admin
  try {
    await admin().auth.admin.inviteUserByEmail(email, { redirectTo: link })
  } catch {
    // Swallow — invitation row exists, link is returned for copy-paste
  }

  revalidatePath(`/app/w/${slug}/settings/members`)
  return { ok: true as const, invitationId, token: safeToken, link }
}

// ────────────── revokeInvitation ──────────────

export async function revokeInvitation(slug: string, invitationId: string) {
  await requireRole(slug, ['owner', 'admin'])
  const supabase = await createClient()
  const { error } = await supabase.from('invitations').delete().eq('id', invitationId)
  if (error) return { error: error.message }
  revalidatePath(`/app/w/${slug}/settings/members`)
  return { ok: true as const }
}

// ────────────── acceptInvitation ──────────────

export async function acceptInvitation(token: string) {
  if (!token) return { error: 'Missing token.' }

  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) return { error: 'Not authenticated.' }

  // Service-role lookup so we can read invites for any workspace.
  // Token comes in URL-safe form; reverse to the canonical base64 we store.
  const dbToken = fromUrlSafeToken(token)
  const { data: invite, error: lookupErr } = await admin()
    .from('invitations')
    .select('id, workspace_id, email, role, expires_at, accepted_at, workspaces(slug, name)')
    .eq('token', dbToken)
    .maybeSingle()
  if (lookupErr || !invite) return { error: 'Invitation not found.' }
  if (invite.accepted_at) return { error: 'Invitation already accepted.' }
  if (new Date(invite.expires_at).getTime() < Date.now()) return { error: 'Invitation expired.' }

  const callerEmail = (userData.user.email ?? '').toLowerCase()
  if (callerEmail !== invite.email.toLowerCase()) {
    return {
      error: `This invitation was sent to ${invite.email}. Sign in with that account to accept.`,
    }
  }

  // Insert membership via service role (no client INSERT policy on workspace_members)
  const { error: memberErr } = await admin().from('workspace_members').insert({
    workspace_id: invite.workspace_id,
    user_id: userData.user.id,
    role: invite.role,
  })
  if (memberErr) return { error: memberErr.message }

  await admin()
    .from('invitations')
    .update({ accepted_at: new Date().toISOString() })
    .eq('id', invite.id)

  const ws = Array.isArray(invite.workspaces) ? invite.workspaces[0] : invite.workspaces
  if (!ws) return { error: 'Workspace not found.' }
  ;(await cookies()).set(RECENT_COOKIE, ws.slug, COOKIE_OPTS)
  return { ok: true as const, slug: ws.slug }
}

// ────────────── declineInvitation ──────────────

export async function declineInvitation(invitationId: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('invitations').delete().eq('id', invitationId)
  // RLS allows the invitee to delete their own pending invite.
  if (error) return { error: error.message }
  revalidatePath('/app/invitations')
  return { ok: true as const }
}

// ────────────── removeMember ──────────────

export async function removeMember(slug: string, userId: string) {
  const m = await requireRole(slug, ['owner', 'admin'])
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (userId === userData.user!.id && m.role === 'owner') {
    return { error: 'Owners cannot remove themselves. Transfer ownership first.' }
  }
  const { error } = await supabase
    .from('workspace_members')
    .delete()
    .eq('workspace_id', m.workspaceId)
    .eq('user_id', userId)
  if (error) return { error: error.message }
  revalidatePath(`/app/w/${slug}/settings/members`)
  return { ok: true as const }
}

// ────────────── leaveWorkspace ──────────────

export async function leaveWorkspace(slug: string) {
  const m = await requireMember(slug)
  if (m.role === 'owner') {
    return { error: 'Owners cannot leave. Transfer ownership or delete the workspace.' }
  }

  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  const { error } = await supabase
    .from('workspace_members')
    .delete()
    .eq('workspace_id', m.workspaceId)
    .eq('user_id', userData.user!.id)
  if (error) return { error: error.message }
  redirect('/app')
}

// ────────────── changeMemberRole ──────────────

const roleSchema = z.enum(['admin', 'member'])

export async function changeMemberRole(slug: string, userId: string, newRole: 'admin' | 'member') {
  const parsed = roleSchema.safeParse(newRole)
  if (!parsed.success) return { error: 'Invalid role.' }
  const m = await requireRole(slug, ['owner', 'admin'])

  const supabase = await createClient()
  const { error } = await supabase
    .from('workspace_members')
    .update({ role: parsed.data })
    .eq('workspace_id', m.workspaceId)
    .eq('user_id', userId)
  if (error) return { error: error.message }
  revalidatePath(`/app/w/${slug}/settings/members`)
  return { ok: true as const }
}

// ────────────── transferOwnership ──────────────

export async function transferOwnership(slug: string, newOwnerUserId: string) {
  const m = await requireRole(slug, ['owner'])

  const supabase = await createClient()
  // Update target's role to 'owner' — DB trigger atomically demotes current owner + updates owner_id
  const { error } = await supabase
    .from('workspace_members')
    .update({ role: 'owner' })
    .eq('workspace_id', m.workspaceId)
    .eq('user_id', newOwnerUserId)
  if (error) return { error: error.message }
  revalidatePath(`/app/w/${slug}/settings/members`)
  revalidatePath(`/app/w/${slug}/settings/danger`)
  return { ok: true as const }
}

// ────────────── deleteWorkspace ──────────────

export async function deleteWorkspace(slug: string) {
  const m = await requireRole(slug, ['owner'])
  const supabase = await createClient()
  const { error } = await supabase.from('workspaces').delete().eq('id', m.workspaceId)
  if (error) return { error: error.message }
  ;(await cookies()).delete(RECENT_COOKIE)
  redirect('/app')
}
