import { describe, expect, it } from 'vitest'
import { readOutboundLinks, validOutboundUrl } from '../outbound-links'

describe('outbound links', () => {
  it('accepts only HTTPS links on the chosen platform', () => {
    expect(validOutboundUrl('xiaohongshu', 'https://www.xiaohongshu.com/explore/123')).toBe(true)
    expect(validOutboundUrl('douyin', 'https://v.douyin.com/abc')).toBe(true)
    expect(validOutboundUrl('xiaohongshu', 'https://xiaohongshu.com.evil.example/item')).toBe(false)
    expect(validOutboundUrl('douyin', 'javascript:alert(1)')).toBe(false)
    expect(readOutboundLinks({ xiaohongshu: 'https://xhslink.com/abc', douyin: 'http://douyin.com/item' }))
      .toEqual({ xiaohongshu: 'https://xhslink.com/abc' })
  })
})
