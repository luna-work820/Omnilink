import type { StorefrontProduct, StorefrontStore } from '@/lib/storefront/types'
import { readOutboundLinks } from '@/lib/products/outbound-links'
import { siteProductSchema, siteStoreSchema, type SitePrice } from './contracts'

function publicImage(value: string | null | undefined): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null
  } catch { return null }
}
export function projectSiteStore(store: StorefrontStore) {
  return siteStoreSchema.parse({
    slug: store.slug, name: store.name, description: store.description,
    logoUrl: publicImage(store.logoUrl),
    contact: {
      ...(store.contact?.email ? { email: store.contact.email } : {}),
      ...(store.contact?.phone ? { phone: store.contact.phone } : {}),
      ...(store.contact?.address ? { address: store.contact.address } : {}),
    },
  })
}
function publicPrice(mode: StorefrontProduct['priceMode'], amount: number | null | undefined, currency: string | null | undefined): SitePrice {
  if (mode === 'free') return { kind: 'free' }
  if (mode === 'inquiry') return { kind: 'inquiry' }
  if (mode === 'amount' && typeof amount === 'number' && Number.isFinite(amount) && amount >= 0 && /^[A-Z]{3}$/.test(currency ?? '')) return { kind: 'amount', amount, currency: currency! }
  return { kind: 'unknown' }
}
export function projectSiteProduct(product: StorefrontProduct) {
  const price = publicPrice(product.priceMode, product.price, product.currency)
  const imageUrl = publicImage(product.imageUrl)
  return siteProductSchema.parse({
    id: product.id, name: product.name, description: product.description,
    category: product.category ?? null, price, imageUrl,
    images: [...new Set([imageUrl, ...(product.images ?? []).map(publicImage)].filter((url): url is string => Boolean(url)))],
    attributes: product.attributes,
    options: (product.options ?? []).map((option) => ({ name: option.name, values: option.values.map((value) => typeof value === 'string' ? value : value.name) })),
    variants: (product.variants ?? []).map((variant) => ({
      id: variant.id, price: publicPrice(product.priceMode, variant.price, variant.currency ?? product.currency),
      selections: variant.optionValues,
      availability: variant.status && variant.status !== 'active' ? 'unavailable'
        : typeof variant.inventory === 'number' && Number.isFinite(variant.inventory) && variant.inventory >= 0 ? variant.inventory > 0 ? 'available' : 'unavailable' : 'unknown',
    })),
    outboundLinks: Object.entries(readOutboundLinks(product.outboundLinks)).map(([label, url]) => ({ label, url })),
  })
}
