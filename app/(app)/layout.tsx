import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { signOut } from '@/app/login/actions'

const NAV = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/invoices', label: 'Invoices' },
  { href: '/products', label: 'Products' },
  { href: '/stock', label: 'Stock' },
  { href: '/templates', label: 'Templates' },
  { href: '/settings', label: 'Settings' },
] as const

export default async function AppLayout({ children }: LayoutProps<'/'>) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // TEMP: matches the same flag in lib/supabase/session.ts, so the UI can be
  // driven without the magic-link flow. Remove both once auth is back on.
  const authDisabled = process.env.NEXT_PUBLIC_DISABLE_AUTH === 'true'

  // proxy.ts already redirects, but Server Actions are reachable by direct
  // POST, so never rely on the proxy alone for authorization.
  if (!user && !authDisabled) redirect('/login')

  return (
    <div className="flex min-h-full flex-col">
      <header className="no-print border-b border-neutral-200">
        <nav className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-6 py-3">
          <Link href="/invoices" className="flex items-center gap-2">
            <Image
              src="/frpmc-logo.jpg"
              alt="FRPMC"
              width={32}
              height={32}
              className="rounded-sm"
            />
            <span className="hidden text-sm font-semibold tracking-tight sm:inline">
              FRPMC Inventory and Invoice Management
            </span>
            <span className="text-sm font-semibold tracking-tight sm:hidden">FRPMC</span>
          </Link>
          <div className="flex flex-1 gap-4">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm text-neutral-600 transition hover:text-neutral-900"
              >
                {item.label}
              </Link>
            ))}
          </div>
          <span className="hidden text-xs text-neutral-400 sm:inline">
            {user?.email ?? 'auth disabled'}
          </span>
          <form
            action={async () => {
              'use server'
              await signOut()
              redirect('/login')
            }}
          >
            <button
              type="submit"
              className="text-sm text-neutral-500 transition hover:text-neutral-900"
            >
              Sign out
            </button>
          </form>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">{children}</main>
    </div>
  )
}
