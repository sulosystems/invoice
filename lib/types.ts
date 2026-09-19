/** Domain types. These mirror the supabase/migrations/*.sql files. */

export type Product = {
  id: string
  name: string
  sku: string | null
  unit: string
  created_at: string
}

/** A self-service extra field on a line item, for anything the fixed columns don't cover. */
export type CustomField = {
  label: string
  value: string
}

/**
 * One row of a received invoice. Every field the university's purchasing
 * office asked for lives here, at the line-item level, since Supplier,
 * Invoice Date, Bill Ref No., Delivery Date and Rec. Dept can all differ
 * within one invoice (a combined bill, or items landing on different days
 * in different departments).
 *
 * The invoice is an independent record: `product` is free text (whatever the
 * vendor's invoice says), not a link to the products table. Reconciling it
 * against real inventory is the separate, manual stock-change step.
 *
 * `total` is a Postgres generated column (qty * price * (1 + tax/100)) — it
 * always comes back from a read, never something the app computes and sends.
 *
 * `custom_fields` is a self-service escape hatch for anything not on the
 * fixed list — freeform, not wired into the column-picker or per-field Word
 * merge tags (those need a real typed column added deliberately).
 */
export type InvoiceLineItem = {
  id: string // UniqueID
  invoice_id: string // InvoiceID
  sr_number: number // Sr. Number — auto-assigned by a DB trigger
  product: string // Product — free text, not linked to inventory
  quantity: number
  unit_price: number // Price
  invoice_date: string
  delivery_date: string | null
  tax_rate: number // Tax %
  total: number // generated column — read-only
  supplier: string | null
  comments: string | null
  bill_ref_no: string | null
  rec_dept: string | null
  custom_fields: CustomField[]
  created_at: string
}

/** A line item as entered in the editor, before it has an id or a total. */
export type LineItemDraft = {
  product: string
  quantity: number
  unit_price: number
  invoice_date: string
  delivery_date: string
  tax_rate: number
  supplier: string
  comments: string
  bill_ref_no: string
  rec_dept: string
  custom_fields: CustomField[]
}

/**
 * The invoice header is now just the grouping/identity record — an
 * InvoiceID, an optional template, and overall notes. Everything else lives
 * on invoice_line_items.
 */
export type Invoice = {
  id: string
  number: string
  notes: string | null
  template_id: string | null
  created_at: string
  updated_at: string
}

/** qty is signed: positive = stock in, negative = stock out. */
export type StockMove = {
  id: string
  product_id: string
  invoice_id: string | null
  qty: number
  comment: string | null
  created_at: string
}

/** Read-only, from the stock_levels view. Never written to. */
export type StockLevel = {
  id: string
  name: string
  sku: string | null
  unit: string
  on_hand: number
  last_movement_at: string | null
}

/** A template is saved layout config, not a template engine. */
export type TemplateLayout = {
  headerText?: string
  footerText?: string
  /** A data: URI (the logo embedded inline) or an https URL. */
  logoUrl?: string
  accentColor?: string
  /** Which line-item columns to print, and in what order. Empty/undefined = all. */
  columns?: import('./invoice-columns').ColumnKey[]
  /**
   * Which self-service custom-field labels to print. Unlike `columns`,
   * these aren't a fixed set — they're whatever labels someone has actually
   * used on an invoice (see the custom_field_labels view). Empty/undefined
   * = show every custom field present on the invoice, same fallback rule
   * as `columns`.
   */
  customColumns?: string[]
}

export type Template = {
  id: string
  name: string
  layout: TemplateLayout
  /**
   * An uploaded Word document (base64), used instead of `layout` when
   * present. Lets an office design the whole document in Word — letterhead,
   * signatures, anything — rather than the in-app builder's fixed layout.
   */
  docx_base64: string | null
  is_default: boolean
  created_at: string
}

/** Read-only, from the invoice_metrics view. Always exactly one row. */
export type InvoiceMetrics = {
  total_invoices: number
  invoices_with_stock_change: number
  invoices_today: number
  invoices_last_7_days: number
  invoices_last_30_days: number
  total_invoice_value: number
}

/** Read-only, from the stock_metrics view. Always exactly one row. */
export type StockMetrics = {
  issued_today: number
  received_today: number
  issued_last_7_days: number
  received_last_7_days: number
  issued_last_30_days: number
  received_last_30_days: number
  issued_all_time: number
  received_all_time: number
  total_on_hand: number
  issued_last_14_days: number
  received_last_14_days: number
}

export function lineTotal(l: Pick<LineItemDraft, 'quantity' | 'unit_price' | 'tax_rate'>): number {
  const qty = Number(l.quantity) || 0
  const price = Number(l.unit_price) || 0
  const tax = Number(l.tax_rate) || 0
  return Math.round(qty * price * (1 + tax / 100) * 100) / 100
}

export function formatMoney(amount: number): string {
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
  }).format(amount)
}
