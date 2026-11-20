import {readGeneratedStoreState} from './data'
import 'server-only'
import { getPublishedStore, getStorefrontProduct, getStorefrontProducts } from '@/lib/storefront/service'
import { SITE_DATA_VERSION } from './contracts'
import { projectSiteProduct, projectSiteStore } from './projection'

export class PublicSiteDataError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) { super(message) }
}
export function validateSiteIdentifier(value: string) {
  if (!/^[a-zA-Z0-9_-]{1,160}$/.test(value)) throw new PublicSiteDataError(400, 'INVALID_REQUEST', '无效的网站数据请求')
}
async function resolvePublicStore(slug: string) {
  validateSiteIdentifier(slug)
  const generated=await readGeneratedStoreState(slug)
  const store = generated.managed ? generated.store : await getPublishedStore(slug)
  // Demo fallback is explicitly excluded from the real data protocol.
  if (!store || store.id === 'demo-store') throw new PublicSiteDataError(404, 'STORE_NOT_FOUND', '网站不存在或尚未发布')
  return store
}
export async function readSiteStore(slug: string) {
  const store = await resolvePublicStore(slug)
  return { schemaVersion: SITE_DATA_VERSION, store: projectSiteStore(store) }
}
export function sitePagination(search: URLSearchParams) {
  for (const key of search.keys()) if (key !== 'offset' && key !== 'limit') throw new PublicSiteDataError(400, 'INVALID_REQUEST', '不支持的分页参数')
  const read = (key: string, fallback: number, max: number) => {
    const values = search.getAll(key)
    if (values.length > 1 || (values.length && !/^\d{1,6}$/.test(values[0]))) throw new PublicSiteDataError(400, 'INVALID_REQUEST', '分页参数无效')
    const value = values.length ? Number(values[0]) : fallback
    if (value > max || (key === 'limit' && value < 1)) throw new PublicSiteDataError(400, 'INVALID_REQUEST', '分页参数超出范围')
    return value
  }
  return { offset: read('offset', 0, 100_000), limit: read('limit', 24, 50) }
}
export async function readSiteProducts(slug: string, search: URLSearchParams) {
  const { offset, limit } = sitePagination(search)
  const store = await resolvePublicStore(slug)
  const products = await getStorefrontProducts(store, limit + 1, offset)
  return {
    schemaVersion: SITE_DATA_VERSION, storeSlug: store.slug,
    items: products.slice(0, limit).map(projectSiteProduct),
    nextOffset: products.length > limit && offset + limit <= 100_000 ? offset + limit : null,
  }
}
export async function readSiteProduct(slug: string, id: string) {
  validateSiteIdentifier(id)
  const store = await resolvePublicStore(slug)
  const product = await getStorefrontProduct(store, id)
  if (!product) throw new PublicSiteDataError(404, 'PRODUCT_NOT_FOUND', '商品不存在或不可公开访问')
  return { schemaVersion: SITE_DATA_VERSION, storeSlug: store.slug, product: projectSiteProduct(product) }
}
