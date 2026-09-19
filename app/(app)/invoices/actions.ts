'use server'

import { revalidatePath } from 'next/cache'
import mammoth from 'mammoth'
import { createClient } from '@/lib/supabase/server'
import { fillInvoiceDocx } from '@/lib/fill-invoice-docx'
import type { Invoice, InvoiceLineItem, LineItemDraft, Template } from '@/lib/types'

export type SaveResult = { id?: string; number?: string; error?: string }

/** Shared shape for both createInvoice and updateInvoice's line-item insert. */
function toLineItemRows(invoiceId: string, rows: LineItemDraft[]) {
  return rows.map((l, i) => ({
    invoice_id: invoiceId,
    // Explicit, not left to the DB trigger — matters for updateInvoice,
    // where old rows may briefly coexist with the new ones (see there).
    sr_number: i + 1,
    product: l.product.trim(),
    quantity: l.quantity,
    unit_price: l.unit_price,
    invoice_date: l.invoice_date,
    delivery_date: l.delivery_date || null,
    tax_rate: l.tax_rate,
    supplier: l.supplier.trim() || null,
    comments: l.comments.trim() || null,
    bill_ref_no: l.bill_ref_no.trim() || null,
    rec_dept: l.rec_dept.trim() || null,
    // A field with no label is a row the user added and never filled in.
    custom_fields: l.custom_fields.filter((f) => f.label.trim()),
  }))
}

export async function createInvoice(
  lines: LineItemDraft[],
  notes: string
): Promise<SaveResult> {
  const rows = lines.filter((l) => l.product.trim() && Number(l.quantity) > 0)

  if (rows.length === 0) {
    return { error: 'Add at least one line item with a product and quantity.' }
  }

  const supabase = await createClient()

  // Header first: `number` (InvoiceID) comes from the DB sequence default,
  // never computed here, so concurrent saves can't collide.
  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .insert({ notes: notes.trim() || null })
    .select('id, number')
    .single()

  if (invoiceError) return { error: invoiceError.message }

  const { error: linesError } = await supabase
    .from('invoice_line_items')
    .insert(toLineItemRows(invoice.id, rows))

  if (linesError) {
    // Header without lines is confusing to look at later, so don't leave it behind.
    await supabase.from('invoices').delete().eq('id', invoice.id)
    return { error: linesError.message }
  }

  revalidatePath('/invoices')
  return { id: invoice.id, number: invoice.number }
}

/**
 * Replaces an invoice's line items and notes wholesale — simpler and safer
 * than diffing which lines changed, and this app has no other writer that
 * could race with an edit. Does NOT touch any stock_moves already recorded
 * against this invoice; reconciling stock stays a separate, manual step
 * (same reasoning as why saving never auto-records stock in the first place).
 */
export async function updateInvoice(
  invoiceId: string,
  lines: LineItemDraft[],
  notes: string
): Promise<SaveResult> {
  const rows = lines.filter((l) => l.product.trim() && Number(l.quantity) > 0)

  if (rows.length === 0) {
    return { error: 'Add at least one line item with a product and quantity.' }
  }

  const supabase = await createClient()

  const { error: notesError } = await supabase
    .from('invoices')
    .update({ notes: notes.trim() || null })
    .eq('id', invoiceId)
  if (notesError) return { error: notesError.message }

  // Insert the replacement lines FIRST — if this fails, the invoice still
  // has its old lines rather than ending up with none. Only once the new
  // ones exist do we remove what used to be there.
  const { data: inserted, error: insertError } = await supabase
    .from('invoice_line_items')
    .insert(toLineItemRows(invoiceId, rows))
    .select('id')

  if (insertError) return { error: insertError.message }

  const newIds = (inserted ?? []).map((r) => r.id)
  if (newIds.length > 0) {
    const { error: deleteError } = await supabase
      .from('invoice_line_items')
      .delete()
      .eq('invoice_id', invoiceId)
      .not('id', 'in', `(${newIds.join(',')})`)
    if (deleteError) return { error: deleteError.message }
  }

  revalidatePath('/invoices')
  revalidatePath(`/invoices/${invoiceId}`)
  return { id: invoiceId }
}

export async function setInvoiceTemplate(
  invoiceId: string,
  templateId: string | null
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('invoices')
    .update({ template_id: templateId })
    .eq('id', invoiceId)

  if (error) return { error: error.message }
  revalidatePath(`/invoices/${invoiceId}`)
  return { ok: true }
}

export type DocxPreviewResult = { html?: string; error?: string }

/**
 * Fills the chosen Word template with this invoice's real data and converts
 * the result to HTML for an in-dialog preview — not pixel-perfect to Word's
 * own rendering (mammoth reads the document's text/structure, not its exact
 * layout engine), but real merged content instead of a placeholder message.
 */
export async function previewDocxTemplate(
  invoiceId: string,
  templateId: string
): Promise<DocxPreviewResult> {
  const supabase = await createClient()

  const [{ data: invoiceRow }, { data: templateRow }, { data: lineItems }] =
    await Promise.all([
      supabase.from('invoices').select('*').eq('id', invoiceId).maybeSingle(),
      supabase.from('templates').select('*').eq('id', templateId).maybeSingle(),
      supabase
        .from('invoice_line_items')
        .select('*')
        .eq('invoice_id', invoiceId)
        .order('sr_number'),
    ])

  const invoice = invoiceRow as Invoice | null
  const template = templateRow as Template | null
  if (!invoice) return { error: 'Invoice not found.' }
  if (!template?.docx_base64) return { error: 'This template has no uploaded Word document.' }

  const result = fillInvoiceDocx(template.docx_base64, invoice, (lineItems ?? []) as InvoiceLineItem[])
  if (!result.ok) return { error: result.error }

  const { value: html } = await mammoth.convertToHtml({ buffer: result.buffer })
  return { html }
}

export type StockMoveResult = { ok?: boolean; error?: string }

/**
 * Records the stock change an invoice caused. The stock question stays a
 * manual yes/no prompt (not automatic on save) so a credit note or a
 * corrected invoice doesn't silently double-count stock that was already
 * received under an earlier one.
 */
export async function recordStockMove(input: {
  invoiceId: string
  productId: string
  direction: 'in' | 'out'
  amount: number
  comment: string
}): Promise<StockMoveResult> {
  const amount = Number(input.amount)

  if (!input.productId) return { error: 'Pick a product.' }
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: 'Quantity must be greater than zero.' }
  }

  const qty = input.direction === 'out' ? -amount : amount

  const supabase = await createClient()
  const { error } = await supabase.from('stock_moves').insert({
    product_id: input.productId,
    invoice_id: input.invoiceId,
    qty,
    comment: input.comment.trim() || null,
  })

  if (error) return { error: error.message }

  revalidatePath('/stock')
  revalidatePath('/products')
  revalidatePath(`/invoices/${input.invoiceId}`)
  return { ok: true }
}
