import { productResponseSchema, productsResponseSchema, storeResponseSchema, type SitePrice } from './contracts'

export class SiteDataError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) { super(message); this.name = 'SiteDataError' }
}

export function createSiteDataClient(options: { origin: string; storeSlug: string; fetch?: typeof fetch }) {
  const origin = new URL(options.origin)
  if (origin.protocol !== 'https:' && !(origin.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(origin.hostname))) throw new Error('Site data requires HTTPS')
  if (origin.username || origin.password || origin.search || origin.hash || origin.pathname !== '/') throw new Error('Expected a data origin, not a URL with credentials or path')
  if (!/^[a-zA-Z0-9_-]{1,160}$/.test(options.storeSlug)) throw new Error('Invalid store slug')
  const root = `${origin.origin}/api/site-data/v1/${encodeURIComponent(options.storeSlug)}`
  const fetcher = options.fetch ?? fetch
  async function read(path: string) {
    const response = await fetcher(root + path, { cache: 'no-store', credentials: 'omit', redirect: 'error', signal: AbortSignal.timeout(10_000), headers: { Accept: 'application/json' } })
    const data = await response.json().catch(() => null)
    if (!response.ok) throw new SiteDataError(response.status, typeof data?.error?.code === 'string' ? data.error.code : 'DATA_UNAVAILABLE', typeof data?.error?.message === 'string' ? data.error.message : '网站数据读取失败')
    return data
  }
  function mismatch(): never { throw new SiteDataError(502, 'CONTRACT_MISMATCH', '网站数据协议不兼容') }
  return {
    async store() {
      const result = storeResponseSchema.safeParse(await read(''))
      if (!result.success || result.data.store.slug !== options.storeSlug) return mismatch()
      return result.data.store
    },
    async products({ offset = 0, limit = 24 }: { offset?: number; limit?: number } = {}) {
      if (!Number.isInteger(offset) || offset < 0 || offset > 100_000 || !Number.isInteger(limit) || limit < 1 || limit > 50) throw new Error('Invalid product pagination')
      const result = productsResponseSchema.safeParse(await read(`/products?offset=${offset}&limit=${limit}`))
      if (!result.success || result.data.storeSlug !== options.storeSlug || result.data.items.length > limit || (result.data.nextOffset !== null && result.data.nextOffset !== offset + limit)) return mismatch()
      return { items: result.data.items, nextOffset: result.data.nextOffset }
    },
    async product(id: string) {
      if (!/^[a-zA-Z0-9_-]{1,160}$/.test(id)) throw new Error('Invalid product ID')
      const result = productResponseSchema.safeParse(await read(`/products/${encodeURIComponent(id)}`))
      if (!result.success || result.data.storeSlug !== options.storeSlug || result.data.product.id !== id) return mismatch()
      return result.data.product
    },
  }
}
export function formatSitePrice(price: SitePrice, locale = 'zh-CN') {
  if (price.kind === 'free') return '免费'
  if (price.kind === 'inquiry') return '询价'
  if (price.kind === 'unknown') return '价格待确认'
  return new Intl.NumberFormat(locale, { style: 'currency', currency: price.currency }).format(price.amount)
}
