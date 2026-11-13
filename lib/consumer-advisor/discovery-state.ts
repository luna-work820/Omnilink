import type { DiscoveryPage } from './discovery-contract'

export function applyDiscoveryPage(current:DiscoveryPage|null,page:DiscoveryPage,append=false):DiscoveryPage|null {
  if(!append) return page
  if(!current || current.searchRunId!==page.searchRunId || current.sessionId!==page.sessionId || current.contextVersion!==page.contextVersion) return current
  const products=new Map(current.products.map((p) => [p.id,p]))
  for(const product of page.products) if(!products.has(product.id)) products.set(product.id,product)
  return {...page,products:[...products.values()],returnedCount:products.size}
}
