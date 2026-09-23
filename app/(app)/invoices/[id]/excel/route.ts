import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildInvoiceWorkbook } from '@/lib/build-invoice-workbook'
import type { Invoice, InvoiceLineItem } from '@/lib/types'

/**
 * Builds this invoice's line items into an .xlsx and returns it as a
 * downloadable file. Route Handlers are reachable directly (the (app)
 * layout's auth redirect never runs for them), so auth is re-checked here —
 * same rule as every Server Action and the Word-download route.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
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

  const { data: lineItems } = await supabase
    .from('invoice_line_items')
    .select('*')
    .eq('invoice_id', id)
    .order('sr_number')

  const lines = (lineItems ?? []) as InvoiceLineItem[]
  const buffer = await buildInvoiceWorkbook(invoice, lines)

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${invoice.number}.xlsx"`,
    },
  })
}
