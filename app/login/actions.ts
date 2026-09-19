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

  // The Origin header is the right source when it's present (works
  // correctly for local dev), but it isn't guaranteed on every request
  // path in production — when it's missing, falling through to a
  // hardcoded localhost URL is exactly the bug that sent a real magic
  // link to http://localhost:3000. VERCEL_PROJECT_PRODUCTION_URL is set
  // automatically by Vercel on every deployment and always reflects the
  // real production domain (even if a custom domain is added later), so
  // it's a safety net that never needs manual upkeep.
  const origin =
    (await headers()).get('origin') ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : undefined) ??
    'http://localhost:3001'

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
