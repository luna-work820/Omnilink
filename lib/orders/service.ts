import { createClientServer } from '@/lib/supabase/server'
import type { OrderConfirmationDTO, OrderSubmissionPayload } from './types'

export function createOrderIdentity(): { orderId: string; orderNumber: string } {
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = Math.floor(1000 + Math.random() * 9000)
  return {
    orderId: crypto.randomUUID(),
    orderNumber: `ORD-${timestamp}-${random}`,
  }
}

/** Owns persisted storefront inquiry creation and authoritative pricing. */
export async function submitStorefrontInquiry(
  payload: OrderSubmissionPayload
): Promise<{ orderId: string; orderNumber: string }> {
  const supabase = await createClientServer()
  const { orderId, orderNumber } = createOrderIdentity()
  const { error } = await supabase.rpc('submit_storefront_inquiry', {
    p_order_id: orderId,
    p_order_number: orderNumber,
    p_store_slug: payload.storeSlug,
    p_customer: payload.customer,
    p_items: payload.items,
  })

  if (error) throw new Error('Could not save the inquiry. Please try again.')
  return { orderId, orderNumber }
}

/** Owns the public, store-scoped confirmation projection for persisted orders. */
export async function getStorefrontOrderConfirmation(
  storeSlug: string,
  orderId: string
): Promise<OrderConfirmationDTO | null> {
  try {
    const supabase = await createClientServer()
    const { data, error } = await supabase.rpc('get_public_order_confirmation', {
      p_store_slug: storeSlug,
      p_order_id: orderId,
    })

    if (error || !data || typeof data !== 'object' || Array.isArray(data)) return null
    return data as unknown as OrderConfirmationDTO
  } catch (err) {
    console.error('getStorefrontOrderConfirmation error:', err)
    return null
  }
}
