import { discoveryBlocks,type DiscoveryPage } from './discovery-contract'

export function discoveryResponse(page:DiscoveryPage) {
  return {status:'completed' as const,blocks:discoveryBlocks(page),discovery:page,
    text:page.returnedCount?`${page.query}，本页 ${page.returnedCount} 件。`:'没有找到符合条件的公开商品。',
    styleTag:'商品检索',intent:'product-search' as const,matchedProductIds:page.products.map((p) => p.id),
    matchReasons:{},memorySaved:false,model:null,fallback:false,source:'discovery-engine'}
}
