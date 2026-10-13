'use server'

import type {
  OrderSubmissionPayload,
  OrderConfirmationDTO,
  OrderConfirmationItem,
} from '@/lib/orders/types'
import { getPublishedStore } from '@/lib/storefront/service'
import {
  createOrderIdentity,
  getStorefrontOrderConfirmation,
  submitStorefrontInquiry,
} from '@/lib/orders/service'
import { DEMO_PRODUCTS } from '@/lib/products/demo-data'
import { productsList as CONSUMER_MARKET_DEMO_PRODUCTS } from '@/components/consumer-market/data/mockData'

// The database-free demo store has no persisted order records.
const memoryOrders = new Map<string, OrderConfirmationDTO>()

export async function submitOrderInquiryAction(
  payload: OrderSubmissionPayload
): Promise<{
  success: boolean
  orderId?: string
  orderNumber?: string
  error?: string
}> {
  try {
    const { storeSlug, customer, items } = payload

    if (!storeSlug || !customer?.name || !customer?.email || !items || items.length === 0) {
      return { success: false, error: 'Missing required customer or items information' }
    }

    // 1. Verify Store Existence
    const store = await getPublishedStore(storeSlug)
    if (!store) {
      return { success: false, error: 'Store not found or inactive' }
    }

    if (store.id !== 'demo-store') {
      const { orderId, orderNumber } = await submitStorefrontInquiry(payload)
      return { success: true, orderId, orderNumber }
    }

    // Demo orders have no database catalog; calculate from static demo data.
    const orderItemsToInsert: Array<{
      product_id: string | null
      variant_id: string | null
      product_name_snapshot: string
      sku_snapshot: string | null
      quantity: number
      unit_price_snapshot: number
      currency: string
      selected_options: Record<string, string>
    }> = []

    let calculatedSubtotal = 0
    const currency = store.currency || 'USD'

    for (const item of items) {
      const qty = Math.max(1, Math.floor(Number(item.quantity) || 1))

      let productName = 'Product'
      let unitPrice = 0
      let sku: string | null = null
      let itemCurrency = currency

      const foundDemoProd = DEMO_PRODUCTS.find((product) => product.id === item.productId)
      const foundConsumerDemoProd = CONSUMER_MARKET_DEMO_PRODUCTS.find(
        (product) => product.id === item.productId
      )

      if (foundDemoProd) {
        productName = foundDemoProd.name
        unitPrice = foundDemoProd.price
        itemCurrency = foundDemoProd.currency
        sku = foundDemoProd.sku
      } else if (foundConsumerDemoProd) {
        productName = foundConsumerDemoProd.name
        unitPrice = foundConsumerDemoProd.price
        itemCurrency = foundConsumerDemoProd.currency || currency
      }

      if (item.variantId) {
        const demoVariant = foundDemoProd?.variants.find((variant) => variant.id === item.variantId)
        if (demoVariant) {
          unitPrice = demoVariant.price
          sku = demoVariant.sku
        }
      }

      const itemTotal = unitPrice * qty
      calculatedSubtotal += itemTotal

      orderItemsToInsert.push({
        product_id: item.productId.startsWith('prod-') ? null : item.productId,
        variant_id: item.variantId || null,
        product_name_snapshot: productName,
        sku_snapshot: sku,
        quantity: qty,
        unit_price_snapshot: unitPrice,
        currency: itemCurrency,
        selected_options: item.selectedOptions || {},
      })
    }

    const { orderId, orderNumber } = createOrderIdentity()
    const now = new Date().toISOString()

    // Only demo orders need a process-local confirmation because they are not persisted.
    const confirmationItems: OrderConfirmationItem[] = orderItemsToInsert.map(
      (it, idx) => ({
        id: `item-${idx}-${orderId}`,
        productId: it.product_id,
        variantId: it.variant_id,
        productName: it.product_name_snapshot,
        sku: it.sku_snapshot,
        quantity: it.quantity,
        unitPrice: it.unit_price_snapshot,
        currency: it.currency,
        selectedOptions: it.selected_options,
        subtotal: it.unit_price_snapshot * it.quantity,
      })
    )

    const confirmationDto: OrderConfirmationDTO = {
      id: orderId,
      orderNumber,
      storeId: store.id,
      storeSlug,
      storeName: store.name,
      customer: {
        name: customer.name.trim(),
        email: customer.email.trim(),
        phone: customer.phone?.trim(),
        whatsapp: customer.whatsapp?.trim(),
        company: customer.company?.trim(),
        country: customer.country?.trim(),
        state: customer.state?.trim(),
        city: customer.city?.trim(),
        address: customer.address?.trim(),
        notes: customer.notes?.trim(),
        contactPreference: customer.contactPreference || 'email',
      },
      items: confirmationItems,
      currency,
      subtotal: calculatedSubtotal,
      status: 'inquiry_pending',
      createdAt: now,
      storeContact: store.contact,
    }

    memoryOrders.set(orderId, confirmationDto)

    return {
      success: true,
      orderId,
      orderNumber,
    }
  } catch (err: unknown) {
    console.error('submitOrderInquiryAction error:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Failed to submit order inquiry' }
  }
}

export async function getOrderConfirmationAction(
  storeSlug: string,
  orderId: string
): Promise<OrderConfirmationDTO | null> {
  // The in-memory registry is only used by the database-free demo store.
  if (memoryOrders.has(orderId)) {
    return memoryOrders.get(orderId)!
  }

  return getStorefrontOrderConfirmation(storeSlug, orderId)
}
