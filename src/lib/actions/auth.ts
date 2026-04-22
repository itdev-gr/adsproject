'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { env } from '@/lib/env'
import { captureServer } from '@/lib/posthog/server'

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
  if (!parsed.success)
    return { error: 'Please enter a valid email and password (8+ chars, letters + digits).' }

  const supabase = await createClient()
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
  })
  if (error) return { error: error.message }

  // Auto-login (no email verification per design).
  const { error: signInError } = await supabase.auth.signInWithPassword(parsed.data)
  if (signInError) return { error: signInError.message }

  await captureServer(parsed.data.email, 'user_signed_up', {
    email_domain: parsed.data.email.split('@')[1],
    signup_method: 'password',
  })

  redirect('/onboarding')
}

const logInSchema = z.object({ email: z.string().email(), password: z.string().min(1) })

export async function logIn(formData: FormData, redirectTo = '/app/dashboard') {
  const parsed = logInSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: 'Invalid email or password.' }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)
  if (error) return { error: 'Invalid email or password.' }

  const { data } = await supabase.auth.getUser()
  if (data.user) {
    await captureServer(data.user.id, 'user_logged_in', {
      email_domain: parsed.data.email.split('@')[1],
    })
  }

  redirect(redirectTo)
}

export async function logOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  await captureServer('anonymous', 'user_logged_out')
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
  await captureServer(parsed.data.email, 'password_reset_requested')
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
