'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useRef, useState } from 'react'

export function SearchBox({
  placeholder = 'Search…',
  paramName = 'q',
}: {
  placeholder?: string
  paramName?: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const urlValue = searchParams.get(paramName) ?? ''

  const [value, setValue] = useState(urlValue)
  // Tracks the URL value the input was last synced to, so external changes
  // (e.g. back/forward navigation) can be adopted during render — the
  // documented "adjusting state when a prop changes" pattern — instead of a
  // setState-in-effect, which would trigger an extra cascading render.
  const [syncedUrlValue, setSyncedUrlValue] = useState(urlValue)
  if (syncedUrlValue !== urlValue) {
    setSyncedUrlValue(urlValue)
    setValue(urlValue)
  }

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function updateUrl(next: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (next) params.set(paramName, next)
    else params.delete(paramName)
    router.replace(`?${params.toString()}`, { scroll: false })
  }

  function handleChange(next: string) {
    setValue(next)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => updateUrl(next), 250)
  }

  return (
    <div className="relative w-full max-w-xs">
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        fill="none"
        className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
      >
        <path
          d="M9 16A7 7 0 1 0 9 2a7 7 0 0 0 0 14ZM18 18l-4.35-4.35"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
      <input
        type="text"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-neutral-300 py-2 pl-8 pr-8 text-sm outline-none focus:border-neutral-900"
      />
      {value && (
        <button
          type="button"
          onClick={() => handleChange('')}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700"
        >
          ×
        </button>
      )}
    </div>
  )
}
