import { discoveryBlocks,type DiscoveryPage } from './discovery-contract'

export function discoveryResponse(page:DiscoveryPage) {
  return {status:'completed' as const,blocks:discoveryBlocks(page),discovery:page,
    text:'',
    styleTag:'商品检索',intent:'product-search' as const,matchedProductIds:page.products.map((p) => p.id),
    matchReasons:{},memorySaved:false,model:null,fallback:page.retrieval?.degraded??false,source:'discovery-engine',
    metrics:{generationCalls:0,embeddingCalls:page.retrieval?.embeddingCalls??0,modelCalls:page.retrieval?.embeddingCalls??0,retrieval:page.retrieval}}
}
