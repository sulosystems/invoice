import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Invoice, StockLevel, Template } from '@/lib/types'
import { InvoiceDocument, type LineItemRow } from '../invoice-document'
import { StockPrompt } from './stock-prompt'
import { PrintDialog } from './print-dialog'
import { DeleteInvoiceButton } from './delete-invoice-button'

type MoveRow = {
  id: string
  qty: number
  comment: string | null
  created_at: string
  products: { name: string; unit: string } | null
}

export default async function InvoiceDetailPage(
  props: PageProps<'/invoices/[id]'>
) {
  // Next 16: params and searchParams are Promises. Sync access was removed.
  const { id } = await props.params
  const searchParams = await props.searchParams
  const askStock = searchParams.stock === 'ask'

  const supabase = await createClient()

  const [
    { data: invoice },
    { data: allTemplates },
    { data: defaultTemplate },
    { data: lineItems },
    { data: moves },
    { data: products },
  ] = await Promise.all([
    supabase.from('invoices').select('*').eq('id', id).maybeSingle(),
    supabase.from('templates').select('*').order('name'),
    supabase.from('templates').select('*').eq('is_default', true).maybeSingle(),
    supabase
      .from('invoice_line_items')
      .select('*')
      .eq('invoice_id', id)
      .order('sr_number'),
    supabase
      .from('stock_moves')
      .select('id, qty, comment, created_at, products(name, unit)')
      .eq('invoice_id', id)
      .order('created_at'),
    supabase.from('stock_levels').select('*').order('name'),
  ])

  if (!invoice) notFound()

  const inv = invoice as Invoice
  const stockMoves = (moves ?? []) as unknown as MoveRow[]
  const templates = (allTemplates ?? []) as Template[]
  const lines = (lineItems ?? []) as unknown as LineItemRow[]

  // An invoice explicitly assigned a template uses it; otherwise falls back
  // to whichever template is marked default; otherwise every column, no logo.
  const chosenTemplate = inv.template_id
    ? templates.find((t) => t.id === inv.template_id) ?? null
    : null
  const activeTemplate = chosenTemplate ?? (defaultTemplate as Template | null)

  return (
    <div className="space-y-6">
      <div className="no-print flex flex-wrap items-center gap-3">
        <Link
          href="/invoices"
          className="text-sm text-neutral-500 transition hover:text-neutral-900"
        >
          ← All invoices
        </Link>
        <div className="flex-1" />
        <Link
          href={`/invoices/${id}/edit`}
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm transition hover:border-neutral-900"
        >
          Edit
        </Link>
        {!askStock && (
          <Link
            href={`/invoices/${id}?stock=ask`}
            className="rounded-md border border-neutral-300 px-4 py-2 text-sm transition hover:border-neutral-900"
          >
            Record stock change
          </Link>
        )}
        <a
          href={`/invoices/${id}/excel`}
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm transition hover:border-neutral-900"
        >
          Download Excel
        </a>
        <PrintDialog
          invoiceId={id}
          invoice={inv}
          lines={lines}
          templates={templates}
          currentTemplateId={inv.template_id}
        />
        <DeleteInvoiceButton invoiceId={id} number={inv.number} />
      </div>

      {askStock && (
        <StockPrompt invoiceId={id} products={(products ?? []) as StockLevel[]} />
      )}

      <InvoiceDocument invoice={inv} lines={lines} layout={activeTemplate?.layout ?? {}} />

      {stockMoves.length > 0 && (
        <section className="no-print space-y-3">
          <h2 className="text-sm font-medium text-neutral-500">
            Stock changes from this invoice
          </h2>
          <div className="overflow-x-auto rounded-lg border border-neutral-200">
            <table className="w-full text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-left">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Product</th>
                  <th className="px-4 py-2.5 text-right font-medium">Change</th>
                  <th className="px-4 py-2.5 font-medium">Comment</th>
                  <th className="px-4 py-2.5 font-medium">Recorded</th>
                </tr>
              </thead>
              <tbody>
                {stockMoves.map((m) => (
                  <tr
                    key={m.id}
                    className="border-b border-neutral-100 last:border-0"
                  >
                    <td className="px-4 py-2.5">{m.products?.name ?? '—'}</td>
                    <td
                      className={`px-4 py-2.5 text-right tabular-nums ${
                        Number(m.qty) < 0 ? 'text-red-600' : 'text-green-700'
                      }`}
                    >
                      {Number(m.qty) > 0 ? '+' : ''}
                      {Number(m.qty)} {m.products?.unit ?? ''}
                    </td>
                    <td className="px-4 py-2.5 text-neutral-500">
                      {m.comment ?? '—'}
                    </td>
                    <td className="px-4 py-2.5 text-neutral-500">
                      {new Date(m.created_at).toLocaleString('en-CA')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
