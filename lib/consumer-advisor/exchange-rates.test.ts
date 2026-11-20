import { describe, expect, it } from 'vitest'
import { convertCurrency, freshExchangeRates } from './exchange-rates'

describe('reference exchange rates', () => {
  const snapshot = {date:'2026-11-19',rates:{EUR:1,USD:1.1,CNY:7.7}}
  it('converts through the same base currency and preserves same-currency amounts', () => {
    expect(convertCurrency(10,'USD','CNY',snapshot)).toBeCloseTo(70)
    expect(convertCurrency(70,'CNY','USD',snapshot)).toBeCloseTo(10)
    expect(convertCurrency(70,'CNY','CNY',null)).toBe(70)
    expect(convertCurrency(0,'USD','CNY',snapshot)).toBe(0)
  })
  it('does not invent missing, invalid or unsupported conversion rates', () => {
    expect(convertCurrency(10,'USD','CNY',null)).toBeNull()
    expect(convertCurrency(10,'XYZ','CNY',snapshot)).toBeNull()
    expect(convertCurrency(10,undefined,'CNY',snapshot)).toBeNull()
    expect(convertCurrency(10,'USD','CNY',{...snapshot,rates:{USD:0,CNY:7}})).toBeNull()
    expect(convertCurrency(-1,'CNY','CNY',snapshot)).toBeNull()
  })
  it('accepts recent dated rates and rejects stale, future or invalid dates', () => {
    const now=Date.parse('2026-11-23T12:00:00Z')
    expect(freshExchangeRates(snapshot,now)).toBe(true)
    expect(freshExchangeRates({...snapshot,date:'2026-11-15'},now)).toBe(false)
    expect(freshExchangeRates({...snapshot,date:'2026-11-24'},now)).toBe(false)
    expect(freshExchangeRates({...snapshot,date:'2026-02-30'},now)).toBe(false)
  })
})
