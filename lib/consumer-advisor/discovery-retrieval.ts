import 'server-only'
import type { ProductItem } from '@/components/consumer-market/types'
import { catalogSnapshot,readPublishedConsumerCatalog,type ConsumerCatalogSnapshot } from '@/lib/products/consumer-catalog-store'
import { discoverySpecSchema, type DiscoverySpec } from './discovery-contract'
import { embeddingProfiles, retrievalOptionsSchema, type RetrievalReport } from './embedding-profile'
import { eligibleConsumerProduct, fuseProductIds, rankKeywordProducts,keywordProductScore,spreadStores } from './search-spec'
import { searchConsumerCatalogByVector, SemanticSearchError } from './consumer-catalog-vector'
import { convertCurrency, type ExchangeRates } from './exchange-rates'
import { getExchangeRates } from './exchange-rates-server'

type ContextTerms = {positiveTerms: string[]; avoidTerms: string[];
  routeSource?: NonNullable<RetrievalReport['routeSource']>; keywordKind?: RetrievalReport['keywordKind']}
type RetrievalDeps = {catalog: () => ProductItem[] | ConsumerCatalogSnapshot | Promise<ProductItem[] | ConsumerCatalogSnapshot>; semantic: typeof searchConsumerCatalogByVector; rates?: () => Promise<ExchangeRates | null>}
const defaults: RetrievalDeps = {catalog: readPublishedConsumerCatalog, semantic: searchConsumerCatalogByVector, rates: getExchangeRates}

export async function retrieveDiscoveryCandidates(input: DiscoverySpec, context: ContextTerms = {positiveTerms: [], avoidTerms: []},
  signal?: AbortSignal, deps: RetrievalDeps = defaults, previousRates?: ExchangeRates | null, publishedCatalog?: ConsumerCatalogSnapshot) {
  const started = performance.now(), spec = discoverySpecSchema.parse(input)
  const options = retrievalOptionsSchema.parse(spec.retrieval ?? {})
  const forcedKeyword = process.env.CONSUMER_RETRIEVAL_MODE === 'keyword'
  signal?.throwIfAborted()
  const catalog = publishedCatalog ?? await deps.catalog()
  const snapshot = Array.isArray(catalog) ? catalogSnapshot(catalog) : catalog
  const hasBudget = spec.minPrice !== null || spec.maxPrice !== null
  const withoutPrice = hasBudget ? {...spec,minPrice:null,maxPrice:null} : spec
  const potentiallyEligible = snapshot.products.filter((product) => eligibleConsumerProduct(product, withoutPrice))
  const needsRates = hasBudget && potentiallyEligible.some((product) => product.priceMode === 'amount' && product.currency !== spec.currency)
  const priceReference = hasBudget && previousRates ? previousRates : needsRates ? await (deps.rates?.() ?? Promise.resolve(null)) : null
  signal?.throwIfAborted()
  const priceWarning = needsRates && potentiallyEligible.some((product) => product.priceMode === 'amount' &&
    convertCurrency(product.price,product.currency,spec.currency,priceReference) === null)
  const eligible = potentiallyEligible.filter((product) => eligibleConsumerProduct(product, spec, priceReference))
  const eligibilityMs=Math.round(performance.now()-started)
  const keywordIds = rankKeywordProducts(eligible, spec, context.positiveTerms, context.avoidTerms, priceReference).map((product) => product.id)
  const hasKeywordOverride = forcedKeyword && options.mode !== 'keyword'
  const selectionReason = hasKeywordOverride ? 'KEYWORD_OVERRIDE'
    : options.mode !== 'auto' ? 'EXPLICIT_MODE'
    : eligible.length === 0 ? 'AUTO_NO_CANDIDATES'
    : keywordIds.length === 0 ? 'AUTO_NO_KEYWORD_MATCH'
    : spec.sessionTerms.length ? 'AUTO_SOFT_TERMS'
    : 'AUTO_KEYWORD_MATCH'
  const mode = forcedKeyword ? 'keyword' : options.mode === 'auto'
    ? selectionReason === 'AUTO_NO_KEYWORD_MATCH' ? 'semantic' : selectionReason === 'AUTO_SOFT_TERMS' ? 'hybrid' : 'keyword'
    : options.mode
  const report: RetrievalReport = {requestedMode: options.mode, effectiveMode: mode,
    profile: mode === 'keyword' ? null : embeddingProfiles[options.profile], degraded: hasKeywordOverride && options.mode !== 'auto',
    reason: hasKeywordOverride ? 'KEYWORD_OVERRIDE' : null, selectionReason,
    routeSource: context.routeSource ?? 'model', keywordKind: context.keywordKind ?? null,
    eligibilityMs,
    embeddingCalls: 0, embeddingInputTokens: null, embeddingMs: 0, retrievalMs: 0,
    candidateCount: 0, keywordCount: keywordIds.length, semanticCount: 0, totalMs: 0}
  let semanticIds: string[] = []
  const similarities=new Map<string,number>()
  if (mode !== 'keyword' && eligible.length) {
    try {
      const result = await deps.semantic(spec, eligible, embeddingProfiles[options.profile], signal, priceReference)
      semanticIds = result.matches.map((match) => match.id)
      for(const match of result.matches)similarities.set(match.id,match.similarity)
      Object.assign(report, result.metrics)
      report.semanticCount = semanticIds.length
    } catch (error) {
      if (signal?.aborted) throw error
      report.degraded = true
      report.effectiveMode = 'keyword'
      report.reason = error instanceof SemanticSearchError ? error.code : 'SEMANTIC_UNAVAILABLE'
      if (error instanceof SemanticSearchError) Object.assign(report, error.metrics)
    }
  }
  const rankStarted=performance.now()
  const ids = report.effectiveMode === 'semantic' ? semanticIds
    : report.effectiveMode === 'hybrid' ? fuseProductIds([keywordIds, semanticIds]) : keywordIds
  const byId = new Map(eligible.map((product) => [product.id, product]))
  const products: ProductItem[] = [...new Set(ids)].flatMap((id) => {
    const product = byId.get(id)
    return product && eligibleConsumerProduct(product, spec, priceReference) ? [product] : []
  }).slice(0, 1000)
  const rrf=new Map<string,number>()
  for(const list of [keywordIds,semanticIds])[...new Set(list)].forEach((id,rank)=>rrf.set(id,(rrf.get(id)??0)+1/(61+rank)))
  const ordered=spreadStores(products,(product)=>report.effectiveMode==='keyword'
    ?keywordProductScore(product,spec,context.positiveTerms,context.avoidTerms)
    :report.effectiveMode==='semantic'?similarities.get(product.id)??0:rrf.get(product.id)??0,
    report.effectiveMode==='keyword'?0:report.effectiveMode==='semantic'?0.015:0.0005)
  report.rankingMs=Math.round(performance.now()-rankStarted)
  report.candidateCount = ordered.length
  report.resultReason = report.degraded ? 'SEMANTIC_DEGRADED'
    : ordered.length === 0 ? eligible.length === 0 ? 'NO_ELIGIBLE' : 'NO_KEYWORD_MATCH' : 'MATCH'
  report.totalMs = Math.round(performance.now() - started)
  return {products:ordered, keywordIds, semanticIds, report, catalogVersion:snapshot.version,priceReference,priceWarning}
}
