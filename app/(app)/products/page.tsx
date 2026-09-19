import { createClient } from '@/lib/supabase/server'
import type { StockLevel } from '@/lib/types'
import { AddProductForm } from './add-product-form'

export default async function ProductsPage() {
  const supabase = await createClient()

  // Read the view, not the table: on_hand comes with it, always correct.
  const { data, error } = await supabase
    .from('stock_levels')
    .select('*')
    .order('name')

  const products = (data ?? []) as StockLevel[]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Products</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Everything you can move stock for.
        </p>
      </div>

      <AddProductForm />

      {error && (
        <p className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error.message}
        </p>
      )}

      {products.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500">
          No products yet. Add one above.
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
    </div>
  )
}
