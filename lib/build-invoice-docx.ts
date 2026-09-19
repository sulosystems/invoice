import PizZip from 'pizzip'
import { INVOICE_COLUMNS, COLUMN_MERGE_TAGS, type ColumnKey } from './invoice-columns'
import { slugifyFieldLabel } from './custom-fields'

/**
 * Generates a Word template on the fly for a builder-type template (one
 * made with the column/logo/colour UI, which never had an uploaded .docx to
 * begin with) — so "Download template" has something real to hand back for
 * every template, not just ones someone already uploaded.
 *
 * Mirrors the hand-authored public/templates/base-invoice-template.docx:
 * same minimal valid OOXML skeleton, but only the columns this specific
 * template actually selected, and its header/footer text baked in.
 *
 * Each selected custom field gets its own real column and its own merge
 * tag (via slugifyFieldLabel), same as a fixed column — this is only
 * possible because this file generates both the template AND controls the
 * fill step (fillInvoiceDocx), so the two can agree on tag names. An
 * uploaded template can't get this: we don't know what tags a hand-edited
 * Word file actually contains, so those still only get the one flattened
 * `{extra_fields}` catch-all.
 *
 * Known limit: the template's logo isn't embedded. Putting an image inside
 * hand-built OOXML needs a media part + drawing XML + relationship wiring —
 * real scope, not a quick add — so a logo has to be added by hand in Word
 * after downloading.
 */
export function buildInvoiceDocxTemplate({
  columns,
  customColumns = [],
  headerText,
  footerText,
}: {
  columns: ColumnKey[]
  customColumns?: string[]
  headerText?: string
  footerText?: string
}): Buffer {
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`

  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`

  const docRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`

  const coreProps = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>Invoice Template</dc:title>
  <dc:creator>Invoice Creator</dc:creator>
</cp:coreProperties>`

  const appProps = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
  <Application>Invoice Creator</Application>
</Properties>`

  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/></w:rPr></w:rPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:basedOn w:val="Normal"/>
    <w:rPr><w:b/><w:sz w:val="36"/></w:rPr>
  </w:style>
</w:styles>`

  const escapeXml = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  const labelFor = (key: ColumnKey) => INVOICE_COLUMNS.find((c) => c.key === key)!.label

  const tableColumns: { label: string; tag: string }[] = [
    ...columns.map((key) => ({ label: labelFor(key), tag: COLUMN_MERGE_TAGS[key] })),
    ...customColumns.map((label) => ({ label, tag: slugifyFieldLabel(label) })),
  ]

  // Safety net only: a template with nothing at all selected (no fixed
  // columns, no custom fields) still needs a non-empty table, or the
  // generated .docx would be structurally invalid — fall back to the one
  // flattened catch-all tag in that specific corner case.
  if (tableColumns.length === 0) {
    tableColumns.push({ label: 'Extra fields', tag: 'extra_fields' })
  }

  const gridCols = tableColumns.map(() => `<w:gridCol w:w="1500"/>`).join('')

  const headerRow = `<w:tr>${tableColumns
    .map(
      (c) => `
    <w:tc>
      <w:tcPr><w:shd w:val="clear" w:fill="E7E7E7"/></w:tcPr>
      <w:p><w:r><w:rPr><w:b/><w:sz w:val="16"/></w:rPr><w:t xml:space="preserve">${escapeXml(c.label)}</w:t></w:r></w:p>
    </w:tc>`
    )
    .join('')}</w:tr>`

  // Loop convention: {#lines} opens at the start of the first cell's text,
  // {/lines} closes at the end of the last cell's — docxtemplater then
  // repeats the whole row once per line item.
  const bodyRow = `<w:tr>${tableColumns
    .map((c, i) => {
      const tag = `{${c.tag}}`
      const text = `${i === 0 ? '{#lines}' : ''}${tag}${i === tableColumns.length - 1 ? '{/lines}' : ''}`
      return `
    <w:tc>
      <w:p><w:r><w:rPr><w:sz w:val="16"/></w:rPr><w:t xml:space="preserve">${text}</w:t></w:r></w:p>
    </w:tc>`
    })
    .join('')}</w:tr>`

  const footerParagraph = footerText
    ? `<w:p/><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:i/><w:color w:val="888888"/><w:sz w:val="16"/></w:rPr><w:t xml:space="preserve">${escapeXml(footerText)}</w:t></w:r></w:p>`
    : ''

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>${escapeXml(headerText || 'Purchase Invoice')}</w:t></w:r></w:p>
    <w:p><w:r><w:t xml:space="preserve">Invoice ID: {invoice_number}</w:t></w:r></w:p>
    <w:p><w:r><w:t xml:space="preserve">Date: {created_date}</w:t></w:r></w:p>
    <w:p/>
    <w:tbl>
      <w:tblPr>
        <w:tblW w:w="0" w:type="auto"/>
        <w:tblBorders>
          <w:top w:val="single" w:sz="4" w:color="999999"/>
          <w:left w:val="single" w:sz="4" w:color="999999"/>
          <w:bottom w:val="single" w:sz="4" w:color="999999"/>
          <w:right w:val="single" w:sz="4" w:color="999999"/>
          <w:insideH w:val="single" w:sz="4" w:color="999999"/>
          <w:insideV w:val="single" w:sz="4" w:color="999999"/>
        </w:tblBorders>
      </w:tblPr>
      <w:tblGrid>${gridCols}</w:tblGrid>
      ${headerRow}
      ${bodyRow}
    </w:tbl>
    <w:p/>
    <w:p><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">Grand total: {grand_total}</w:t></w:r></w:p>
    <w:p/>
    <w:p><w:r><w:t xml:space="preserve">Notes: {notes}</w:t></w:r></w:p>
    ${footerParagraph}
  </w:body>
</w:document>`

  const zip = new PizZip()
  zip.file('[Content_Types].xml', contentTypes)
  zip.file('_rels/.rels', rootRels)
  zip.file('docProps/core.xml', coreProps)
  zip.file('docProps/app.xml', appProps)
  zip.file('word/document.xml', documentXml)
  zip.file('word/_rels/document.xml.rels', docRels)
  zip.file('word/styles.xml', styles)

  return zip.generate({ type: 'nodebuffer' })
}
