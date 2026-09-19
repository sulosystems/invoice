import PizZip from 'pizzip'
import Docxtemplater from 'docxtemplater'
import { formatMoney, type Invoice, type InvoiceLineItem } from './types'
import { slugifyFieldLabel } from './custom-fields'

export type FillDocxResult =
  | { ok: true; buffer: Buffer }
  | { ok: false; error: string }

/**
 * Fills a template's uploaded .docx with one invoice's real data. Shared by
 * the download route and the preview action so there is exactly one place
 * that knows the merge-tag shape — they can never drift apart.
 */
export function fillInvoiceDocx(
  docxBase64: string,
  invoice: Invoice,
  lines: InvoiceLineItem[]
): FillDocxResult {
  const grandTotal = lines.reduce((sum, l) => sum + Number(l.total), 0)

  try {
    const zip = new PizZip(Buffer.from(docxBase64, 'base64'))
    const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true })

    doc.render({
      invoice_number: invoice.number,
      created_date: new Date(invoice.created_at).toLocaleDateString('en-CA'),
      grand_total: formatMoney(grandTotal),
      notes: invoice.notes ?? '',
      lines: lines.map((l) => ({
        sr_number: l.sr_number,
        product: l.product,
        quantity: Number(l.quantity),
        unit_price: formatMoney(Number(l.unit_price)),
        invoice_date: l.invoice_date,
        delivery_date: l.delivery_date ?? '—',
        tax_rate: `${Number(l.tax_rate)}%`,
        total: formatMoney(Number(l.total)),
        supplier: l.supplier ?? '—',
        bill_ref_no: l.bill_ref_no ?? '—',
        rec_dept: l.rec_dept ?? '—',
        comments: l.comments ?? '—',
        // For a hand-uploaded template we don't know what tags it actually
        // contains, so this flattened string is the one universal escape
        // hatch: add {extra_fields} anywhere to show every custom field.
        extra_fields: (l.custom_fields ?? [])
          .map((f) => `${f.label}: ${f.value}`)
          .join('; '),
        // For a template THIS APP generated, each custom field also gets
        // its own real tag (e.g. {custom_s_no}) — buildInvoiceDocxTemplate
        // embeds the identical slug, so they line up. Harmless extra keys
        // for an uploaded template, which simply won't reference them.
        ...Object.fromEntries(
          (l.custom_fields ?? []).map((f) => [slugifyFieldLabel(f.label), f.value])
        ),
      })),
    })

    return { ok: true, buffer: doc.getZip().generate({ type: 'nodebuffer' }) }
  } catch (err) {
    // docxtemplater throws a MultiError whose .properties.errors lists each
    // problem tag — surface that instead of a bare failure, since the most
    // likely cause is a placeholder the user's edits in Word broke.
    const detail =
      err && typeof err === 'object' && 'properties' in err
        ? JSON.stringify((err as { properties?: unknown }).properties)
        : String(err)
    return {
      ok: false,
      error:
        'This template has a problem with its placeholders (often a {tag} that got split by editing in Word). Details: ' +
        detail,
    }
  }
}
