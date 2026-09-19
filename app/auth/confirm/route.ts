import type { EmailOtpType } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Lands here from the magic link and exchanges it for a session.
 *
 * Supabase's current default is the PKCE flow: the email link carries
 * `?code=...`, exchanged via exchangeCodeForSession. The older
 * `?token_hash=&type=` shape (verifyOtp) is handled too, since which one
 * arrives depends on the project's auth flow setting, not this code.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const next = searchParams.get('next') ?? '/'
  const supabase = await createClient()

  const code = searchParams.get('code')
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(new URL(next, origin))
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error.message)}`, origin)
    )
  }

  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    if (!error) return NextResponse.redirect(new URL(next, origin))
  }

  return NextResponse.redirect(new URL('/login?error=invalid_link', origin))
}
