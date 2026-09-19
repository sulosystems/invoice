import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Template } from '@/lib/types'
import { TemplateForm } from '../template-form'
import { DocxTemplateForm } from '../docx-template-form'

export default async function EditTemplatePage(
  props: PageProps<'/templates/[id]'>
) {
  const { id } = await props.params

  const supabase = await createClient()
  const [{ data }, { data: labelRows }] = await Promise.all([
    supabase.from('templates').select('*').eq('id', id).maybeSingle(),
    supabase.from('custom_field_labels').select('label').order('label'),
  ])

  if (!data) notFound()

  const template = data as Template
  const availableCustomFields = (labelRows ?? []).map((r) => r.label as string)

  // A template is one type or the other — docx_base64 says which.
  return template.docx_base64 ? (
    <DocxTemplateForm initial={template} />
  ) : (
    <TemplateForm initial={template} availableCustomFields={availableCustomFields} />
  )
}
