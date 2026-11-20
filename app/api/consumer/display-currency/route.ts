import { NextResponse, type NextRequest } from 'next/server'
import { getExchangeRates } from '@/lib/consumer-advisor/exchange-rates-server'

const currencyByCountry: Record<string, string> = {
  CN: 'CNY', US: 'USD', CA: 'CAD', GB: 'GBP', JP: 'JPY', KR: 'KRW',
  HK: 'HKD', SG: 'SGD', AU: 'AUD', NZ: 'NZD', CH: 'CHF',
  DE: 'EUR', FR: 'EUR', IT: 'EUR', ES: 'EUR', NL: 'EUR', BE: 'EUR',
  AT: 'EUR', IE: 'EUR', PT: 'EUR', FI: 'EUR', GR: 'EUR', LU: 'EUR',
}

export async function GET(request: NextRequest) {
  const country = request.headers.get('x-vercel-ip-country')
    || request.headers.get('cf-ipcountry')
    || request.nextUrl.searchParams.get('region')
    || 'CN'
  const currency = currencyByCountry[country.toUpperCase()] || 'CNY'

  const snapshot = await getExchangeRates()
  return NextResponse.json({ currency, date: snapshot?.date ?? null, rates: snapshot?.rates ?? null })
}
