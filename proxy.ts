import type { NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/session'

/**
 * Next 16 renamed `middleware.ts` -> `proxy.ts` and `middleware()` -> `proxy()`.
 * Supabase's own setup guide still documents the old filename; a middleware.ts
 * here would simply never run, and the auth session would never refresh.
 */
export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Everything except static assets and images. Auth routes are handled
     * inside updateSession so the session still refreshes on the login page.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
