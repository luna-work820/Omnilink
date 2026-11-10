export const MARKET_GLASS_PREFERENCES_KEY = 'omnilink-market-glass-preferences-v1'

export type MarketGlassPreferences = {
  light: number
  dark: number
}

export const DEFAULT_MARKET_GLASS_PREFERENCES: MarketGlassPreferences = {
  light: 1,
  dark: 1,
}

export function readMarketGlassPreferences(): MarketGlassPreferences {
  try {
    const saved = JSON.parse(window.localStorage.getItem(MARKET_GLASS_PREFERENCES_KEY) ?? 'null') as Partial<MarketGlassPreferences> | null
    return {
      light: clamp(saved?.light ?? 1),
      dark: clamp(saved?.dark ?? 1),
    }
  } catch {
    return DEFAULT_MARKET_GLASS_PREFERENCES
  }
}

export function applyMarketGlassPreferences(
  root: HTMLElement,
  preferences: MarketGlassPreferences = readMarketGlassPreferences(),
) {
  root.style.setProperty('--market-glass-strength-light', String(preferences.light))
  root.style.setProperty('--market-glass-strength-dark', String(preferences.dark))
}

export function saveMarketGlassPreference(mode: keyof MarketGlassPreferences, value: number) {
  const preferences = { ...readMarketGlassPreferences(), [mode]: clamp(value) }
  try {
    window.localStorage.setItem(MARKET_GLASS_PREFERENCES_KEY, JSON.stringify(preferences))
  } catch {
    // Keep the in-session value if browser storage is unavailable.
  }
  const root = document.querySelector<HTMLElement>('.consumer-market-shell')
  if (root) applyMarketGlassPreferences(root, preferences)
  window.dispatchEvent(new Event('market-glass-preferences'))
  return preferences
}

function clamp(value: number) {
  return Math.max(0, Math.min(1.5, Number.isFinite(value) ? value : 1))
}
