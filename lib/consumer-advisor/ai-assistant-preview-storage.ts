const PREVIEW_PROFILE_KEY = 'omnilink_ai_assistant_preview_profile'
const LEGACY_PREVIEW_PROFILE_KEYS = [
  'omnilink_preview_eva_profile',
  'omnilink-eva-demo-profile',
] as const

type ParsedValue = { found: true; value: Record<string, unknown> } | { found: false }

function readStoredProfile(storage: Storage, key: string): ParsedValue {
  try {
    const raw = storage.getItem(key)
    if (!raw) return { found: false }
    const value: unknown = JSON.parse(raw)
    return value && typeof value === 'object' && !Array.isArray(value)
      ? { found: true, value: value as Record<string, unknown> }
      : { found: false }
  } catch {
    return { found: false }
  }
}

export function readPreviewAiAssistantProfile(): Record<string, unknown> | null {
  if (typeof window === 'undefined') return null
  try {
    const storage = window.localStorage
    const current = readStoredProfile(storage, PREVIEW_PROFILE_KEY)
    if (current.found) {
      try {
        for (const key of LEGACY_PREVIEW_PROFILE_KEYS) storage.removeItem(key)
      } catch {
        // Keep the current profile usable if an old key cannot be removed.
      }
      return current.value
    }

    const legacyProfiles = LEGACY_PREVIEW_PROFILE_KEYS
      .map((key) => readStoredProfile(storage, key))
      .filter((result): result is Extract<ParsedValue, { found: true }> => result.found)
      .map((result) => result.value)
    if (legacyProfiles.length === 0) return null

    const merged = legacyProfiles.reduce<Record<string, unknown>>((profile, legacy) => ({ ...profile, ...legacy }), {})
    const memories = legacyProfiles.flatMap((profile) => Array.isArray(profile.memories) ? profile.memories : [])
    if (memories.length > 0) {
      merged.memories = [...new Map(memories
        .filter((memory): memory is Record<string, unknown> => Boolean(memory) && typeof memory === 'object' && !Array.isArray(memory))
        .map((memory) => [String(memory.id ?? JSON.stringify(memory)), memory])).values()]
    }
    try {
      storage.setItem(PREVIEW_PROFILE_KEY, JSON.stringify(merged))
      for (const key of LEGACY_PREVIEW_PROFILE_KEYS) storage.removeItem(key)
    } catch {
      // The in-memory profile remains usable if local storage is unavailable.
    }
    return merged
  } catch {
    return null
  }
}

export function savePreviewAiAssistantProfile(profile: unknown): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(PREVIEW_PROFILE_KEY, JSON.stringify(profile))
    for (const key of LEGACY_PREVIEW_PROFILE_KEYS) window.localStorage.removeItem(key)
  } catch {
    // Preview persistence is best effort.
  }
}
