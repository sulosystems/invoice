'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { fetchAll } from '@/lib/supabase/fetch-all'
import type { CustomField } from '@/lib/types'

export type DeleteFieldResult = { ok?: boolean; error?: string; removedFrom?: number }

/**
 * Removes a custom field, by label, from every line item that has it —
 * across every invoice. There's no separate "field" record to delete
 * (custom fields are just {label, value} entries on each line item), so
 * deleting one means stripping that entry everywhere it appears.
 *
 * Done in the app rather than a single SQL statement: Postgres has no
 * built-in "remove the array element matching a key" jsonb operator, and a
 * loop here is simple, correct, and fine at this app's scale.
 */
export async function deleteCustomField(label: string): Promise<DeleteFieldResult> {
  const trimmed = label.trim()
  if (!trimmed) return { error: 'No field label given.' }

  const supabase = await createClient()

  const { data: affected, error: fetchError } = await fetchAll<{ id: string; custom_fields: CustomField[] }>(
    (from, to) =>
      supabase
        .from('invoice_line_items')
        .select('id, custom_fields')
        // A string, not an array: supabase-js renders arrays as a Postgres
        // array literal, which is wrong for a jsonb column.
        .contains('custom_fields', JSON.stringify([{ label: trimmed }]))
        .order('id')
        .range(from, to)
  )

  if (fetchError) return { error: fetchError.message }

  for (const row of affected) {
    const nextFields = ((row.custom_fields ?? []) as CustomField[]).filter(
      (f) => f.label !== trimmed
    )
    const { error } = await supabase
      .from('invoice_line_items')
      .update({ custom_fields: nextFields })
      .eq('id', row.id)
    if (error) return { error: error.message }
  }

  revalidatePath('/settings')
  revalidatePath('/invoices')
  revalidatePath('/templates')
  return { ok: true, removedFrom: affected.length }
}
