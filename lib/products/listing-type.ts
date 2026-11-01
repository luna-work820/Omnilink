export type ListingType = 'product' | 'digital' | 'service'

export function listingTypeFromCatalog(itemType: unknown, deliveryType: unknown): ListingType {
  if (itemType === 'service') return 'service'
  if (deliveryType === 'digital' || deliveryType === 'ai_capability' || itemType === 'skill') return 'digital'
  return 'product'
}
