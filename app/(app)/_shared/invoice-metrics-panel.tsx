import { createClient } from '@/lib/supabase/server'
import { formatMoney, type InvoiceMetrics } from '@/lib/types'
import { StatCard } from './stat-card'

/**
 * Reads the invoice_metrics view — used on the dashboard and on the
 * invoices page itself, so both always show the identical numbers.
 */
export async function InvoiceMetricsPanel() {
  const supabase = await createClient()
  const { data } = await supabase.from('invoice_metrics').select('*').single()
  const m = data as InvoiceMetrics | null

  if (!m) return null

  // A stale cached render from before a column existed shouldn't ever show
  // NaN — 0 is always a safe fallback for these counts.
  const num = (v: unknown) => {
    const n = Number(v)
    return Number.isFinite(n) ? n : 0
  }

  const total = num(m.total_invoices)
  const withChange = num(m.invoices_with_stock_change)
  const pct = total > 0 ? Math.round((withChange / total) * 100) : 0

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatCard label="Total invoices" value={total} />
      <StatCard
        label="Resulted in a stock change"
        value={`${withChange} / ${total}`}
        sub={`${pct}%`}
      />
      <StatCard label="New this week" value={num(m.invoices_last_7_days)} sub="last 7 days" />
      <StatCard label="Total value" value={formatMoney(num(m.total_invoice_value))} />
    </div>
  )
}
