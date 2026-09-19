'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { StockLevel } from '@/lib/types'
import { recordStockMove } from '../actions'

const input =
  'rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900'

export function StockPrompt({
  invoiceId,
  products,
}: {
  invoiceId: string
  products: StockLevel[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [answered, setAnswered] = useState<null | 'yes'>(null)
  const [error, setError] = useState<string | null>(null)

  const [productId, setProductId] = useState('')
  const [direction, setDirection] = useState<'in' | 'out'>('out')
  const [amount, setAmount] = useState('')
  const [comment, setComment] = useState('')

  /** Drops ?stock=ask so a refresh doesn't reopen the question. */
  function dismiss() {
    router.replace(`/invoices/${invoiceId}`)
  }

  function submit() {
    setError(null)
    startTransition(async () => {
      const result = await recordStockMove({
        invoiceId,
        productId,
        direction,
        amount: Number(amount),
        comment,
      })
      if (result.error) {
        setError(result.error)
        return
      }
      dismiss()
    })
  }

  if (products.length === 0) {
    return (
      <div className="no-print rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        Saved. You have no products yet, so there is nothing to move stock for —
        add some on the Products page and you can record the change here later.
        <button onClick={dismiss} className="ml-2 underline">
          Dismiss
        </button>
      </div>
    )
  }

  return (
    <div className="no-print rounded-lg border border-neutral-300 bg-neutral-50 p-5">
      {answered !== 'yes' ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="flex-1 text-sm font-medium">
            Did this invoice change your stock?
          </p>
          <button
            onClick={() => setAnswered('yes')}
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-700"
          >
            Yes
          </button>
          <button
            onClick={dismiss}
            className="rounded-md border border-neutral-300 px-4 py-2 text-sm transition hover:border-neutral-900"
          >
            No
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm font-medium">Record the stock change</p>

          <div className="flex flex-wrap gap-2">
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className={`${input} min-w-56 flex-1 bg-white`}
            >
              <option value="">Select a product…</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.sku ? ` (${p.sku})` : ''} — {Number(p.on_hand)} {p.unit} on
                  hand
                </option>
              ))}
            </select>

            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value as 'in' | 'out')}
              className={`${input} bg-white`}
            >
              <option value="out">Removed −</option>
              <option value="in">Added +</option>
            </select>

            <input
              type="number"
              step="any"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Qty"
              className={`${input} w-24 text-right`}
            />
          </div>

          <input
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Comment (optional)"
            className={`${input} w-full`}
          />

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-2">
            <button
              onClick={submit}
              disabled={pending}
              className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:opacity-50"
            >
              {pending ? 'Recording…' : 'Record change'}
            </button>
            <button
              onClick={dismiss}
              className="rounded-md border border-neutral-300 px-4 py-2 text-sm transition hover:border-neutral-900"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
