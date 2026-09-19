import Link from 'next/link'
import { InvoiceMetricsPanel } from '../_shared/invoice-metrics-panel'
import { StockMetricsPanel } from '../_shared/stock-metrics-panel'

export default function DashboardPage() {
  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-neutral-500">
          An overview of invoice activity and stock movement.
        </p>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-neutral-500">Invoices</h2>
          <Link href="/invoices" className="text-sm text-neutral-500 underline-offset-2 hover:underline">
            View all invoices →
          </Link>
        </div>
        <InvoiceMetricsPanel />
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-neutral-500">Stock</h2>
          <Link href="/stock" className="text-sm text-neutral-500 underline-offset-2 hover:underline">
            View stock →
          </Link>
        </div>
        <StockMetricsPanel />
      </section>
    </div>
  )
}
