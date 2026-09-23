import type { PostgrestError } from '@supabase/supabase-js'

const PAGE_SIZE = 1000

/**
 * PostgREST caps every response at 1000 rows, so a plain select silently
 * truncates larger tables. Pages through with .range() until a short page
 * comes back. `build` must return a fresh query each call and should order
 * by a unique column, or rows can repeat or go missing between pages.
 */
export async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: PostgrestError | null }>
): Promise<{ data: T[]; error: PostgrestError | null }> {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await build(from, from + PAGE_SIZE - 1)
    if (error) return { data: rows, error }
    rows.push(...(data ?? []))
    if (!data || data.length < PAGE_SIZE) return { data: rows, error: null }
  }
}
