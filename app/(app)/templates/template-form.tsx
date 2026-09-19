'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { Template, TemplateLayout } from '@/lib/types'
import { INVOICE_COLUMNS, ALL_COLUMN_KEYS, type ColumnKey } from '@/lib/invoice-columns'
import { saveTemplate } from './actions'

const input =
  'w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900'

const MAX_LOGO_BYTES = 500_000 // ~500KB — it's embedded inline, not stored as a file

export function TemplateForm({
  initial,
  availableCustomFields = [],
}: {
  initial?: Template
  /** Every distinct custom-field label used on any invoice so far. */
  availableCustomFields?: string[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState(initial?.name ?? '')
  const [headerText, setHeaderText] = useState(initial?.layout.headerText ?? '')
  const [footerText, setFooterText] = useState(initial?.layout.footerText ?? '')
  const [accentColor, setAccentColor] = useState(initial?.layout.accentColor ?? '#171717')
  const [logoUrl, setLogoUrl] = useState(initial?.layout.logoUrl ?? '')
  const [isDefault, setIsDefault] = useState(initial?.is_default ?? false)
  const [logoWarning, setLogoWarning] = useState<string | null>(null)

  // Distinguish "never configured" (undefined — show everything, the
  // backward-compatible default) from "explicitly chose zero" (a real,
  // saved empty array) — treating them the same was the bug where
  // deliberately unchecking every column silently fell back to showing all
  // of them instead of the none that was actually chosen.
  const initialColumns = useMemo(
    () => new Set(initial?.layout.columns !== undefined ? initial.layout.columns : ALL_COLUMN_KEYS),
    [initial]
  )
  const [columns, setColumns] = useState<Set<ColumnKey>>(initialColumns)

  const initialCustomColumns = useMemo(
    () =>
      new Set(
        initial?.layout.customColumns !== undefined
          ? initial.layout.customColumns
          : availableCustomFields
      ),
    [initial, availableCustomFields]
  )
  const [customColumns, setCustomColumns] = useState<Set<string>>(initialCustomColumns)

  function toggleColumn(key: ColumnKey) {
    setColumns((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function toggleCustomColumn(label: string) {
    setCustomColumns((prev) => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })
  }

  function onLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setLogoWarning(
      file.size > MAX_LOGO_BYTES
        ? `That's ${Math.round(file.size / 1024)}KB — logos are embedded directly in the template, so keep it under ~500KB for a snappy invoice page.`
        : null
    )

    const reader = new FileReader()
    reader.onload = () => setLogoUrl(String(reader.result))
    reader.readAsDataURL(file)
  }

  function save() {
    setError(null)
    const layout: TemplateLayout = {
      headerText: headerText.trim() || undefined,
      footerText: footerText.trim() || undefined,
      logoUrl: logoUrl || undefined,
      accentColor,
      // Preserve the canonical order regardless of which checkboxes were clicked.
      columns: INVOICE_COLUMNS.map((c) => c.key).filter((k) => columns.has(k)),
      customColumns: availableCustomFields.filter((label) => customColumns.has(label)),
    }

    startTransition(async () => {
      const result = await saveTemplate({ id: initial?.id, name, layout, isDefault })
      if (result.error) {
        setError(result.error)
        return
      }
      router.push('/templates')
    })
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight">
          {initial ? 'Edit template' : 'New template'}
        </h1>
        <button
          onClick={save}
          disabled={pending}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:opacity-50"
        >
          {pending ? 'Saving…' : 'Save template'}
        </button>
      </div>

      {error && (
        <p className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-6">
          <section className="space-y-3">
            <label className="block text-sm font-medium text-neutral-500">
              Template name
              <input
                className={`${input} mt-1`}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Standard purchase invoice"
              />
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
              />
              Use as the default template
            </label>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-medium text-neutral-500">Logo</h2>
            <input type="file" accept="image/*" onChange={onLogoChange} className="text-sm" />
            {logoWarning && <p className="text-xs text-amber-700">{logoWarning}</p>}
            {logoUrl && (
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logoUrl} alt="Logo preview" className="h-14 w-auto rounded border border-neutral-200" />
                <button
                  onClick={() => setLogoUrl('')}
                  className="text-sm text-neutral-500 underline hover:text-red-600"
                >
                  Remove
                </button>
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-medium text-neutral-500">Header &amp; footer</h2>
            <input
              className={input}
              placeholder='Header title (default: "Purchase Invoice")'
              value={headerText}
              onChange={(e) => setHeaderText(e.target.value)}
            />
            <textarea
              className={input}
              rows={2}
              placeholder="Footer text (optional) — printed at the bottom of every invoice"
              value={footerText}
              onChange={(e) => setFooterText(e.target.value)}
            />
            <label className="flex items-center gap-2 text-sm">
              Accent color
              <input
                type="color"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                className="h-8 w-14 rounded border border-neutral-300"
              />
            </label>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-medium text-neutral-500">
              Columns to print
            </h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {INVOICE_COLUMNS.map((c) => (
                <label key={c.key} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={columns.has(c.key)}
                    onChange={() => toggleColumn(c.key)}
                  />
                  {c.label}
                </label>
              ))}
            </div>
          </section>

          {availableCustomFields.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-medium text-neutral-500">
                Custom fields to print
              </h2>
              <p className="text-xs text-neutral-400">
                Fields added via &ldquo;+ Add field&rdquo; on any invoice so far.
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {availableCustomFields.map((label) => (
                  <label key={label} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={customColumns.has(label)}
                      onChange={() => toggleCustomColumn(label)}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* ------------------------------------------------------ preview */}
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-neutral-500">Preview</h2>
          <div className="rounded-lg border border-neutral-200 bg-white p-6">
            <div
              className="flex items-start justify-between gap-4 border-b-2 pb-4"
              style={{ borderColor: accentColor }}
            >
              <div>
                {logoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoUrl} alt="" className="mb-2 h-10 w-auto" />
                )}
                <p className="text-lg font-semibold" style={{ color: accentColor }}>
                  {headerText || 'Purchase Invoice'}
                </p>
              </div>
              <p className="font-mono text-xs text-neutral-500">INV-0001</p>
            </div>
            <table className="mt-4 w-full text-xs">
              <thead>
                <tr className="border-b border-neutral-300 text-left">
                  {INVOICE_COLUMNS.filter((c) => columns.has(c.key)).map((c) => (
                    <th key={c.key} className="whitespace-nowrap py-1.5 pr-3 font-medium">
                      {c.label}
                    </th>
                  ))}
                  {availableCustomFields
                    .filter((label) => customColumns.has(label))
                    .map((label) => (
                      <th key={label} className="whitespace-nowrap py-1.5 pr-3 font-medium">
                        {label}
                      </th>
                    ))}
                </tr>
              </thead>
              <tbody>
                <tr className="text-neutral-400">
                  {INVOICE_COLUMNS.filter((c) => columns.has(c.key)).map((c) => (
                    <td key={c.key} className="whitespace-nowrap py-2 pr-3">
                      —
                    </td>
                  ))}
                  {availableCustomFields
                    .filter((label) => customColumns.has(label))
                    .map((label) => (
                      <td key={label} className="whitespace-nowrap py-2 pr-3">
                        —
                      </td>
                    ))}
                </tr>
              </tbody>
            </table>
            {footerText && (
              <p className="mt-4 text-center text-[10px] text-neutral-400">{footerText}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
