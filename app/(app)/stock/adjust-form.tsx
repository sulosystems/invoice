'use client'

import { useActionState, useEffect, useRef } from 'react'
import { useFormStatus } from 'react-dom'
import { adjustStock, type ProductState } from '../products/actions'
import type { StockLevel } from '@/lib/types'

const input =
  'rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900'

function Submit() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:opacity-50"
    >
      {pending ? 'Recording…' : 'Record'}
    </button>
  )
}

/** Manual adjustments: stock counts, write-offs, opening balances. */
export function AdjustForm({ products }: { products: StockLevel[] }) {
  const [state, formAction] = useActionState<ProductState, FormData>(
    adjustStock,
    {}
  )
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state.ok) formRef.current?.reset()
  }, [state.ok])

  if (products.length === 0) return null

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex flex-wrap items-start gap-2 rounded-lg border border-neutral-200 p-4"
    >
      <select name="product_id" required className={`${input} min-w-52 flex-1 bg-white`}>
        <option value="">Select a product…</option>
        {products.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} — {Number(p.on_hand)} {p.unit}
          </option>
        ))}
      </select>
      <input
        name="qty"
        type="number"
        step="any"
        required
        placeholder="+10 or -3"
        className={`${input} w-28 text-right`}
      />
      <input
        name="comment"
        placeholder="Reason (optional)"
        className={`${input} min-w-40 flex-1`}
      />
      <Submit />
      {state.error && <p className="w-full text-sm text-red-600">{state.error}</p>}
    </form>
  )
}
