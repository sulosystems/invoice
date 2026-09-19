'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type ProductState = { error?: string; ok?: boolean }

export async function createProduct(
  _prev: ProductState,
  formData: FormData
): Promise<ProductState> {
  const name = String(formData.get('name') ?? '').trim()
  const sku = String(formData.get('sku') ?? '').trim()
  const unit = String(formData.get('unit') ?? '').trim() || 'ea'

  if (!name) return { error: 'Product name is required.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('products')
    .insert({ name, sku: sku || null, unit })

  if (error) {
    // 23505 = unique_violation, which here can only be the SKU index.
    if (error.code === '23505') return { error: `SKU "${sku}" already exists.` }
    return { error: error.message }
  }

  revalidatePath('/products')
  revalidatePath('/stock')
  return { ok: true }
}

/**
 * Corrects stock outside the invoice flow (count adjustments, write-offs,
 * opening balances). Same ledger, same rules — there is no second path that
 * mutates stock, which is why the numbers can't drift.
 */
export async function adjustStock(
  _prev: ProductState,
  formData: FormData
): Promise<ProductState> {
  const productId = String(formData.get('product_id') ?? '')
  const qty = Number(formData.get('qty'))
  const comment = String(formData.get('comment') ?? '').trim()

  if (!productId) return { error: 'Pick a product.' }
  if (!Number.isFinite(qty) || qty === 0) {
    return { error: 'Quantity must be a non-zero number.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('stock_moves').insert({
    product_id: productId,
    qty,
    comment: comment || null,
  })

  if (error) return { error: error.message }

  revalidatePath('/stock')
  revalidatePath('/products')
  return { ok: true }
}
