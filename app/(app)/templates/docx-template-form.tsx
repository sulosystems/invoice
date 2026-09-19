'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { Template } from '@/lib/types'
import { saveDocxTemplate } from './actions'

const input =
  'w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900'

const MAX_DOCX_BYTES = 5_000_000 // ~5MB — plenty for a letterhead + a table

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      // FileReader's data: URL is "data:<mime>;base64,<data>" — we only want
      // the base64 payload; docxtemplater reads raw bytes, not a data URI.
      const result = String(reader.result)
      resolve(result.slice(result.indexOf(',') + 1))
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export function DocxTemplateForm({ initial }: { initial?: Template }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [fileWarning, setFileWarning] = useState<string | null>(null)

  const [name, setName] = useState(initial?.name ?? '')
  const [isDefault, setIsDefault] = useState(initial?.is_default ?? false)
  const [fileName, setFileName] = useState<string | null>(
    initial?.docx_base64 ? 'Currently uploaded document' : null
  )
  const [docxBase64, setDocxBase64] = useState<string | null>(
    initial?.docx_base64 ?? null
  )

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)
    setFileWarning(
      file.size > MAX_DOCX_BYTES
        ? `That's ${Math.round(file.size / 1_000_000)}MB — it's stored inline in the database, so keep it well under a few MB.`
        : null
    )
    setFileName(file.name)
    setDocxBase64(await readAsBase64(file))
  }

  function save() {
    setError(null)
    if (!docxBase64) {
      setError('Upload a .docx file first.')
      return
    }
    startTransition(async () => {
      const result = await saveDocxTemplate({
        id: initial?.id,
        name,
        docxBase64,
        isDefault,
      })
      if (result.error) {
        setError(result.error)
        return
      }
      router.push('/templates')
    })
  }

  return (
    <div className="max-w-xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight">
          {initial ? 'Edit Word template' : 'Upload a Word template'}
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

      <section className="space-y-2 rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm">
        <p className="font-medium">How this works</p>
        <ol className="list-inside list-decimal space-y-1 text-neutral-600">
          <li>
            {initial?.docx_base64 ? (
              <>
                <a
                  href={`/templates/${initial.id}/docx`}
                  className="text-neutral-900 underline underline-offset-2"
                >
                  Download this template&apos;s current file
                </a>{' '}
                to keep editing it — or start fresh from{' '}
                <a
                  href="/templates/base-invoice-template.docx"
                  download
                  className="text-neutral-900 underline underline-offset-2"
                >
                  the blank base template
                </a>
                .
              </>
            ) : (
              <>
                <a
                  href="/templates/base-invoice-template.docx"
                  download
                  className="text-neutral-900 underline underline-offset-2"
                >
                  Download the base template
                </a>{' '}
                — a plain Word document with placeholders already in it.
              </>
            )}
          </li>
          <li>
            Open it in Word and design around it: add your letterhead, logo,
            signature block, extra static text — anything. Leave the{' '}
            <code className="rounded bg-white px-1 py-0.5">{'{curly-brace}'}</code>{' '}
            placeholders where they are; those are what get filled in per
            invoice.
          </li>
          <li>Save it, and upload the result below.</li>
        </ol>
      </section>

      <label className="block text-sm font-medium text-neutral-500">
        Template name
        <input
          className={`${input} mt-1`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Chemistry department letterhead"
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

      <section className="space-y-2">
        <label className="block text-sm font-medium text-neutral-500">
          Your edited .docx
        </label>
        <input
          type="file"
          accept=".docx"
          onChange={onFileChange}
          className="text-sm"
        />
        {fileName && (
          <p className="text-sm text-neutral-600">
            {fileName}
            {initial?.docx_base64 && docxBase64 === initial.docx_base64 && (
              <>
                {' '}
                —{' '}
                <a
                  href={`/templates/${initial.id}/docx`}
                  className="underline underline-offset-2 hover:text-neutral-900"
                >
                  download it
                </a>
              </>
            )}
          </p>
        )}
        {fileWarning && <p className="text-xs text-amber-700">{fileWarning}</p>}
      </section>
    </div>
  )
}
