'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { Invoice, Template } from '@/lib/types'
import { InvoiceDocument, type LineItemRow } from '../invoice-document'
import { setInvoiceTemplate, previewDocxTemplate } from '../actions'

/**
 * "Print / Save invoice" opens this: pick a template, see it rendered live
 * against this invoice's real data (client-side, no round trip — every
 * template's full layout is passed in as a prop), then commit. Committing
 * both remembers the choice on the invoice (setInvoiceTemplate) and carries
 * out the actual action — the browser's print dialog for a builder
 * template, or a Word-document download for an uploaded one.
 */
export function PrintDialog({
  invoiceId,
  invoice,
  lines,
  templates,
  currentTemplateId,
}: {
  invoiceId: string
  invoice: Invoice
  lines: LineItemRow[]
  templates: Template[]
  currentTemplateId: string | null
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(currentTemplateId)
  const [pending, startTransition] = useTransition()
  const [previewPending, startPreviewTransition] = useTransition()
  const [docxPreview, setDocxPreview] = useState<{ html?: string; error?: string }>({})

  const selected = templates.find((t) => t.id === selectedId) ?? null
  const isDocx = Boolean(selected?.docx_base64)

  // Fill the actual template with this invoice's data and show it as HTML —
  // not pixel-perfect to Word's own rendering, but real merged content
  // instead of a placeholder message. Updates are wrapped in a transition
  // rather than set directly in the effect, since a bare setState there
  // triggers a cascading extra render.
  useEffect(() => {
    if (!open || !isDocx || !selected) return
    let cancelled = false
    startPreviewTransition(() => setDocxPreview({}))
    previewDocxTemplate(invoiceId, selected.id).then((result) => {
      if (cancelled) return
      startPreviewTransition(() => setDocxPreview({ html: result.html, error: result.error }))
    })
    return () => {
      cancelled = true
    }
  }, [open, isDocx, selected, invoiceId])

  function confirm() {
    startTransition(async () => {
      await setInvoiceTemplate(invoiceId, selectedId)

      if (isDocx) {
        setOpen(false)
        // A real file download (Content-Disposition: attachment), not an
        // app-route navigation — router.push() would try to client-route it
        // instead of letting the browser save the file.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.href = `/invoices/${invoiceId}/word${
          selectedId ? `?template=${selectedId}` : ''
        }`
        return
      }

      // The main page's own invoice document needs to reflect this template
      // before printing — refresh it, then print once that's landed.
      router.refresh()
      setOpen(false)
      setTimeout(() => window.print(), 200)
    })
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-700"
      >
        Print / Save invoice
      </button>

      {open && (
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-neutral-200 p-4">
              <h2 className="text-base font-semibold">Choose a template</h2>
              <button
                onClick={() => setOpen(false)}
                className="text-neutral-400 transition hover:text-neutral-900"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedId(null)}
                  className={`rounded-md border px-3 py-1.5 text-sm transition ${
                    selectedId === null
                      ? 'border-neutral-900 bg-neutral-900 text-white'
                      : 'border-neutral-300 hover:border-neutral-900'
                  }`}
                >
                  Default (all columns, no logo)
                </button>
                {templates.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedId(t.id)}
                    className={`rounded-md border px-3 py-1.5 text-sm transition ${
                      selectedId === t.id
                        ? 'border-neutral-900 bg-neutral-900 text-white'
                        : 'border-neutral-300 hover:border-neutral-900'
                    }`}
                  >
                    {t.name}
                    {t.docx_base64 ? ' (Word)' : ''}
                  </button>
                ))}
              </div>

              <p className="mt-3 text-xs text-neutral-500">
                Preview
                {isDocx && (
                  <span className="ml-1 text-neutral-400">
                    — approximate: converted from the Word file, not Word&apos;s own rendering
                  </span>
                )}
              </p>
              <div className="mt-1 rounded-lg border border-neutral-200 bg-neutral-100 p-4">
                {isDocx ? (
                  previewPending ? (
                    <p className="py-16 text-center text-sm text-neutral-500">Filling in the template…</p>
                  ) : docxPreview.error ? (
                    <p className="py-16 text-center text-sm text-red-600">{docxPreview.error}</p>
                  ) : (
                    <div
                      className="docx-preview max-h-96 overflow-y-auto rounded bg-white p-6 text-sm"
                      // Our own server-generated HTML, converted from this
                      // account's own uploaded template — not third-party content.
                      dangerouslySetInnerHTML={{ __html: docxPreview.html ?? '' }}
                    />
                  )
                ) : (
                  <div className="origin-top scale-[0.8] overflow-hidden">
                    <InvoiceDocument
                      invoice={invoice}
                      lines={lines}
                      layout={selected?.layout ?? {}}
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-neutral-200 p-4">
              <button
                onClick={() => setOpen(false)}
                className="rounded-md border border-neutral-300 px-4 py-2 text-sm transition hover:border-neutral-900"
              >
                Cancel
              </button>
              <button
                onClick={confirm}
                disabled={pending}
                className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:opacity-50"
              >
                {pending
                  ? 'Preparing…'
                  : isDocx
                    ? 'Download Word document'
                    : 'Print / Save PDF'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
