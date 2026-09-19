'use client'

import { useActionState, useEffect, useRef } from 'react'
import { useFormStatus } from 'react-dom'
import { createProduct, type ProductState } from './actions'

function Submit() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:opacity-50"
    >
      {pending ? 'Adding…' : 'Add product'}
    </button>
  )
}

export function AddProductForm() {
  const [state, formAction] = useActionState<ProductState, FormData>(
    createProduct,
    {}
  )
  const formRef = useRef<HTMLFormElement>(null)

  // Clear the inputs after a success so you can type the next one straight in.
  useEffect(() => {
    if (state.ok) formRef.current?.reset()
  }, [state.ok])

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex flex-wrap items-start gap-2 rounded-lg border border-neutral-200 p-4"
    >
      <input
        name="name"
        required
        placeholder="Product name"
        className="min-w-48 flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
      />
      <input
        name="sku"
        placeholder="SKU (optional)"
        className="w-36 rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
      />
      <input
        name="unit"
        defaultValue="ea"
        placeholder="Unit"
        className="w-20 rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
      />
      <Submit />
      {state.error && (
        <p className="w-full text-sm text-red-600">{state.error}</p>
      )}
    </form>
  )
}
