/**
 * Turns a custom field's label ("S. No") into a merge-tag-safe identifier
 * ("custom_s_no"). Shared between generating a builder template's .docx
 * (which embeds `{custom_s_no}`) and filling it in (which must produce a
 * key by the exact same name) — they'd silently stop matching otherwise.
 *
 * Known limit: two labels that differ only in case/punctuation ("S. No"
 * and "S No") slugify to the same tag and would collide. Not handled —
 * rename one of them if that ever comes up.
 */
export function slugifyFieldLabel(label: string): string {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return `custom_${slug || 'field'}`
}
