'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { deleteTemplate } from './actions'

export function DeleteButton({ id }: { id: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  return (
    <button
      onClick={() => {
        if (!confirm('Delete this template? Invoices using it will fall back to no template.')) return
        startTransition(async () => {
          await deleteTemplate(id)
          router.refresh()
        })
      }}
      disabled={pending}
      className="text-sm text-neutral-400 transition hover:text-red-600 disabled:opacity-50"
    >
      Delete
    </button>
  )
}
