import type { StoreContactConfig } from '@/lib/storefront/schema'

/** Public checkout payload. Prices are intentionally omitted and re-read from the catalog. */
export interface OrderCustomerInfo {
  name: string
  email: string
  phone?: string
  whatsapp?: string
  company?: string
  country?: string
  state?: string
  city?: string
  address?: string
  notes?: string
  contactPreference?: 'email' | 'whatsapp' | 'phone'
}

export interface OrderItemSubmission {
  productId: string
  variantId?: string | null
  quantity: number
  selectedOptions?: Record<string, string>
}

export interface OrderSubmissionPayload {
  storeSlug: string
  customer: OrderCustomerInfo
  items: OrderItemSubmission[]
}

export interface OrderConfirmationItem {
  id: string
  productId?: string | null
  variantId?: string | null
  productName: string
  sku?: string | null
  quantity: number
  unitPrice: number
  currency: string
  selectedOptions?: Record<string, string>
  subtotal: number
}

export interface OrderConfirmationDTO {
  id: string
  orderNumber: string
  storeId: string
  storeSlug: string
  storeName: string
  customer: OrderCustomerInfo
  items: OrderConfirmationItem[]
  currency: string
  subtotal: number
  status: string
  createdAt: string
  storeContact?: StoreContactConfig
}
