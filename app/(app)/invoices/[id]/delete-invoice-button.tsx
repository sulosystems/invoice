'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { deleteInvoice } from '../actions'

export function DeleteInvoiceButton({ invoiceId, number }: { invoiceId: string; number: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  return (
    <>
      <button
        onClick={() => {
          if (
            !confirm(
              `Delete invoice ${number}? Its line items are deleted too. Any stock changes recorded from it stay in the stock history. This can't be undone.`
            )
          )
            return
          setError(null)
          startTransition(async () => {
            const result = await deleteInvoice(invoiceId)
            if (result.error) {
              setError(result.error)
              return
            }
            router.push('/invoices')
          })
        }}
        disabled={pending}
        className="rounded-md border border-red-200 px-4 py-2 text-sm text-red-600 transition hover:border-red-600 disabled:opacity-50"
      >
        {pending ? 'Deleting…' : 'Delete'}
      </button>
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </>
  )
}
