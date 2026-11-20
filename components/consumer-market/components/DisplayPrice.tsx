'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { ProductItem } from '../types'
import { formatConsumerPrice } from '../services/cartHandoff'
import { convertCurrency, type ExchangeRates } from '@/lib/consumer-advisor/exchange-rates'

type DisplayRates = { currency: string; date: string | null; rates: Record<string, number> | null }
const DisplayRatesContext = createContext<DisplayRates | null>(null)

function browserRegion() {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const byZone: Record<string, string> = {
    'Asia/Shanghai': 'CN', 'Asia/Chongqing': 'CN', 'Asia/Hong_Kong': 'HK',
    'Asia/Tokyo': 'JP', 'Asia/Seoul': 'KR', 'Asia/Singapore': 'SG',
  }
  if (byZone[zone]) return byZone[zone]
  try { return new Intl.Locale(navigator.language).region || 'CN' } catch { return 'CN' }
}

export function DisplayPriceProvider({ children }: { children: ReactNode }) {
  const [displayRates, setDisplayRates] = useState<DisplayRates | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    fetch(`/api/consumer/display-currency?region=${browserRegion()}`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() as Promise<DisplayRates> : null)
      .then((data) => { if (data) setDisplayRates(data) })
      .catch(() => {})
    return () => controller.abort()
  }, [])

  return <DisplayRatesContext.Provider value={displayRates}>{children}</DisplayRatesContext.Provider>
}

export function DiscoveryPriceProvider({ active, currency, snapshot, children }: {
  active: boolean; currency?: string; snapshot?: ExchangeRates | null; children: ReactNode
}) {
  if (!active || !currency) return children
  return <DisplayRatesContext.Provider value={{ currency, date: snapshot?.date ?? null, rates: snapshot?.rates ?? null }}>{children}</DisplayRatesContext.Provider>
}

export function DisplayPrice({ product, amount, currency }: { product: ProductItem; amount?: number; currency?: string }) {
  const displayRates = useContext(DisplayRatesContext)
  const sourceCurrency = currency || product.currency || 'CNY'
  const sourceAmount = amount ?? product.price
  const sourcePrice = amount == null ? product.formattedPrice : formatConsumerPrice(sourceAmount, sourceCurrency)
  if (product.priceMode === 'unknown') return <span>{product.formattedPrice}</span>
  if (amount == null && (product.priceMode === 'inquiry' || product.priceMode === 'free' || sourceAmount === 0)) {
    return <span>{sourcePrice}</span>
  }
  const targetCurrency = displayRates?.currency
  const rates = displayRates?.rates
  const converted = targetCurrency ? convertCurrency(sourceAmount,sourceCurrency,targetCurrency,
    rates && displayRates?.date ? {rates,date:displayRates.date} : null) : null
  if (converted === null || !targetCurrency || sourceCurrency === targetCurrency) {
    return <span>{sourcePrice}</span>
  }
  const locale = targetCurrency === 'CNY' ? 'zh-CN' : undefined
  const formatted = new Intl.NumberFormat(locale, {
    style: 'currency', currency: targetCurrency, maximumFractionDigits: 0,
  }).format(converted)
  const prefix = amount == null && product.formattedPrice.startsWith('起 ') ? '起 ' : ''
  return <span title={`${sourcePrice}，按 ${displayRates.date} 参考汇率估算`}>{prefix}{formatted}</span>
}
