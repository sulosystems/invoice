import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import type { Template } from '@/lib/types'
import { DeleteButton } from './delete-button'
import { DownloadMenu } from './download-menu'

export default async function TemplatesPage() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('templates')
    .select('*')
    .order('created_at', { ascending: false })

  const templates = (data ?? []) as Template[]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Templates</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Design what a printed invoice looks like — logo, header/footer text,
            colour, and which columns show.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DownloadMenu templates={templates} />
          <Link
            href="/templates/new"
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-700"
          >
            New template
          </Link>
        </div>
      </div>

      <p className="text-sm text-neutral-500">
        Want full control over the layout — letterhead, signatures, anything
        Word can do? Use <strong>Download template</strong> above to grab
        either the blank starter or one you&apos;ve already uploaded, design
        around its placeholders in Word, then{' '}
        <Link href="/templates/new/docx" className="underline">
          upload the result as a template
        </Link>
        .
      </p>

      {error && (
        <p className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error.message}
        </p>
      )}

      {templates.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500">
          No templates yet — invoices print with every column and no logo
          until you make one.
        </p>
      ) : (
        <div className="divide-y divide-neutral-100 rounded-lg border border-neutral-200">
          {templates.map((t) => (
            <div key={t.id} className="flex items-center gap-4 px-4 py-3">
              {t.docx_base64 ? (
                <div className="flex h-8 w-8 items-center justify-center rounded border border-neutral-200 text-xs font-medium text-neutral-500">
                  DOC
                </div>
              ) : t.layout.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={t.layout.logoUrl}
                  alt=""
                  className="h-8 w-auto rounded border border-neutral-200"
                />
              ) : (
                <div className="h-8 w-8 rounded border border-dashed border-neutral-200" />
              )}
              <div className="flex-1">
                <p className="text-sm font-medium">{t.name}</p>
                <p className="text-xs text-neutral-500">
                  {t.docx_base64
                    ? 'Uploaded Word document'
                    : `${t.layout.columns?.length ?? 12} of 12 columns`}
                  {t.is_default && (
                    <span className="ml-2 rounded bg-neutral-900 px-1.5 py-0.5 text-[10px] font-medium text-white">
                      DEFAULT
                    </span>
                  )}
                </p>
              </div>
              {t.docx_base64 && (
                <a
                  href={`/templates/${t.id}/docx`}
                  className="text-sm text-neutral-600 underline-offset-2 hover:underline"
                >
                  Download
                </a>
              )}
              <Link
                href={`/templates/${t.id}`}
                className="text-sm text-neutral-600 underline-offset-2 hover:underline"
              >
                Edit
              </Link>
              <DeleteButton id={t.id} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
