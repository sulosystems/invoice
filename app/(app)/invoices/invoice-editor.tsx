'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  formatMoney,
  lineTotal,
  type Invoice,
  type InvoiceLineItem,
  type LineItemDraft,
} from '@/lib/types'
import { createInvoice, updateInvoice } from './actions'

const today = () => new Date().toISOString().slice(0, 10)

/** A custom column applies to every row — same label, one value cell each. */
type CustomColumn = { id: string; label: string }

/** The editor's row shape: LineItemDraft minus the computed custom_fields,
 * plus per-column values keyed by CustomColumn.id. Converted to the real
 * LineItemDraft.custom_fields shape only at save time. */
type EditableLine = Omit<LineItemDraft, 'custom_fields'> & {
  customValues: Record<string, string>
}

function blankLine(): EditableLine {
  return {
    product: '',
    quantity: 1,
    unit_price: 0,
    invoice_date: today(),
    delivery_date: '',
    tax_rate: 0,
    supplier: '',
    comments: '',
    bill_ref_no: '',
    rec_dept: '',
    customValues: {},
  }
}

/**
 * Rebuilds editor state from a saved invoice's line items. Custom fields
 * are stored per-line as parallel {label, value} arrays, but the editor
 * treats them as invoice-wide columns — so this assigns one stable id per
 * distinct label (first-appearance order) and maps each line's values onto
 * those ids.
 */
function deriveInitialState(
  initial?: { invoice: Invoice; lines: InvoiceLineItem[] },
  availableCustomFields: string[] = []
) {
  if (!initial || initial.lines.length === 0) {
    // A brand-new invoice starts with every custom field anyone has ever
    // used, ready to fill in — not just the fixed 12. Editing an existing
    // invoice instead reflects exactly what that invoice actually has (below).
    return {
      lines: [blankLine()],
      customColumns: availableCustomFields.map((label) => ({
        id: crypto.randomUUID(),
        label,
      })),
      notes: initial?.invoice.notes ?? '',
    }
  }

  const idByLabel = new Map<string, string>()
  for (const line of initial.lines) {
    for (const f of line.custom_fields) {
      if (!idByLabel.has(f.label)) idByLabel.set(f.label, crypto.randomUUID())
    }
  }
  const customColumns: CustomColumn[] = Array.from(idByLabel, ([label, id]) => ({ id, label }))

  const lines: EditableLine[] = initial.lines.map((l) => {
    const customValues: Record<string, string> = {}
    for (const f of l.custom_fields) {
      const id = idByLabel.get(f.label)
      if (id) customValues[id] = f.value
    }
    return {
      product: l.product,
      quantity: Number(l.quantity),
      unit_price: Number(l.unit_price),
      invoice_date: l.invoice_date,
      delivery_date: l.delivery_date ?? '',
      tax_rate: Number(l.tax_rate),
      supplier: l.supplier ?? '',
      comments: l.comments ?? '',
      bill_ref_no: l.bill_ref_no ?? '',
      rec_dept: l.rec_dept ?? '',
      customValues,
    }
  })

  return { lines, customColumns, notes: initial.invoice.notes ?? '' }
}

const cell =
  'w-full rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-neutral-900'

const buttonOutline =
  'rounded-md border border-neutral-300 px-3 py-1.5 text-sm transition hover:border-neutral-900'

// One <col> width per column, in the exact order asked for. Sr. # and Total
// are derived, so they aren't inputs — everything between them is.
const COLUMNS = [
  { key: 'sr', label: 'Sr. #', width: '3rem' },
  { key: 'product', label: 'Product', width: '11rem' },
  { key: 'qty', label: 'Quantity', width: '6rem' },
  { key: 'price', label: 'Price', width: '6.5rem' },
  { key: 'invoice_date', label: 'Invoice Date', width: '8.5rem' },
  { key: 'delivery_date', label: 'Delivery Date', width: '8.5rem' },
  { key: 'tax', label: 'Tax %', width: '5rem' },
  { key: 'total', label: 'Total', width: '7rem' },
  { key: 'supplier', label: 'Supplier', width: '10rem' },
  { key: 'bill_ref_no', label: 'Bill Ref. No.', width: '8rem' },
  { key: 'rec_dept', label: 'Rec. Dept', width: '8rem' },
  { key: 'comments', label: 'Comments', width: '10rem' },
] as const

const FIXED_COLUMNS_WIDTH_REM = COLUMNS.reduce((sum, c) => sum + parseFloat(c.width), 0)
const CUSTOM_COLUMN_WIDTH_REM = 9
const DELETE_COLUMN_WIDTH_REM = 2

