'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { deleteCustomField } from './actions'

export function DeleteFieldButton({ label, count }: { label: string; count: number }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => {
          if (
            !confirm(
              `Delete "${label}"? This removes it from all ${count} line item${count === 1 ? '' : 's'} that currently have it, across every invoice. This can't be undone.`
            )
          )
            return
          setError(null)
          startTransition(async () => {
            const result = await deleteCustomField(label)
            if (result.error) {
              setError(result.error)
              return
            }
            router.refresh()
          })
        }}
        disabled={pending}
        className="text-sm text-neutral-400 transition hover:text-red-600 disabled:opacity-50"
      >
        {pending ? 'Deleting…' : 'Delete'}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  )
}
