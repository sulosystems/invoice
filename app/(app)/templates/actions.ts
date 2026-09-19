'use server'

import { revalidatePath } from 'next/cache'
import PizZip from 'pizzip'
import Docxtemplater from 'docxtemplater'
import { createClient } from '@/lib/supabase/server'
import type { TemplateLayout } from '@/lib/types'

export type TemplateResult = { id?: string; error?: string; ok?: boolean }

/** Sets (or clears) the one allowed default template before an insert/update. */
async function clearExistingDefault(
  supabase: Awaited<ReturnType<typeof createClient>>,
  isDefault: boolean
) {
  if (isDefault) {
    await supabase.from('templates').update({ is_default: false }).eq('is_default', true)
  }
}

export async function saveTemplate(input: {
  id?: string
  name: string
  layout: TemplateLayout
  isDefault: boolean
}): Promise<TemplateResult> {
  const name = input.name.trim()
  if (!name) return { error: 'Template name is required.' }

  const supabase = await createClient()

  // Only one template may be default (a partial unique index enforces it in
  // the DB too); clear the old one first so this insert/update doesn't collide.
  await clearExistingDefault(supabase, input.isDefault)

  // A template is one type or the other — saving via the builder always
  // clears any docx a previous save left behind, so the two never coexist.
  if (input.id) {
    const { error } = await supabase
      .from('templates')
      .update({ name, layout: input.layout, is_default: input.isDefault, docx_base64: null })
      .eq('id', input.id)
    if (error) return { error: error.message }
    revalidatePath('/templates')
    revalidatePath('/invoices')
    return { id: input.id }
  }

  const { data, error } = await supabase
    .from('templates')
    .insert({ name, layout: input.layout, is_default: input.isDefault, docx_base64: null })
    .select('id')
    .single()

  if (error) return { error: error.message }
  revalidatePath('/templates')
  return { id: data.id }
}

/**
 * Saves an uploaded Word (.docx) document as a template. Validated by
 * actually opening it with the same library that later fills it in — a
 * corrupt or non-.docx upload fails here with a clear message, not silently
 * later when someone tries to print an invoice against it.
 */
export async function saveDocxTemplate(input: {
  id?: string
  name: string
  docxBase64: string
  isDefault: boolean
}): Promise<TemplateResult> {
  const name = input.name.trim()
  if (!name) return { error: 'Template name is required.' }

  try {
    const zip = new PizZip(Buffer.from(input.docxBase64, 'base64'))
    // Constructing it is the validation — throws on a corrupt/non-docx file.
    void new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true })
  } catch {
    return {
      error:
        "That doesn't look like a valid Word document — try re-saving it from Word as .docx and upload it again.",
    }
  }

  const supabase = await createClient()
  await clearExistingDefault(supabase, input.isDefault)

  const row = {
    name,
    docx_base64: input.docxBase64,
    is_default: input.isDefault,
    layout: {}, // this template renders as a Word doc, not the HTML builder
  }

  if (input.id) {
    const { error } = await supabase.from('templates').update(row).eq('id', input.id)
    if (error) return { error: error.message }
    revalidatePath('/templates')
    revalidatePath('/invoices')
    return { id: input.id }
  }

  const { data, error } = await supabase
    .from('templates')
    .insert(row)
    .select('id')
    .single()

  if (error) return { error: error.message }
  revalidatePath('/templates')
  return { id: data.id }
}

export async function deleteTemplate(id: string): Promise<TemplateResult> {
  const supabase = await createClient()
  // invoices.template_id is ON DELETE SET NULL, so invoices using this
  // template just fall back to the default columns/no logo — never blocked.
  const { error } = await supabase.from('templates').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/templates')
  revalidatePath('/invoices')
  return { ok: true }
}
