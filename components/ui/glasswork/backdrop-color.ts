export function parseBackdropColor(value: string): [number, number, number] | null {
  const srgb = /^color\(srgb\s/.test(value)
  if (!srgb && !/^rgba?\(/.test(value)) return null
  const values = value.match(/[\d.]+/g)?.map(Number)
  if (!values || values.length < 3 || (values[3] ?? 1) === 0) return null
  const scale = srgb ? 255 : 1
  return values.slice(0, 3).map((channel) => Math.max(0, Math.min(255, channel * scale))) as [number, number, number]
}
