import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { TemplateForm } from '../template-form'

export default async function NewTemplatePage() {
  const supabase = await createClient()
  const { data } = await supabase.from('custom_field_labels').select('label').order('label')
  const availableCustomFields = (data ?? []).map((r) => r.label as string)

  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-500">
        Designing here gives you a fixed set of options (logo, colour, which
        columns show). For full control over layout — letterhead, signature
        blocks, anything Word can do —{' '}
        <Link href="/templates/new/docx" className="underline">
          upload a Word document instead
        </Link>
        .
      </p>
      <TemplateForm availableCustomFields={availableCustomFields} />
    </div>
  )
}
