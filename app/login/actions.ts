'use server'

import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

export type LoginState = { error?: string; sent?: boolean }

/**
 * Magic-link sign-in. No passwords to store, hash, reset or leak.
 * Server Actions are reachable by direct POST, so validate inside the action.
 */
export async function sendMagicLink(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = String(formData.get('email') ?? '').trim()

  if (!email || !email.includes('@')) {
    return { error: 'Enter a valid email address.' }
  }

  const origin =
    (await headers()).get('origin') ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    'http://localhost:3000'

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/confirm` },
  })

  if (error) return { error: error.message }
  return { sent: true }
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
}
