export type ExchangeRates = { date: string; rates: Record<string, number> }

export function convertCurrency(amount: number, source: string | undefined, target: string, snapshot?: ExchangeRates | null) {
  if (!source || !Number.isFinite(amount) || amount < 0) return null
  if (source === target) return amount
  const from = snapshot?.rates[source], to = snapshot?.rates[target]
  if (!from || !to || !Number.isFinite(from) || !Number.isFinite(to) || from <= 0 || to <= 0) return null
  const converted = amount / from * to
  return Number.isFinite(converted) ? converted : null
}

export function freshExchangeRates(snapshot: ExchangeRates, now = Date.now()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(snapshot.date)) return false
  const date = Date.parse(`${snapshot.date}T00:00:00Z`)
  return Number.isFinite(date) && new Date(date).toISOString().slice(0, 10) === snapshot.date
    && date <= now && now - date <= 7 * 24 * 60 * 60 * 1000
}
