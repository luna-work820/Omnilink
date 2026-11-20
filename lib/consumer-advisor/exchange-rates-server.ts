import 'server-only'
import { freshExchangeRates, type ExchangeRates } from './exchange-rates'

let lastSuccessfulRates: ExchangeRates | null = null

export async function getExchangeRates(): Promise<ExchangeRates | null> {
  try {
    const response = await fetch('https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml', {
      next: { revalidate: 60 * 60 * 6 },
      signal: AbortSignal.timeout(6000),
    })
    if (!response.ok) throw new Error('Rate feed unavailable')
    const xml = await response.text()
    const date = /<Cube time='(\d{4}-\d{2}-\d{2})'>/.exec(xml)?.[1]
    const rates = Object.fromEntries([...xml.matchAll(/<Cube currency='([A-Z]{3})' rate='([\d.]+)'\/>/g)]
      .map(([, code, rate]) => [code, Number(rate)]))
    rates.EUR = 1
    if (!date || !rates.CNY || !rates.USD || Object.values(rates).some((rate) => !Number.isFinite(rate) || rate <= 0)) throw new Error('Incomplete rate feed')
    const snapshot = {date, rates}
    if (!freshExchangeRates(snapshot)) throw new Error('Rate feed is out of date')
    lastSuccessfulRates = snapshot
    return snapshot
  } catch {
    return lastSuccessfulRates && freshExchangeRates(lastSuccessfulRates) ? lastSuccessfulRates : null
  }
}
