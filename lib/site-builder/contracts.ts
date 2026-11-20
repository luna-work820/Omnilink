import { z } from 'zod'

export const SITE_DATA_VERSION = '1' as const
export const SITE_RUNTIME_VERSION = '1' as const
export const sitePriceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('amount'), amount: z.number().finite().nonnegative(), currency: z.string().regex(/^[A-Z]{3}$/) }).strict(),
  z.object({ kind: z.literal('free') }).strict(),
  z.object({ kind: z.literal('inquiry') }).strict(),
  z.object({ kind: z.literal('unknown') }).strict(),
])
const publicUrl = z.string().url().refine((value) => {
  const url = new URL(value)
  return url.protocol === 'https:' && !url.username && !url.password
}, 'Expected a public HTTPS resource')
export const siteStoreSchema = z.object({
  slug: z.string().min(1).max(160), name: z.string(), description: z.string().nullable(),
  logoUrl: publicUrl.nullable(),
  contact: z.object({ email: z.string().optional(), phone: z.string().optional(), address: z.string().optional() }).strict(),
}).strict()
export const siteProductSchema = z.object({
  id: z.string().min(1), name: z.string(), description: z.string().nullable(), category: z.string().nullable(),
  price: sitePriceSchema,
  imageUrl: publicUrl.nullable(), images: z.array(publicUrl),
  attributes: z.record(z.string(), z.string()),
  options: z.array(z.object({ name: z.string(), values: z.array(z.string()) }).strict()),
  variants: z.array(z.object({
    id: z.string().min(1), price: sitePriceSchema, selections: z.record(z.string(), z.string()),
    availability: z.enum(['available', 'unavailable', 'unknown']),
  }).strict()),
  outboundLinks: z.array(z.object({ label: z.string(), url: publicUrl }).strict()),
}).strict()
export const storeResponseSchema = z.object({ schemaVersion: z.literal(SITE_DATA_VERSION), store: siteStoreSchema }).strict()
export const productsResponseSchema = z.object({
  schemaVersion: z.literal(SITE_DATA_VERSION), storeSlug: z.string(),
  items: z.array(siteProductSchema).max(50), nextOffset: z.number().int().nonnegative().nullable(),
}).strict()
export const productResponseSchema = z.object({
  schemaVersion: z.literal(SITE_DATA_VERSION), storeSlug: z.string(), product: siteProductSchema,
}).strict()
export type SitePrice = z.infer<typeof sitePriceSchema>
export type SiteStore = z.infer<typeof siteStoreSchema>
export type SiteProduct = z.infer<typeof siteProductSchema>
export type SiteDataErrorCode = 'INVALID_REQUEST' | 'STORE_NOT_FOUND' | 'PRODUCT_NOT_FOUND' | 'DATA_UNAVAILABLE' | 'CONTRACT_MISMATCH'
export type SiteRoute = { name: 'home' } | { name: 'products' } | { name: 'product'; productId: string }
export type SitePageProps = {
  store: SiteStore
  products: SiteProduct[]
  product: SiteProduct | null
  route: SiteRoute
}
