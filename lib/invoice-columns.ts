/**
 * The canonical set of invoice line-item columns, in their default order.
 * A template's `layout.columns` is a subset/reorder of these keys — this
 * file is the single source of truth both the template editor (which
 * columns to offer) and the printed document (how to render each one)
 * read from, so they can never drift out of sync.
 */
export type ColumnKey =
  | 'sr'
  | 'product'
  | 'qty'
  | 'price'
  | 'invoice_date'
  | 'delivery_date'
  | 'tax'
  | 'total'
  | 'supplier'
  | 'bill_ref_no'
  | 'rec_dept'
  | 'comments'

export const INVOICE_COLUMNS: { key: ColumnKey; label: string; mergeTag: string }[] = [
  { key: 'sr', label: 'Sr. #', mergeTag: 'sr_number' },
  { key: 'product', label: 'Product', mergeTag: 'product' },
  { key: 'qty', label: 'Quantity', mergeTag: 'quantity' },
  { key: 'price', label: 'Price', mergeTag: 'unit_price' },
  { key: 'invoice_date', label: 'Invoice Date', mergeTag: 'invoice_date' },
  { key: 'delivery_date', label: 'Delivery Date', mergeTag: 'delivery_date' },
  { key: 'tax', label: 'Tax %', mergeTag: 'tax_rate' },
  { key: 'total', label: 'Total', mergeTag: 'total' },
  { key: 'supplier', label: 'Supplier', mergeTag: 'supplier' },
  { key: 'bill_ref_no', label: 'Bill Ref. No.', mergeTag: 'bill_ref_no' },
  { key: 'rec_dept', label: 'Rec. Dept', mergeTag: 'rec_dept' },
  { key: 'comments', label: 'Comments', mergeTag: 'comments' },
]

export const ALL_COLUMN_KEYS: ColumnKey[] = INVOICE_COLUMNS.map((c) => c.key)

/** ColumnKey -> the exact merge-tag name the Word-generation route fills in. */
export const COLUMN_MERGE_TAGS: Record<ColumnKey, string> = Object.fromEntries(
  INVOICE_COLUMNS.map((c) => [c.key, c.mergeTag])
) as Record<ColumnKey, string>
