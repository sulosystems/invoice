import { createClient } from '@/lib/supabase/server'
import type { StockMetrics } from '@/lib/types'
import { StatCard } from './stat-card'
import { StockDonutChart } from './stock-donut-chart'

/**
 * Reads the stock_metrics view — used on the dashboard and on the stock
 * page itself, so both always show the identical numbers. "Issued" means
 * stock going out (negative stock_moves.qty); the view flips the sign so
 * these display as positive counts.
 */
export async function StockMetricsPanel() {
  const supabase = await createClient()
  const { data } = await supabase.from('stock_metrics').select('*').single()
  const m = data as StockMetrics | null

  if (!m) return null

  // Guards against a stale cached render from before a column existed (a
  // browser hit exactly this the moment the 14-day fields were added) as
  // much as against a genuinely missing value — either way, 0 renders
  // correctly and NaN never reaches the DOM.
  const num = (v: unknown) => {
    const n = Number(v)
    return Number.isFinite(n) ? n : 0
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Issued today" value={num(m.issued_today)} />
        <StatCard label="Issued, last 7 days" value={num(m.issued_last_7_days)} />
        <StatCard label="Issued, last 30 days" value={num(m.issued_last_30_days)} />
        <StatCard label="Total on hand" value={num(m.total_on_hand)} />
      </div>

      <div className="rounded-lg border border-neutral-200 p-4">
        <p className="text-xs text-neutral-500">Stock changes — last 14 days</p>
        <div className="mt-3">
          <StockDonutChart
            added={num(m.received_last_14_days)}
            issued={num(m.issued_last_14_days)}
          />
        </div>
      </div>
    </div>
  )
}
