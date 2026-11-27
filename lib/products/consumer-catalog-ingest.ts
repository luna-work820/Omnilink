import { createHash } from 'node:crypto'
import { isIP } from 'node:net'
import { load } from 'cheerio'
import type { ProductItem } from '@/components/consumer-market/types'
import { isStoreDomainName, resolveStoreName } from './store-name'
import { resolveProductComposition } from './product-composition'
import { extractCompositionFromHtml } from './product-composition-extract'

type RecordValue = Record<string, unknown>
const asRecord = (value: unknown): RecordValue => value && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : {}
const clean = (value: unknown, max = 2000): string => typeof value === 'string'
  ? load(value.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')).text().replace(/\s+/g, ' ').trim().slice(0, max) : ''
const first = (value: unknown): unknown => Array.isArray(value) ? value[0] : value

export function canonicalProductUrl(value: string): string {
  let url: URL
  try { url = new URL(value) } catch { throw new Error('PRODUCT_URL_INVALID') }
  if (url.protocol !== 'https:' || url.username || url.password || url.port || !url.hostname.includes('.') ||
      isIP(url.hostname) || /(?:^|\.)(?:localhost|local)$/i.test(url.hostname) || url.href.length > 2048) {
    throw new Error('PRODUCT_URL_INVALID')
  }
  url.hash = ''
  for (const key of [...url.searchParams.keys()]) {
    if (/^(?:utm_.+|gclid|fbclid|msclkid)$/i.test(key)) url.searchParams.delete(key)
  }
  url.searchParams.sort()
  return url.href
}

function productNodes(value: unknown): RecordValue[] {
  if (Array.isArray(value)) return value.flatMap(productNodes)
  const object = asRecord(value)
  const type = object['@type']
  const isProduct = (Array.isArray(type) ? type : [type]).some((part) => typeof part === 'string' && /(?:^|\/)Product$/.test(part))
  return [...(isProduct ? [object] : []), ...Object.values(object).flatMap((child) =>
    child && typeof child === 'object' ? productNodes(child) : [])]
}

function schemaStoreNames(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(schemaStoreNames)
  const object = asRecord(value)
  const types = Array.isArray(object['@type']) ? object['@type'] : [object['@type']]
  const isProduct = types.some((type) => typeof type === 'string' && /(?:^|\/)Product$/i.test(type))
  if (isProduct) return []
  const isStoreEntity = types.some((type) => typeof type === 'string' && /(?:Organization|LocalBusiness|OnlineStore|WebSite|Store)$/i.test(type))
  const name = isStoreEntity && typeof object.name === 'string' ? [object.name] : []
  return [...name, ...Object.values(object).flatMap(schemaStoreNames)]
}

function imageUrl(value: unknown, base: string): string {
  const item = first(value)
  const candidate = typeof item === 'string' ? item : asRecord(item).url
  if (typeof candidate !== 'string' || !candidate) return ''
  try {
    const url = new URL(candidate, base)
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : ''
  } catch { return '' }
}

export function normalizeScrapedProduct(html: string, url: string, capturedAt = new Date().toISOString()): ProductItem {
  if (Buffer.byteLength(html) > 8_000_000) throw new Error('PRODUCT_HTML_TOO_LARGE')
  const sourceUrl = canonicalProductUrl(url)
  const $ = load(html)
  const structured: RecordValue[] = []
  const structuredDocuments: unknown[] = []
  $('script[type="application/ld+json"]').each((_, element) => {
    try {
      const document = JSON.parse($(element).html() || 'null') as unknown
      structuredDocuments.push(document)
      structured.push(...productNodes(document))
    } catch { /* Other metadata can still be used. */ }
  })
  const data = structured.find((item) => {
    const candidate = item.url || asRecord(first(item.offers)).url
    if (typeof candidate !== 'string') return false
    try { return canonicalProductUrl(new URL(candidate, sourceUrl).href) === sourceUrl } catch { return false }
  }) ?? structured[0] ?? {}
  const micro = $('[itemscope][itemtype$="/Product"]').first()
  const prop = (name: string) => {
    const element = micro.find(`[itemprop="${name}"]`).first()
    return element.attr('content') || element.attr('src') || element.attr('href') || element.text()
  }
  const name = clean(data.name || prop('name') || $('meta[property="og:title"]').attr('content'), 240)
  if (!name) throw new Error('PRODUCT_NAME_MISSING')
  const offer = asRecord(first(data.offers))
  const rawPrice = offer.price ?? prop('price') ?? ''
  const priceString = String(rawPrice).replace(/[^\d.,-]/g, '').replace(/,/g, '')
  const amount = priceString ? Number(priceString) : NaN
  const rawCurrency = clean(offer.priceCurrency || prop('priceCurrency'), 3).toUpperCase()
  const currency = /^[A-Z]{3}$/.test(rawCurrency) ? rawCurrency : undefined
  const hasPrice = Number.isFinite(amount) && amount >= 0 && Boolean(currency)
  const brandValue = first(data.brand)
  const productBrand = clean(typeof brandValue === 'string' ? brandValue : asRecord(brandValue).name, 120)
    || clean(prop('brand'), 120)
  const siteName = clean(
    $('meta[property="og:site_name"]').attr('content')
      || $('meta[name="application-name"]').attr('content')
      || structuredDocuments.flatMap(schemaStoreNames).find(Boolean),
    120,
  )
  const storeName = resolveStoreName(siteName, sourceUrl, productBrand)
  const brand = productBrand && !isStoreDomainName(productBrand) ? productBrand : storeName
  const description = clean(data.description || prop('description') || $('meta[property="og:description"]').attr('content'), 1200)
  const image = imageUrl(data.image, sourceUrl)
    || imageUrl(prop('image'), sourceUrl)
    || imageUrl($('meta[property="og:image"]').attr('content'), sourceUrl)
  const availability = clean(offer.availability || micro.find('[itemprop="availability"]').attr('href'), 120)
  const specs: Record<string, string> = {}
  for (const [key, value] of Object.entries({材质: data.material, 颜色: data.color, 尺寸: data.size, SKU: data.sku})) {
    const text = clean(value, 200)
    if (text) specs[key] = text
  }
  if (availability) specs['库存状态'] = /OutOfStock/i.test(availability) ? '采集时售罄' : /InStock/i.test(availability) ? '采集时有货' : '未知'
  const categoryText = `${name} ${description} ${sourceUrl}`
  const category = /necklace|pendant|项链|吊坠/i.test(categoryText) ? '项链' : /earring|耳环|耳饰/i.test(categoryText) ? '耳饰'
    : /bracelet|手链/i.test(categoryText) ? '手链' : /\bring\b|戒指/i.test(categoryText) ? '戒指'
      : /\b(?:pump|slingback|sandal|boot|loafer|sneaker|slipper|mule|ballerina|heel|shoes?)\b|鞋履|鞋靴|凉鞋|高跟鞋|皮鞋/i.test(categoryText) ? '鞋履'
        : /\b(?:dress|blouse|jacket|skirt|pants|shirt|sweater|top|corset|coat|clothing|garment|lingerie|swimwear)\b|连衣裙|服饰|服装/i.test(categoryText) ? '服饰'
          : /\b(?:furniture|lamp|chair|sofa|table|shelf|shelves|rack|monitor stand|lighting)\b|家具|家居|落地灯|置物架/i.test(categoryText) ? '家居家具'
            : /\b(?:makeup|cosmetic|foundation|blush|lipstick|concealer|serum|skincare|shampoo|hairbath|conditioner|body wash)\b|洗发|护发|沐浴|洗护|美妆|护肤/i.test(categoryText) ? '个护美妆' : '商品'
  const rawComposition = data.ingredients ?? prop('ingredients')
  const compositionNames = Array.isArray(rawComposition)
    ? rawComposition.flatMap((item) => {
      if (typeof item === 'string') return [clean(item, 300)].filter(Boolean)
      const name = asRecord(item).name
      return typeof name === 'string' ? [clean(name, 300)].filter(Boolean) : []
    })
    : typeof rawComposition === 'string'
      ? clean(rawComposition, 8000).split(/[,，;；、]+/).map((item) => item.trim()).filter(Boolean)
      : []
  const composition = compositionNames.length ? {
    kind: category === '个护美妆' ? 'cosmetic-inci' as const : 'other' as const,
    status: 'partial' as const,
    items: compositionNames.map((name, index) => ({name, position: index + 1})),
    rawText: typeof rawComposition === 'string' ? clean(rawComposition, 8000) : compositionNames.join(', '),
    sourceUrl,
    observedAt: capturedAt,
  } : extractCompositionFromHtml(html, sourceUrl, capturedAt, category)
    ?? resolveProductComposition({itemType:'product',deliveryType:'physical',category,specs,sourceUrl,sourceDate:capturedAt})
  const id = `external-${createHash('sha256').update(sourceUrl).digest('hex').slice(0, 24)}`
  return {
    id, name, creator: brand, itemType: 'product', deliveryType: 'physical', price: hasPrice ? amount : 0,
    formattedPrice: hasPrice ? `${currency} ${amount.toFixed(2)}` : '待核价',
    priceMode: hasPrice ? 'amount' : 'unknown', ...(currency ? {currency} : {}),
    mainImage: image, secondaryImages: [], aspectRatio: 1, category,
    shortDescription: description, aiSummary: description, reviews: [], specs, storeName, composition,
    sourceUrl, sourceDate: capturedAt,
    catalogEvidence: {sourceType:'public_page',reviewedAt:capturedAt,productPageStatus:'fetched',listingUrl:sourceUrl,
      priceStatus:hasPrice?'snapshot':'unconfirmed',...(hasPrice?{priceSourceUrl:sourceUrl}:{}),
      stockStatus:/OutOfStock/i.test(availability)?'sold_out_snapshot':'unknown',deliveryToChina:'unverified',
      checkoutVerified:false,imageStatus:'source_url_only'},
  }
}
