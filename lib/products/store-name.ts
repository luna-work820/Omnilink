import type { ProductItem } from '@/components/consumer-market/types'

const STORE_NAMES_BY_HOST: Record<string, string> = {
  'amanostudio.com': 'Amano Studio',
  '2x3yfurniture.framer.website': '2X3Y Furniture',
  'aquazzura.com': 'Aquazzura',
  'aniyerecords.com': 'ANIYE RECORDS',
  'berhel.com': 'Berhel',
  'chicdecent.com': 'Chic Decent',
  'forloveandlemons.com': 'For Love & Lemons',
  'haleia.fr': 'Haleia',
  'hooksandluxe.com': 'Hooks and Luxe',
  'leapstudio.shop': 'LEAP STUDIO',
  'selkiecollection.com': 'Selkie',
  'sergiorossi.com': 'Sergio Rossi',
  'thecled.com': 'CLED',
  'zimmermann.com': 'Zimmermann',
}

function hostname(value: string | undefined): string | undefined {
  if (!value) return undefined
  try {
    return new URL(value.includes('://') ? value : `https://${value}`)
      .hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return undefined
  }
}

export function isStoreDomainName(value: string | undefined): boolean {
  return Boolean(value?.trim() && /^(?:www\.)?(?:[a-z0-9-]+\.)+[a-z]{2,}$/i.test(value.trim()))
}

export function knownStoreName(value: string | undefined): string | undefined {
  const host = hostname(value)
  return host ? STORE_NAMES_BY_HOST[host] : undefined
}

export function resolveStoreName(
  candidate: string | undefined,
  sourceUrl?: string,
  fallback?: string,
): string {
  const name = candidate?.trim() ?? ''
  const fromSource = knownStoreName(sourceUrl)
  if (fromSource) return fromSource

  if (name && !isStoreDomainName(name)) return name

  const fromCandidate = knownStoreName(name)
  if (fromCandidate) return fromCandidate

  const fallbackName = fallback?.trim() ?? ''
  if (fallbackName && !isStoreDomainName(fallbackName)) return fallbackName

  return '商家名称待核'
}

export function normalizeCatalogStoreName(product: ProductItem): ProductItem {
  const storeName = resolveStoreName(product.storeName, product.sourceUrl, product.creator)
  return {
    ...product,
    storeName,
    ...(isStoreDomainName(product.creator) ? { creator: storeName } : {}),
  }
}
