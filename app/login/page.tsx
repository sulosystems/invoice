'use client'

import Image from 'next/image'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { sendMagicLink, type LoginState } from './actions'

function SubmitButton() {
  // useFormStatus only reports pending from INSIDE the form, hence a child component.
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-md bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:opacity-50"
    >
      {pending ? 'Sending…' : 'Email me a sign-in link'}
    </button>
  )
}

export default function LoginPage() {
  // Next 16 / React 19: useActionState returns a 3-tuple. useFormState is gone.
  const [state, formAction] = useActionState<LoginState, FormData>(
    sendMagicLink,
    {}
  )

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <Image
          src="/frpmc-logo.jpg"
          alt="FRPMC"
          width={56}
          height={56}
          className="mb-4 rounded-sm"
        />
        <h1 className="text-xl font-semibold tracking-tight">
          FRPMC Inventory and Invoice Management
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Sign in to continue.
        </p>

        {state.sent ? (
          <div className="mt-6 rounded-md border border-green-300 bg-green-50 p-4 text-sm text-green-900">
            Check your email for a sign-in link. You can close this tab.
          </div>
        ) : (
          <form action={formAction} className="mt-6 space-y-3">
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-sm outline-none focus:border-neutral-900"
            />
            <SubmitButton />
            {state.error && (
              <p className="text-sm text-red-600">{state.error}</p>
            )}
          </form>
        )}
      </div>
    </main>
  )
}
