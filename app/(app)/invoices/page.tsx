import Link from 'next/link'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
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
    supabase.from('invoices').select('*').order('created_at', { ascending: false }),
    supabase.from('invoice_totals').select('*'),
  ])

  const allInvoices = (data ?? []) as Invoice[]
  const totals = new Map(
    ((totalsData ?? []) as InvoiceTotal[]).map((t) => [t.invoice_id, t])
  )

  // Every line-item field lives at the line level, not the header, so a
  // search has to reach into invoice_line_items too (e.g. by supplier or
  // bill ref no) rather than only matching the header's number/notes.
  let matchingLineInvoiceIds: Set<string> | null = null
  if (query) {
    const { data: lineItems } = await supabase
      .from('invoice_line_items')
      .select('invoice_id, product, supplier, comments, bill_ref_no, rec_dept, invoice_date, delivery_date, custom_fields')

    matchingLineInvoiceIds = new Set(
      ((lineItems ?? []) as LineItemSearchFields[])
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

      {invoices.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500">
          {query ? 'No invoices match your search.' : 'No invoices yet.'}
        </p>
      ) : (
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
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {t?.line_count ?? 0}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {formatMoney(Number(t?.total ?? 0))}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