export function InvoiceEditor({
  initial,
  availableCustomFields = [],
}: {
  /** Present when editing a saved invoice; absent when creating a new one. */
  initial?: { invoice: Invoice; lines: InvoiceLineItem[] }
  /** Every custom-field label used on any invoice so far — pre-populated
   * on a brand-new invoice only; ignored when editing an existing one. */
  availableCustomFields?: string[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [notes, setNotes] = useState(
    () => deriveInitialState(initial, availableCustomFields).notes
  )
  const [lines, setLines] = useState<EditableLine[]>(
    () => deriveInitialState(initial, availableCustomFields).lines
  )
  const [customColumns, setCustomColumns] = useState<CustomColumn[]>(
    () => deriveInitialState(initial, availableCustomFields).customColumns
  )
  const [addingField, setAddingField] = useState(false)
  const [pendingLabel, setPendingLabel] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const pendingLabelInputRef = useRef<HTMLInputElement>(null)

  const grandTotal = lines.reduce((sum, l) => sum + lineTotal(l), 0)

  function patch(i: number, p: Partial<EditableLine>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...p } : l)))
  }

  function setCellValue(i: number, columnId: string, value: string) {
    patch(i, { customValues: { ...lines[i].customValues, [columnId]: value } })
  }

  function openAddField() {
    setAddingField(true)
    setPendingLabel('')
    // The input doesn't exist until this state change renders, so focus it
    // on the next tick rather than immediately.
    setTimeout(() => pendingLabelInputRef.current?.focus(), 0)
  }

  function confirmAddField() {
    const label = pendingLabel.trim()
    if (!label) return
    setCustomColumns((prev) => [...prev, { id: crypto.randomUUID(), label }])
    setAddingField(false)
    setPendingLabel('')
  }

  // A new column lands at the far right of an already-wide table — without
  // this, adding one is invisible unless you happen to scroll all the way
  // over.
  useEffect(() => {
    if (customColumns.length === 0) return
    scrollRef.current?.scrollTo({ left: scrollRef.current.scrollWidth, behavior: 'smooth' })
  }, [customColumns.length])

  function renameColumn(id: string, label: string) {
    setCustomColumns((prev) => prev.map((c) => (c.id === id ? { ...c, label } : c)))
  }

  function removeColumn(id: string) {
    setCustomColumns((prev) => prev.filter((c) => c.id !== id))
  }

  function save() {
    setError(null)

    // Every row gets an entry for every named custom column (blank if never
    // filled in), so all lines stay parallel — that's what lets the printed
    // document render them as real, consistent columns afterward.
    const namedColumns = customColumns.filter((c) => c.label.trim())
    const payload: LineItemDraft[] = lines.map(({ customValues, ...rest }) => ({
      ...rest,
      custom_fields: namedColumns.map((c) => ({
        label: c.label.trim(),
        value: customValues[c.id] ?? '',
      })),
    }))

    startTransition(async () => {
      const result = initial
        ? await updateInvoice(initial.invoice.id, payload, notes)
        : await createInvoice(payload, notes)

      if (result.error) {
        setError(result.error)
        return
      }
      // Editing skips the stock-change prompt — that's a deliberate,
      // separate step (available any time via "Record stock change" on the
      // invoice page), not something re-saving should re-trigger.
      router.push(initial ? `/invoices/${result.id}` : `/invoices/${result.id}?stock=ask`)
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight">
          {initial ? `Edit ${initial.invoice.number}` : 'New invoice'}
        </h1>
        <button
          onClick={save}
          disabled={pending}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:opacity-50"
        >
          {pending ? 'Saving…' : initial ? 'Save changes' : 'Save invoice'}
        </button>
      </div>

      {error && (
        <p className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {customColumns.length > 0 && (
        <p className="text-xs text-neutral-500">
          {customColumns.length} custom {customColumns.length === 1 ? 'field' : 'fields'} added —
          scroll the table right to see{' '}
          {customColumns.length === 1 ? 'it' : 'them'} after Comments.
        </p>
      )}

      <div ref={scrollRef} className="overflow-x-auto rounded-lg border border-neutral-200">
        {/* table-fixed makes <colgroup> widths authoritative instead of
           hints, but table-fixed alone still lets the browser infer the
           table's own overall width — which can silently override those
           column widths anyway. Setting an explicit width, computed from
           the same numbers the <colgroup> uses, removes that ambiguity
           entirely: this is the actual fix for a new field's column
           rendering too narrow to show its own label. */}
        <table
          className="table-fixed text-sm"
          style={{
            width: `${
              FIXED_COLUMNS_WIDTH_REM +
              customColumns.length * CUSTOM_COLUMN_WIDTH_REM +
              DELETE_COLUMN_WIDTH_REM
            }rem`,
          }}
        >
          <colgroup>
            {COLUMNS.map((c) => (
              <col key={c.key} style={{ width: c.width }} />
            ))}
            {customColumns.map((c) => (
              <col key={c.id} style={{ width: `${CUSTOM_COLUMN_WIDTH_REM}rem` }} />
            ))}
            <col style={{ width: `${DELETE_COLUMN_WIDTH_REM}rem` }} />
          </colgroup>
          <thead className="border-b border-neutral-200 bg-neutral-50 text-left">
            <tr>
              {COLUMNS.map((c) => (
                <th key={c.key} className="whitespace-nowrap px-2 py-2 font-medium">
                  {c.label}
                </th>
              ))}
              {customColumns.map((c) => (
                <th key={c.id} className="bg-amber-50 px-2 py-1.5 font-medium">
                  <div className="flex items-center gap-1">
                    <input
                      className="w-full rounded-md border border-amber-300 bg-white px-1.5 py-1 text-xs font-medium outline-none focus:border-neutral-900"
                      placeholder="Field name"
                      value={c.label}
                      onChange={(e) => renameColumn(c.id, e.target.value)}
                    />
                    <button
                      onClick={() => removeColumn(c.id)}
                      className="text-neutral-400 transition hover:text-red-600"
                      aria-label="Remove field"
                    >
                      ×
                    </button>
                  </div>
                </th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i} className="border-b border-neutral-100 align-top last:border-0">
                <td className="px-2 py-1.5 text-center text-neutral-500">{i + 1}</td>
                <td className="px-2 py-1.5">
                  <input
                    className={cell}
                    placeholder="Product"
                    value={l.product}
                    onChange={(e) => patch(i, { product: e.target.value })}
                  />
                </td>
                <td className="px-2 py-1.5">
                  <input
                    type="number"
                    step="any"
                    min="0"
                    className={`${cell} text-right`}
                    value={l.quantity}
                    onChange={(e) => patch(i, { quantity: Number(e.target.value) })}
                  />
                </td>
                <td className="px-2 py-1.5">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className={`${cell} text-right`}
                    value={l.unit_price}
                    onChange={(e) => patch(i, { unit_price: Number(e.target.value) })}
                  />
                </td>
                <td className="px-2 py-1.5">
                  <input
                    type="date"
                    className={cell}
                    value={l.invoice_date}
                    onChange={(e) => patch(i, { invoice_date: e.target.value })}
                  />
                </td>
                <td className="px-2 py-1.5">
                  <input
                    type="date"
                    className={cell}
                    value={l.delivery_date}
                    onChange={(e) => patch(i, { delivery_date: e.target.value })}
                  />
                </td>
                <td className="px-2 py-1.5">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className={`${cell} text-right`}
                    value={l.tax_rate}
                    onChange={(e) => patch(i, { tax_rate: Number(e.target.value) })}
                  />
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-neutral-700">
                  {formatMoney(lineTotal(l))}
                </td>
                <td className="px-2 py-1.5">
                  <input
                    className={cell}
                    value={l.supplier}
                    onChange={(e) => patch(i, { supplier: e.target.value })}
                  />
                </td>
                <td className="px-2 py-1.5">
                  <input
                    className={cell}
                    value={l.bill_ref_no}
                    onChange={(e) => patch(i, { bill_ref_no: e.target.value })}
                  />
                </td>
                <td className="px-2 py-1.5">
                  <input
                    className={cell}
                    value={l.rec_dept}
                    onChange={(e) => patch(i, { rec_dept: e.target.value })}
                  />
                </td>
                <td className="px-2 py-1.5">
                  <input
                    className={cell}
                    value={l.comments}
                    onChange={(e) => patch(i, { comments: e.target.value })}
                  />
                </td>
                {customColumns.map((c) => (
                  <td key={c.id} className="bg-amber-50/40 px-2 py-1.5">
                    <input
                      className={cell}
                      placeholder={c.label || 'Value'}
                      value={l.customValues[c.id] ?? ''}
                      onChange={(e) => setCellValue(i, c.id, e.target.value)}
                    />
                  </td>
                ))}
                <td className="px-1 py-1.5 text-center">
                  <button
                    onClick={() => setLines(lines.filter((_, idx) => idx !== i))}
                    disabled={lines.length === 1}
                    className="px-1 text-neutral-400 transition hover:text-red-600 disabled:opacity-30"
                    aria-label="Remove line"
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => setLines([...lines, blankLine()])} className={buttonOutline}>
            + Add line
          </button>
          {addingField ? (
            <div className="flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 p-1">
              <input
                ref={pendingLabelInputRef}
                className="rounded-md border border-neutral-300 px-2 py-1 text-sm outline-none focus:border-neutral-900"
                placeholder="Field label, e.g. PO Approver"
                value={pendingLabel}
                onChange={(e) => setPendingLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') confirmAddField()
                  if (e.key === 'Escape') setAddingField(false)
                }}
              />
              <button
                onClick={confirmAddField}
                disabled={!pendingLabel.trim()}
                className="rounded-md bg-neutral-900 px-3 py-1 text-sm font-medium text-white disabled:opacity-40"
              >
                Save
              </button>
              <button
                onClick={() => setAddingField(false)}
                className="px-2 text-sm text-neutral-500 hover:text-neutral-900"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button onClick={openAddField} className={buttonOutline}>
              + Add field
            </button>
          )}
        </div>
        <div className="text-sm">
          <span className="text-neutral-500">Grand total</span>
          <span className="ml-4 font-medium tabular-nums">
            {formatMoney(grandTotal)}
          </span>
        </div>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-neutral-500">Notes</h2>
        <textarea
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
          rows={3}
          placeholder="Anything about this invoice as a whole."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </section>
    </div>
  )
}
