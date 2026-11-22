import sampleCatalog from '@/components/consumer-market/data/wash-care-sample-catalog.json'
import type { ProductComposition } from '@/components/consumer-market/types'

export type WashCareProductType = 'shampoo' | 'conditioner' | 'body-wash'

export type WashCareProduct = {
  id: string
  brand: string
  name: string
  productType: WashCareProductType
  formulaMarket: string
  variants: string[]
  source: { kind: 'brand_official_product_page'; url: string; verifiedAt: string }
  composition: ProductComposition
  manufacturerClaims: string[]
  filterFacets: {
    hairTypes: string[]
    scalpNeeds: string[]
    hairGoals: string[]
    bodySkinNeeds: string[]
    bodySkinGoals: string[]
    formulaClaims: string[]
  }
  formulaFacts: {
    fragranceIngredientsListed: boolean
    slsSlesListed: boolean
    proteinIngredientListed: boolean
  }
  notes?: string
}

export type WashCareFilters = {
  productType?: WashCareProductType
  hairType?: string
  scalpNeed?: string
  hairGoal?: string
  bodySkinNeed?: string
  bodySkinGoal?: string
  formulaClaim?: string
  excludeIngredients?: readonly string[]
}

export const washCareSampleProducts = sampleCatalog.records as WashCareProduct[]

function normalizeIngredient(value: string): string {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en')
}

export function filterWashCareProducts(filters: WashCareFilters = {}): WashCareProduct[] {
  const excluded = new Set((filters.excludeIngredients ?? []).map(normalizeIngredient))
  return washCareSampleProducts.filter((product) => {
    if (filters.productType && product.productType !== filters.productType) return false
    if (filters.hairType && !product.filterFacets.hairTypes.includes(filters.hairType)) return false
    if (filters.scalpNeed && !product.filterFacets.scalpNeeds.includes(filters.scalpNeed)) return false
    if (filters.hairGoal && !product.filterFacets.hairGoals.includes(filters.hairGoal)) return false
    if (filters.bodySkinNeed && !product.filterFacets.bodySkinNeeds.includes(filters.bodySkinNeed)) return false
    if (filters.bodySkinGoal && !product.filterFacets.bodySkinGoals.includes(filters.bodySkinGoal)) return false
    if (filters.formulaClaim && !product.filterFacets.formulaClaims.includes(filters.formulaClaim)) return false
    return !product.composition.items.some((ingredient) => excluded.has(normalizeIngredient(ingredient.name)))
  })
}

export function washCareFilterOptions() {
  const records = washCareSampleProducts
  const values = (select: (product: WashCareProduct) => string[]) =>
    [...new Set(records.flatMap(select))].sort((a, b) => a.localeCompare(b))
  return {
    productTypes: [...new Set(records.map((product) => product.productType))],
    hairTypes: values((product) => product.filterFacets.hairTypes),
    scalpNeeds: values((product) => product.filterFacets.scalpNeeds),
    hairGoals: values((product) => product.filterFacets.hairGoals),
    bodySkinNeeds: values((product) => product.filterFacets.bodySkinNeeds),
    bodySkinGoals: values((product) => product.filterFacets.bodySkinGoals),
    formulaClaims: values((product) => product.filterFacets.formulaClaims),
  }
}
