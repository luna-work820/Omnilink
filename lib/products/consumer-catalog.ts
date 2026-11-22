import data from '@/components/consumer-market/data/five-store-demo-products.json'
import type { CatalogProductItem, ProductItem } from '@/components/consumer-market/types'
import { withProductComposition } from './product-composition'

// The reviewed source file is the demo's only catalog, on both client and server.
export const CONSUMER_CATALOG_VERSION = 'five-store-v2'
const products = (data as unknown as ProductItem[]).map((product):ProductItem=>({
  ...product,
  priceMode:product.priceMode??(product.catalogEvidence?.priceStatus==='snapshot'
    && Number.isFinite(product.price)&&product.price>0&&product.currency?'amount':'unknown'),
})).map(withProductComposition)
const byId = new Map(products.map((product) => [product.id, product]))

export function isConsumerProductId(id: unknown): id is string {
  return typeof id === 'string' && byId.has(id)
}

export function readConsumerCatalog(ids?: readonly string[]): CatalogProductItem[] {
  return ids ? [...new Set(ids)].flatMap((id) => byId.has(id) ? [byId.get(id)!] : []) : [...products]
}
