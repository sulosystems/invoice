import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fillInvoiceDocx } from '@/lib/fill-invoice-docx'
import type { Invoice, InvoiceLineItem, Template } from '@/lib/types'

/**
 * Fills the invoice's Word template with this invoice's data and returns the
 * result as a downloadable .docx. Route Handlers are reachable directly (the
 * (app) layout's auth redirect never runs for them), so auth is re-checked
 * here — same rule as every Server Action in this app.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const requestedTemplateId = request.nextUrl.searchParams.get('template')

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  }

  const { data: invoiceRow } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (!invoiceRow) {
    return NextResponse.json({ error: 'Invoice not found.' }, { status: 404 })
  }
  const invoice = invoiceRow as Invoice

  // Same resolution order as the invoice page: an explicit ?template=
  // override, then whatever's assigned to the invoice, then the default.
  const resolvedId = requestedTemplateId || invoice.template_id
  let template: Template | null = null
  if (resolvedId) {
    const { data } = await supabase
      .from('templates')
      .select('*')
      .eq('id', resolvedId)
      .maybeSingle()
    template = data as Template | null
  }
  if (!template?.docx_base64) {
    const { data } = await supabase
      .from('templates')
      .select('*')
      .eq('is_default', true)
      .maybeSingle()
    if ((data as Template | null)?.docx_base64) template = data as Template
  }

  if (!template?.docx_base64) {
    return NextResponse.json(
      {
        error:
          'This invoice has no Word template assigned, and there is no default Word template. Upload one under Templates, or pick one for this invoice.',
      },
      { status: 400 }
    )
  }

  const { data: lineItems } = await supabase
    .from('invoice_line_items')
    .select('*')
    .eq('invoice_id', id)
    .order('sr_number')

  const lines = (lineItems ?? []) as InvoiceLineItem[]
  const result = fillInvoiceDocx(template.docx_base64, invoice, lines)

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 422 })
  }

  return new NextResponse(new Uint8Array(result.buffer), {
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${invoice.number}.docx"`,
    },
  })
}
