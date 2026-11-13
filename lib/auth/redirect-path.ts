export function safeInternalRedirectPath(value: unknown, fallback: string): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || /[\s\\]/.test(value)) {
    return fallback
  }

  return value
}
