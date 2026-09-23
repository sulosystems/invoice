import Link from 'next/link'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { fetchAll } from '@/lib/supabase/fetch-all'
import { formatMoney, type Invoice, type InvoiceLineItem } from '@/lib/types'
import { InvoiceMetricsPanel } from '../_shared/invoice-metrics-panel'
import { SearchBox } from '../_shared/search-box'

type InvoiceTotal = { invoice_id: string; line_count: number; total: number }

type LineItemSearchFields = Pick<
  InvoiceLineItem,
  | 'invoice_id'
  | 'product'
  | 'supplier'
  | 'comments'
  | 'bill_ref_no'
  | 'rec_dept'
  | 'invoice_date'
  | 'delivery_date'
  | 'custom_fields'
>

export default async function InvoicesPage(props: PageProps<'/invoices'>) {
  const { q } = await props.searchParams
  const query = typeof q === 'string' ? q.trim().toLowerCase() : ''

  const supabase = await createClient()
  const [{ data, error }, { data: totalsData }] = await Promise.all([
    fetchAll<Invoice>((from, to) =>
      supabase
        .from('invoices')
        .select('*')
        .order('created_at', { ascending: false })
        .order('id')
        .range(from, to)
    ),
    fetchAll<InvoiceTotal>((from, to) =>
      supabase.from('invoice_totals').select('*').order('invoice_id').range(from, to)
    ),
  ])

  const allInvoices = data
  const totals = new Map(totalsData.map((t) => [t.invoice_id, t]))

  // Every line-item field lives at the line level, not the header, so a
  // search has to reach into invoice_line_items too (e.g. by supplier or
  // bill ref no) rather than only matching the header's number/notes.
  let matchingLineInvoiceIds: Set<string> | null = null
  if (query) {
    const { data: lineItems } = await fetchAll<LineItemSearchFields>((from, to) =>
      supabase
        .from('invoice_line_items')
        .select('invoice_id, product, supplier, comments, bill_ref_no, rec_dept, invoice_date, delivery_date, custom_fields')
        .order('id')
        .range(from, to)
    )

    matchingLineInvoiceIds = new Set(
      lineItems
        .filter((li) => {
          const haystack = [
            li.product,
            li.supplier ?? '',
            li.comments ?? '',
            li.bill_ref_no ?? '',
            li.rec_dept ?? '',
            li.invoice_date,
            li.delivery_date ?? '',
            ...(li.custom_fields ?? []).map((cf) => `${cf.label} ${cf.value}`),
          ]
            .join(' ')
            .toLowerCase()
          return haystack.includes(query)
        })
        .map((li) => li.invoice_id)
    )
  }

  const invoices = query
    ? allInvoices.filter((inv) => {
        const t = totals.get(inv.id)
        const haystack = [
          inv.number,
          inv.notes ?? '',
          new Date(inv.created_at).toLocaleDateString('en-CA'),
          t ? String(t.line_count) : '',
          t ? formatMoney(Number(t.total)) : '',
        ]
          .join(' ')
          .toLowerCase()
        return haystack.includes(query) || (matchingLineInvoiceIds?.has(inv.id) ?? false)
      })
    : allInvoices

  // Bulk-imported records from the old Purchase Management system are
  // marked with an "OLD-" number (see the legacy import), so they can be
  // kept out of the main list and shown in their own section instead.
  const currentInvoices = invoices.filter((inv) => !inv.number.startsWith('OLD-'))
  const previousInvoices = invoices.filter((inv) => inv.number.startsWith('OLD-'))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Invoices</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Every vendor invoice you&apos;ve recorded.
          </p>
        </div>
        <Link
          href="/invoices/new"
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-700"
        >
          New invoice
        </Link>
      </div>

      <InvoiceMetricsPanel />

      <Suspense fallback={<div className="h-9 w-full max-w-xs rounded-md border border-neutral-300" />}>
        <SearchBox placeholder="Search invoices — number, supplier, product, dept, notes…" />
      </Suspense>

      {error && (
        <p className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error.message}
        </p>
      )}

      {currentInvoices.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500">
          {query ? 'No invoices match your search.' : 'No invoices yet.'}
        </p>
      ) : (
        <InvoiceTable invoices={currentInvoices} totals={totals} />
      )}

      {allInvoices.some((inv) => inv.number.startsWith('OLD-')) && (
        <details className="group rounded-lg border border-neutral-200">
          <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50">
            Previous invoices ({previousInvoices.length})
            <span className="ml-2 text-xs font-normal text-neutral-400">
              Imported from the old Purchase Management system — one summary line item per record, no product breakdown.
            </span>
          </summary>
          <div className="border-t border-neutral-200 p-4">
            {previousInvoices.length === 0 ? (
              <p className="text-sm text-neutral-500">No previous invoices match your search.</p>
            ) : (
              <InvoiceTable invoices={previousInvoices} totals={totals} />
            )}
          </div>
        </details>
      )}
    </div>
  )
}

function InvoiceTable({
  invoices,
  totals,
}: {
  invoices: Invoice[]
  totals: Map<string, InvoiceTotal>
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-200">
      <table className="w-full text-sm">
        <thead className="border-b border-neutral-200 bg-neutral-50 text-left">
          <tr>
            <th className="px-4 py-2.5 font-medium">Invoice ID</th>
            <th className="px-4 py-2.5 font-medium">Created</th>
            <th className="px-4 py-2.5 text-right font-medium">Lines</th>
            <th className="px-4 py-2.5 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((inv) => {
            const t = totals.get(inv.id)
            return (
              <tr
                key={inv.id}
                className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50"
              >
                <td className="px-4 py-2.5">
                  <Link
                    href={`/invoices/${inv.id}`}
                    className="font-mono text-xs underline-offset-2 hover:underline"
                  >
                    {inv.number}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-neutral-600">
                  {new Date(inv.created_at).toLocaleDateString('en-CA')}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">{t?.line_count ?? 0}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {formatMoney(Number(t?.total ?? 0))}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
