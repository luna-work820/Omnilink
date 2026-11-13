import type { ProductItem } from '@/components/consumer-market/types'
import type { StorefrontDiscoveryItem } from '@/lib/storefront/service'

export function toConsumerProduct({product,store}: StorefrontDiscoveryItem): ProductItem {
  const mode = product.priceMode ?? 'unknown'
  const currency = product.currency || 'CNY'
  let price = `${currency} ${product.price}`
  try { price = new Intl.NumberFormat('zh-CN',{style:'currency',currency,maximumFractionDigits:2}).format(product.price) } catch {}
  return {
    id:product.id,name:product.name,creator:store.name,itemType:product.itemType,
    price:product.price,priceMode:mode,
    formattedPrice:mode==='inquiry'?'询价':mode==='unknown'?'价格待确认':mode==='free'?'免费':price,
    outboundLinks:product.outboundLinks,mainImage:product.imageUrl || '/consumer-market/img_app_icon.jpg',
    aspectRatio:0.82,secondaryImages:product.images?.filter((image) => image!==product.imageUrl) ?? [],
    category:product.category || '商品',shortDescription:product.description ?? '',aiSummary:product.description ?? '',
    reviews:[],specs:product.attributes,storeName:store.name,storeSlug:store.slug,currency,
    defaultVariantId:product.variants?.find((v) => v.status==='active')?.id ?? product.variants?.[0]?.id ?? null,
    options:product.options,variants:product.variants,deliveryType:product.deliveryType,capabilityKind:product.capabilityKind,
  }
}
