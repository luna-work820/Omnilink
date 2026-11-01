export type OutboundPlatform = 'xiaohongshu' | 'douyin'
export type OutboundLinks = Partial<Record<OutboundPlatform, string>>

const hosts: Record<OutboundPlatform, string[]> = {
  xiaohongshu: ['xiaohongshu.com', 'xhslink.com'],
  douyin: ['douyin.com', 'iesdouyin.com'],
}

export function validOutboundUrl(platform: OutboundPlatform, value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && hosts[platform].some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`))
  } catch {
    return false
  }
}

export function readOutboundLinks(value: unknown): OutboundLinks {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const links = value as Record<string, unknown>
  return Object.fromEntries(
    (Object.keys(hosts) as OutboundPlatform[])
      .filter((platform) => typeof links[platform] === 'string' && validOutboundUrl(platform, links[platform] as string))
      .map((platform) => [platform, links[platform] as string]),
  )
}
