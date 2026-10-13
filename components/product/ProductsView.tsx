'use client'

import type { ProductRow } from '@/components/product/ProductTable'
import { ProductAssetLibrary } from '@/components/dashboard/v3-UI/ProductAssetLibrary'

export function ProductsView({ products }: { products: ProductRow[] }) {
  return <ProductAssetLibrary products={products} />
}
