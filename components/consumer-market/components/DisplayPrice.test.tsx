import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { readConsumerCatalog } from '@/lib/products/consumer-catalog'
import { DiscoveryPriceProvider, DisplayPrice } from './DisplayPrice'

const product = {...readConsumerCatalog()[0],price:10,priceMode:'amount' as const,currency:'USD',formattedPrice:'$10.00'}

describe('search result price', () => {
  it('uses the budget currency and the search snapshot for display', () => {
    const html=renderToStaticMarkup(<DiscoveryPriceProvider active currency="CNY" snapshot={{date:'2026-11-19',rates:{USD:1,CNY:7}}}>
      <DisplayPrice product={product} />
    </DiscoveryPriceProvider>)
    expect(html).toContain('¥70')
    expect(html).toContain('2026-11-19')
    expect(html).toContain('$10.00')
  })
  it('shows the source amount when no reference rate is available', () => {
    const html=renderToStaticMarkup(<DiscoveryPriceProvider active currency="CNY" snapshot={null}>
      <DisplayPrice product={product} />
    </DiscoveryPriceProvider>)
    expect(html).toContain('$10.00')
    expect(html).not.toContain('¥')
  })
})
