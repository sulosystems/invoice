import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildInvoiceDocxTemplate } from '@/lib/build-invoice-docx'
import { ALL_COLUMN_KEYS } from '@/lib/invoice-columns'
import type { Template } from '@/lib/types'

/**
 * Downloads a Word file for this template:
 *  - if it's an uploaded Word template, the actual .docx currently stored —
 *    so someone can keep editing a file they (or a colleague) already made,
 *    not just start fresh from the blank base file.
 *  - if it's a builder template (column/logo/colour UI, never had a .docx),
 *    one is generated on the fly using its actual column selection and
 *    header/footer text — every template is downloadable, not only ones
 *    someone happened to upload.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  }

  const { data } = await supabase.from('templates').select('*').eq('id', id).maybeSingle()
  const template = data as Template | null

  if (!template) {
    return NextResponse.json({ error: 'Template not found.' }, { status: 404 })
  }

  const safeName = template.name.replace(/[^a-z0-9-_ ]/gi, '').trim() || 'template'

  // undefined (never configured) means every fixed column; a real saved
  // array (even []) is respected exactly, so deliberately hiding every
  // fixed column actually generates a document with none of them. Custom
  // fields default to none here (unlike an invoice's own printed view) —
  // there's no specific invoice's data to fall back to showing at
  // template-download time, only whatever was explicitly checked.
  const buffer = template.docx_base64
    ? Buffer.from(template.docx_base64, 'base64')
    : buildInvoiceDocxTemplate({
        columns: template.layout.columns !== undefined ? template.layout.columns : ALL_COLUMN_KEYS,
        customColumns: template.layout.customColumns ?? [],
        headerText: template.layout.headerText,
        footerText: template.layout.footerText,
      })

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${safeName}.docx"`,
    },
  })
}
