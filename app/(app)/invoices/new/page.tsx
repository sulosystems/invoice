import { createClient } from '@/lib/supabase/server'
import { InvoiceEditor } from '../invoice-editor'

export default async function NewInvoicePage() {
  const supabase = await createClient()
  const { data } = await supabase.from('custom_field_labels').select('label').order('label')
  const availableCustomFields = (data ?? []).map((r) => r.label as string)

  return <InvoiceEditor availableCustomFields={availableCustomFields} />
}
