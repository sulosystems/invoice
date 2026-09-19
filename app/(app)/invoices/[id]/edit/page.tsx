import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Invoice, InvoiceLineItem } from '@/lib/types'
import { InvoiceEditor } from '../../invoice-editor'

export default async function EditInvoicePage(props: PageProps<'/invoices/[id]/edit'>) {
  const { id } = await props.params
  const supabase = await createClient()

  const [{ data: invoice }, { data: lineItems }] = await Promise.all([
    supabase.from('invoices').select('*').eq('id', id).maybeSingle(),
    supabase.from('invoice_line_items').select('*').eq('invoice_id', id).order('sr_number'),
  ])

  if (!invoice) notFound()

  return (
    <InvoiceEditor
      initial={{
        invoice: invoice as Invoice,
        lines: (lineItems ?? []) as InvoiceLineItem[],
      }}
    />
  )
}
