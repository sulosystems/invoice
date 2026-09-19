import { formatMoney, type CustomField, type Invoice, type TemplateLayout } from '@/lib/types'
import { ALL_COLUMN_KEYS, INVOICE_COLUMNS, type ColumnKey } from '@/lib/invoice-columns'

export type LineItemRow = {
  id: string
  sr_number: number
  product: string
  quantity: number
  unit_price: number
  invoice_date: string
  delivery_date: string | null
  tax_rate: number
  total: number
  supplier: string | null
  comments: string | null
  bill_ref_no: string | null
  rec_dept: string | null
  custom_fields: CustomField[]
}

const LABELS = Object.fromEntries(
  INVOICE_COLUMNS.map((c) => [c.key, c.label])
) as Record<ColumnKey, string>

const ALIGN_RIGHT: Partial<Record<ColumnKey, boolean>> = {
  qty: true,
  price: true,
  tax: true,
  total: true,
}

/** One cell's content for a given column key. Keeps the table loop tiny. */
function cellValue(l: LineItemRow, key: ColumnKey): React.ReactNode {
  switch (key) {
    case 'sr':
      return l.sr_number
    case 'product':
      return l.product
    case 'qty':
      return Number(l.quantity)
    case 'price':
      return formatMoney(Number(l.unit_price))
    case 'invoice_date':
      return l.invoice_date
    case 'delivery_date':
      return l.delivery_date ?? '—'
    case 'tax':
      return `${Number(l.tax_rate)}%`
    case 'total':
      return formatMoney(Number(l.total))
    case 'supplier':
      return l.supplier ?? '—'
    case 'bill_ref_no':
      return l.bill_ref_no ?? '—'
    case 'rec_dept':
      return l.rec_dept ?? '—'
    case 'comments':
      return l.comments ?? '—'
  }
}

/**
 * The union of every custom-field label actually present across this
 * invoice's lines, in first-appearance order. This is the fallback when a
 * template hasn't picked specific ones (or there's no template at all).
 */
function allCustomFieldLabels(lines: LineItemRow[]): string[] {
  const seen = new Set<string>()
  const labels: string[] = []
  for (const l of lines) {
    for (const f of l.custom_fields) {
      if (!seen.has(f.label)) {
        seen.add(f.label)
        labels.push(f.label)
      }
    }
  }
  return labels
}

function customFieldValue(l: LineItemRow, label: string): string {
  return l.custom_fields.find((f) => f.label === label)?.value || '—'
}

/**
 * The printable invoice. This exact markup is what the browser prints —
 * `globals.css` strips the app chrome under @media print, so there is no
 * separate "PDF version" to keep in sync.
 *
 * Which of the fixed columns appear, their order, the logo and the accent
 * colour all come from the template's `layout` — a template is saved
 * config, not a template engine, so this component is the only place that
 * interprets it.
 */
export function InvoiceDocument({
  invoice,
  lines,
  layout = {},
}: {
  invoice: Invoice
  lines: LineItemRow[]
  layout?: TemplateLayout
}) {
  const grandTotal = lines.reduce((sum, l) => sum + Number(l.total), 0)
  // undefined (never configured) shows everything; a real saved array
  // (even []) is respected exactly — deliberately choosing zero columns
  // must actually show zero, not silently fall back to showing all of them.
  const columns = layout.columns !== undefined ? layout.columns : ALL_COLUMN_KEYS
  const extraLabels =
    layout.customColumns !== undefined ? layout.customColumns : allCustomFieldLabels(lines)
  const accent = layout.accentColor || '#171717'

  return (
    <article className="print-area rounded-lg border border-neutral-200 bg-white p-10 text-neutral-900">
      <header
        className="flex items-start justify-between gap-8 border-b-2 pb-6"
        style={{ borderColor: accent }}
      >
        <div>
          {layout.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={layout.logoUrl} alt="" className="mb-3 h-14 w-auto" />
          ) : null}
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: accent }}>
            {layout.headerText ?? 'Purchase Invoice'}
          </h1>
        </div>
        <dl className="text-right text-sm">
          <dt className="text-neutral-500">Invoice ID</dt>
          <dd className="font-mono font-medium">{invoice.number}</dd>
        </dl>
      </header>

      <div className="mt-8 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-neutral-300 text-left">
              {columns.map((key) => (
                <th
                  key={key}
                  className={`whitespace-nowrap pb-2 pr-3 font-medium ${
                    ALIGN_RIGHT[key] ? 'text-right' : ''
                  }`}
                >
                  {LABELS[key]}
                </th>
              ))}
              {extraLabels.map((label) => (
                <th key={label} className="whitespace-nowrap pb-2 pr-3 font-medium">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.id} className="border-b border-neutral-100">
                {columns.map((key) => (
                  <td
                    key={key}
                    className={`py-2 pr-3 ${ALIGN_RIGHT[key] ? 'text-right tabular-nums' : ''} ${
                      key === 'total' ? 'font-medium' : ''
                    }`}
                  >
                    {cellValue(l, key)}
                  </td>
                ))}
                {extraLabels.map((label) => (
                  <td key={label} className="py-2 pr-3 text-neutral-600">
                    {customFieldValue(l, label)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="avoid-break mt-4 flex justify-end">
        <dl className="w-64 space-y-1 text-sm">
          <div className="flex justify-between border-t border-neutral-300 pt-1 font-semibold">
            <dt>Grand total</dt>
            <dd className="tabular-nums">{formatMoney(grandTotal)}</dd>
          </div>
        </dl>
      </div>

      {invoice.notes && (
        <section className="avoid-break mt-8 border-t border-neutral-200 pt-4">
          <p className="whitespace-pre-line text-sm text-neutral-600">
            {invoice.notes}
          </p>
        </section>
      )}

      {layout.footerText && (
        <footer className="mt-8 text-center text-xs text-neutral-400">
          {layout.footerText}
        </footer>
      )}
    </article>
  )
}
