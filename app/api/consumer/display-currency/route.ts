import { NextResponse, type NextRequest } from 'next/server'

const currencyByCountry: Record<string, string> = {
  CN: 'CNY', US: 'USD', CA: 'CAD', GB: 'GBP', JP: 'JPY', KR: 'KRW',
  HK: 'HKD', SG: 'SGD', AU: 'AUD', NZ: 'NZD', CH: 'CHF',
  DE: 'EUR', FR: 'EUR', IT: 'EUR', ES: 'EUR', NL: 'EUR', BE: 'EUR',
  AT: 'EUR', IE: 'EUR', PT: 'EUR', FI: 'EUR', GR: 'EUR', LU: 'EUR',
}

const fallbackRates = {
  EUR: 1, USD: 1.1267, CNY: 7.5177, CAD: 1.5701, GBP: 0.8346,
  JPY: 178.3, KRW: 1508.18, HKD: 8.8399, SGD: 1.4398,
  AUD: 1.6061, NZD: 1.9988, CHF: 0.9188,
}

export async function GET(request: NextRequest) {
  const country = request.headers.get('x-vercel-ip-country')
    || request.headers.get('cf-ipcountry')
    || request.nextUrl.searchParams.get('region')
    || 'CN'
  const currency = currencyByCountry[country.toUpperCase()] || 'CNY'

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
    if (!date || !rates.CNY || !rates.USD || !rates[currency]) throw new Error('Incomplete rate feed')
    return NextResponse.json({ currency, date, rates })
  } catch {
    return NextResponse.json({ currency, date: '2026-11-04', rates: fallbackRates })
  }
}
