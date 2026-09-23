import { createClient } from '@/lib/supabase/server'
import { DeleteFieldButton } from './delete-field-button'

type CustomFieldUsage = { label: string; line_item_count: number }

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('custom_field_usage')
    .select('*')
    .order('label')

  const fields = (data ?? []) as CustomFieldUsage[]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Manage self-service custom fields added via &ldquo;+ Add field&rdquo;
          on invoices.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-neutral-500">Custom fields</h2>

        {error && (
          <p className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
            {error.message}
          </p>
        )}

        {fields.length === 0 ? (
          <p className="rounded-lg border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500">
            No custom fields have been added to any invoice yet.
          </p>
        ) : (
          <div className="divide-y divide-neutral-100 rounded-lg border border-neutral-200">
            {fields.map((f) => (
              <div key={f.label} className="flex items-center gap-4 px-4 py-3">
                <div className="flex-1">
                  <p className="text-sm font-medium">{f.label}</p>
                  <p className="text-xs text-neutral-500">
                    Used on {f.line_item_count} line item
                    {f.line_item_count === 1 ? '' : 's'}
                  </p>
                </div>
                <DeleteFieldButton label={f.label} count={f.line_item_count} />
              </div>
            ))}
          </div>
        )}

        <p className="text-xs text-neutral-400">
          Deleting a field removes it from every line item that currently has
          it, across every invoice — it does not undo anything else on those
          invoices, and it can&apos;t be undone. A template that had this
          field checked under &ldquo;Custom fields to print&rdquo; just stops
          finding any data for it; nothing breaks.
        </p>
      </section>
    </div>
  )
}
