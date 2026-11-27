import { describe, expect, it } from 'vitest'
import { extractCompositionFromHtml } from './product-composition-extract'

const url = 'https://store.example/products/dress?COLOR=00336'
const captured = '2026-11-26T10:00:00.000Z'

describe('printed composition extraction', () => {
  it('keeps JSON-LD material and lining with their part labels and proportions', () => {
    const ld = JSON.stringify({ '@type': 'Product', name: 'Rock Clutch', additionalProperty: [
      { '@type': 'PropertyValue', name: 'Composition', value: 'Material: 100% Cow leather\nLining: 100% Cotton' },
    ] })
    const html = `<script type="application/ld+json">${ld.replace(/</g, '\\u003c')}</script>`
    const result = extractCompositionFromHtml(html, url, captured, '服饰')!
    expect(result.kind).toBe('textile-fiber')
    expect(result.status).toBe('partial')
    expect(result.items.map((item) => [item.name, item.proportion, item.sourceLabel])).toEqual([
      ['Cow leather', '100%', 'Material'], ['Cotton', '100%', 'Lining'],
    ])
    expect(result.rawText).toContain('Lining: 100% Cotton')
    expect(result).toMatchObject({ sourceUrl: url, observedAt: captured })
  })

  it('preserves INCI order from a printed All Ingredients list', () => {
    const html = `<div><h3>All Ingredients</h3><ul><li>Water</li><li>Methylpropanediol</li><li>Butylene Glycol</li><li>Salicylic Acid</li></ul></div>`
    const result = extractCompositionFromHtml(html, url, captured, '个护美妆')!
    expect(result.kind).toBe('cosmetic-inci')
    expect(result.items.map((item) => item.name)).toEqual(['Water', 'Methylpropanediol', 'Butylene Glycol', 'Salicylic Acid'])
    expect(result.items.map((item) => item.position)).toEqual([1, 2, 3, 4])
    expect(result.status).toBe('partial')
  })

  it('reads inline fabric composition with part labels without guessing missing parts', () => {
    const html = `<p>Composition: 1 Fabric: 100% Viscose 2 Fabric: 77% Polyamide, 23% Elastane Detail: 100% Polyamide</p>`
    const result = extractCompositionFromHtml(html, url, captured, '服饰')!
    expect(result.items.map((item) => item.name)).toEqual(['Viscose', 'Polyamide', 'Elastane', 'Polyamide'])
    expect(result.items[1]).toMatchObject({ proportion: '77%', sourceLabel: 'Fabric' })
    expect(result.items[3]).toMatchObject({ proportion: '100%', sourceLabel: 'Detail' })
  })

  it('returns null instead of inventing a composition when the page has none', () => {
    expect(extractCompositionFromHtml('<html><body><p>Add to bag</p></body></html>', url, captured, '服饰')).toBeNull()
  })

  it('never auto-marks a printed list as verified', () => {
    const html = `<div><h3>Ingredients</h3><ul><li>Water</li><li>Glycerin</li></ul></div>`
    expect(extractCompositionFromHtml(html, url, captured, '护肤')?.status).toBe('partial')
  })
})
