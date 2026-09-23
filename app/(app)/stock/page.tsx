import Link from 'next/link'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { StockLevel } from '@/lib/types'
import { AdjustForm } from './adjust-form'
import { StockMetricsPanel } from '../_shared/stock-metrics-panel'
import { SearchBox } from '../_shared/search-box'

type LedgerRow = {
  id: string
  qty: number
  comment: string | null
  created_at: string
  products: { name: string; unit: string } | null
  invoices: { id: string; number: string } | null
}

export default async function StockPage(props: PageProps<'/stock'>) {
  const { q } = await props.searchParams
  const query = typeof q === 'string' ? q.trim().toLowerCase() : ''

  const supabase = await createClient()

  const [{ data: levels }, { data: ledger, error }] = await Promise.all([
    supabase.from('stock_levels').select('*').order('name'),
    supabase
      .from('stock_moves')
      .select(
        'id, qty, comment, created_at, products(name, unit), invoices(id, number)'
      )
      .order('created_at', { ascending: false })
      .limit(200),
  ])

  const allProducts = (levels ?? []) as StockLevel[]
  const allRows = (ledger ?? []) as unknown as LedgerRow[]

  const products = query
    ? allProducts.filter((p) =>
        [
          p.name,
          p.sku ?? '',
          p.unit,
          String(p.on_hand),
          p.last_movement_at ? new Date(p.last_movement_at).toLocaleDateString('en-CA') : '',
        ]
          .join(' ')
          .toLowerCase()
          .includes(query)
      )
    : allProducts

  const rows = query
    ? allRows.filter((r) =>
        [
          new Date(r.created_at).toLocaleString('en-CA'),
          r.products?.name ?? '',
          r.products?.unit ?? '',
          String(r.qty),
          r.invoices?.number ?? 'Manual',
          r.comment ?? '',
        ]
          .join(' ')
          .toLowerCase()
          .includes(query)
      )
    : allRows

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Stock</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Every movement, and where it came from.
        </p>
      </div>

      <StockMetricsPanel />

      <AdjustForm products={allProducts} />

      <Suspense fallback={<div className="h-9 w-full max-w-xs rounded-md border border-neutral-300" />}>
        <SearchBox placeholder="Search stock — product, SKU, unit, invoice, comment…" />
      </Suspense>

      {error && (
        <p className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error.message}
        </p>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-neutral-500">Current stock</h2>
        {products.length === 0 ? (
          <p className="rounded-lg border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500">
            {query ? (
              'No products match your search.'
            ) : (
              <>
                No products yet.{' '}
                <Link href="/products" className="underline">
                  Add one
                </Link>{' '}
                to start tracking stock.
              </>
            )}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-neutral-200">
            <table className="w-full text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-left">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Product</th>
                  <th className="px-4 py-2.5 font-medium">SKU</th>
                  <th className="px-4 py-2.5 text-right font-medium">On hand</th>
                  <th className="px-4 py-2.5 font-medium">Unit</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} className="border-b border-neutral-100 last:border-0">
                    <td className="px-4 py-2.5">{p.name}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-neutral-500">
                      {p.sku ?? '—'}
                    </td>
                    <td
                      className={`px-4 py-2.5 text-right tabular-nums ${
                        Number(p.on_hand) < 0 ? 'text-red-600' : ''
                      }`}
                    >
                      {Number(p.on_hand)}
                    </td>
                    <td className="px-4 py-2.5 text-neutral-500">{p.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-neutral-500">Movement history</h2>
        {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500">
          {query ? 'No movements match your search.' : 'No stock movements recorded yet.'}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200">
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-left">
              <tr>
                <th className="px-4 py-2.5 font-medium">When</th>
                <th className="px-4 py-2.5 font-medium">Product</th>
                <th className="px-4 py-2.5 text-right font-medium">Change</th>
                <th className="px-4 py-2.5 font-medium">Source</th>
                <th className="px-4 py-2.5 font-medium">Comment</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-neutral-100 last:border-0">
                  <td className="px-4 py-2.5 whitespace-nowrap text-neutral-500">
                    {new Date(r.created_at).toLocaleString('en-CA')}
                  </td>
                  <td className="px-4 py-2.5">{r.products?.name ?? '—'}</td>
                  <td
                    className={`px-4 py-2.5 text-right tabular-nums ${
                      Number(r.qty) < 0 ? 'text-red-600' : 'text-green-700'
                    }`}
                  >
                    {Number(r.qty) > 0 ? '+' : ''}
                    {Number(r.qty)} {r.products?.unit ?? ''}
                  </td>
                  <td className="px-4 py-2.5">
                    {r.invoices ? (
                      <Link
                        href={`/invoices/${r.invoices.id}`}
                        className="font-mono text-xs underline-offset-2 hover:underline"
                      >
                        {r.invoices.number}
                      </Link>
                    ) : (
                      <span className="text-neutral-400">Manual</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-neutral-500">
                    {r.comment ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
      </section>
    </div>
  )
}
