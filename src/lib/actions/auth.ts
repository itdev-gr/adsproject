'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { env } from '@/lib/env'
import { acceptInvitation } from '@/lib/actions/workspaces'

const signUpSchema = z.object({
  email: z.string().email(),
  password: z
    .string()
    .min(8)
    .regex(/[A-Za-z]/)
    .regex(/[0-9]/),
})

export async function signUp(formData: FormData) {
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: 'Please enter a valid email and password (8+ chars, letters + digits).' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
  })
  if (error) return { error: error.message }

  const { error: signInError } = await supabase.auth.signInWithPassword(parsed.data)
  if (signInError) return { error: signInError.message }

  const inviteToken = (formData.get('invite_token') as string | null)?.trim() || null
  if (inviteToken) {
    const result = await acceptInvitation(inviteToken)
    if ('slug' in result && result.slug) {
      redirect(`/app/w/${result.slug}/dashboard`)
    }
    // If acceptance failed (e.g. wrong email), fall through to onboarding so the user has somewhere to land.
  }

  redirect('/onboarding')
}

const logInSchema = z.object({ email: z.string().email(), password: z.string().min(1) })

export async function logIn(formData: FormData, redirectTo = '/app/dashboard') {
  const parsed = logInSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: 'Invalid email or password.' }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)
  if (error) return { error: 'Invalid email or password.' }

  const inviteToken = (formData.get('invite_token') as string | null)?.trim() || null
  if (inviteToken) {
    const result = await acceptInvitation(inviteToken)
    if ('slug' in result && result.slug) {
      redirect(`/app/w/${result.slug}/dashboard`)
    }
  }

  redirect(redirectTo)
}

export async function logOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/')
}

const forgotSchema = z.object({ email: z.string().email() })

export async function requestPasswordReset(formData: FormData) {
  const parsed = forgotSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { ok: true } // generic, don't leak

  const supabase = await createClient()
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${env.NEXT_PUBLIC_SITE_URL}/reset-password`,
  })
  return { ok: true }
}

const resetSchema = z.object({
  password: z
    .string()
    .min(8)
    .regex(/[A-Za-z]/)
    .regex(/[0-9]/),
})

export async function resetPassword(formData: FormData) {
  const parsed = resetSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: 'Password must be 8+ chars with letters and digits.' }

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password })
  if (error) return { error: error.message }

  redirect('/app/dashboard')
}
