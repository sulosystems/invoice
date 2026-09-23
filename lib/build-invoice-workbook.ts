import ExcelJS from 'exceljs'
import { INVOICE_COLUMNS } from './invoice-columns'
import type { Invoice, InvoiceLineItem } from './types'

/**
 * The union of every custom-field label actually present across this
 * invoice's lines, in first-appearance order — same fallback rule the
 * printed document uses when nothing more specific has been picked.
 */
function allCustomFieldLabels(lines: InvoiceLineItem[]): string[] {
  const seen = new Set<string>()
  const labels: string[] = []
  for (const l of lines) {
    for (const f of l.custom_fields ?? []) {
      if (!seen.has(f.label)) {
        seen.add(f.label)
        labels.push(f.label)
      }
    }
  }
  return labels
}

/**
 * One invoice's line items as a downloadable .xlsx — every fixed column
 * plus every custom field this invoice actually uses, as real numbers/dates
 * rather than pre-formatted strings, so the sheet is useful for further
 * work in Excel (sums, sorting, filters) rather than just a printout.
 */
export function buildInvoiceWorkbook(invoice: Invoice, lines: InvoiceLineItem[]) {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'FRPMC Inventory and Invoice Management'
  workbook.created = new Date()

  // Excel sheet names can't contain \ / ? * [ ] : and are capped at 31 chars.
  const sheetName = invoice.number.replace(/[\\/?*[\]:]/g, '-').slice(0, 31)
  const sheet = workbook.addWorksheet(sheetName || 'Invoice')
  const customLabels = allCustomFieldLabels(lines)

  sheet.columns = [
    ...INVOICE_COLUMNS.map((c) => ({ header: c.label, key: c.key, width: 16 })),
    ...customLabels.map((label) => ({ header: label, key: `custom:${label}`, width: 16 })),
  ]
  sheet.getRow(1).font = { bold: true }

  for (const l of lines) {
    const row: Record<string, string | number | null> = {
      sr: l.sr_number,
      product: l.product,
      qty: Number(l.quantity),
      price: Number(l.unit_price),
      invoice_date: l.invoice_date,
      delivery_date: l.delivery_date,
      tax: Number(l.tax_rate),
      total: Number(l.total),
      supplier: l.supplier,
      bill_ref_no: l.bill_ref_no,
      rec_dept: l.rec_dept,
      comments: l.comments,
    }
    for (const label of customLabels) {
      row[`custom:${label}`] = l.custom_fields.find((f) => f.label === label)?.value ?? null
    }
    sheet.addRow(row)
  }

  const totalCol = sheet.getColumn('total')
  const grandTotal = lines.reduce((sum, l) => sum + Number(l.total), 0)
  const totalsRow = sheet.addRow({ [totalCol.key as string]: grandTotal })
  totalsRow.getCell('product').value = 'Grand total'
  totalsRow.font = { bold: true }

  if (invoice.notes) {
    sheet.addRow([])
    sheet.addRow(['Notes', invoice.notes])
  }

  return workbook.xlsx.writeBuffer()
}
