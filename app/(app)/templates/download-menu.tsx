'use client'

import { useState } from 'react'
import type { Template } from '@/lib/types'

/**
 * One button, not two separate mechanisms: pick the blank starter (to
 * design a brand-new template) or ANY existing template — uploaded Word
 * ones as-is, builder ones (column/logo/colour UI) generated on the fly by
 * the same route — all from the same place.
 */
export function DownloadMenu({ templates }: { templates: Template[] }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="rounded-md border border-neutral-300 px-4 py-2 text-sm transition hover:border-neutral-900"
      >
        Download template (.docx) ▾
      </button>

      {open && (
        <>
          {/* Click-outside-to-close layer */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 w-72 rounded-md border border-neutral-200 bg-white p-1 shadow-lg">
            <a
              href="/templates/base-invoice-template.docx"
              download
              onClick={() => setOpen(false)}
              className="block rounded px-3 py-2 text-sm hover:bg-neutral-100"
            >
              Blank starter template
              <span className="block text-xs text-neutral-400">
                Start a brand-new template from scratch
              </span>
            </a>

            {templates.length > 0 && (
              <>
                <div className="my-1 border-t border-neutral-100" />
                <p className="px-3 pt-1 pb-0.5 text-xs font-medium text-neutral-400">
                  Your templates
                </p>
                {templates.map((t) => (
                  <a
                    key={t.id}
                    href={`/templates/${t.id}/docx`}
                    onClick={() => setOpen(false)}
                    className="block rounded px-3 py-2 text-sm hover:bg-neutral-100"
                  >
                    {t.name}
                    {t.is_default && (
                      <span className="ml-2 rounded bg-neutral-900 px-1.5 py-0.5 text-[10px] font-medium text-white">
                        DEFAULT
                      </span>
                    )}
                    <span className="block text-xs text-neutral-400">
                      {t.docx_base64 ? 'Your uploaded Word file' : 'Generated from its column/logo choices'}
                    </span>
                  </a>
                ))}
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
