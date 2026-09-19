import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Refreshes the Supabase auth session and rewrites the auth cookies onto the
 * outgoing response. Called from proxy.ts on every matched request.
 *
 * Two rules that are easy to get wrong and fail silently:
 *   1. Never write logic between createServerClient() and getUser(). Any
 *      early return in between can log the user out at random.
 *   2. Always return THIS response object (or copy its cookies onto yours),
 *      otherwise the refreshed tokens are dropped and the session dies.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // TEMP: UI testing without the login flow. Set to "false" (or delete the
  // var) in .env.local to put the app back behind auth — nothing else to
  // revert here. RLS was opened for the `anon` role to match; see
  // supabase/migrations/0002_temp_open_anon_for_ui_testing.sql to close it.
  const authDisabled = process.env.NEXT_PUBLIC_DISABLE_AUTH === 'true'

  // /auth/* must stay reachable signed-out — it is how you become signed in.
  const { pathname } = request.nextUrl
  const isAuthRoute =
    pathname.startsWith('/login') || pathname.startsWith('/auth')

  if (!user && !isAuthRoute && !authDisabled) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return response
}
