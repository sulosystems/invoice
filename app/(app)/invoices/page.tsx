import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { formatMoney, type Invoice } from '@/lib/types'
import { InvoiceMetricsPanel } from '../_shared/invoice-metrics-panel'

type InvoiceTotal = { invoice_id: string; line_count: number; total: number }

export default async function InvoicesPage() {
  const supabase = await createClient()
  const [{ data, error }, { data: totalsData }] = await Promise.all([
    supabase.from('invoices').select('*').order('created_at', { ascending: false }),
    supabase.from('invoice_totals').select('*'),
  ])

  const invoices = (data ?? []) as Invoice[]
  const totals = new Map(
    ((totalsData ?? []) as InvoiceTotal[]).map((t) => [t.invoice_id, t])
  )

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

      {error && (
        <p className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error.message}
        </p>
      )}

      {invoices.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500">
          No invoices yet.
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
