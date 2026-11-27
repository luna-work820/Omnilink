import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  readPosts: vi.fn(),
  redirect: vi.fn((url: string) => { throw new Error(`redirect:${url}`) }),
}))

vi.mock('next/navigation', () => ({ redirect: mocks.redirect }))
vi.mock('@/lib/products/consumer-catalog-store', () => ({ readPublishedConsumerCatalog: vi.fn().mockResolvedValue({ products: [] }) }))
vi.mock('@/lib/supabase/server', () => ({ createClientServer: vi.fn().mockResolvedValue({ auth: { getUser: mocks.getUser } }) }))
vi.mock('@/lib/creator-publication-feed', () => ({ readPublishedContent: mocks.readPosts }))
vi.mock('@/lib/consumer-advisor/deepseek-key-cookie', () => ({ readDeepSeekKeyForUser: vi.fn() }))
vi.mock('@/components/consumer-market/App', () => ({ default: () => null }))
vi.mock('@/components/creator-content/CreatorDiscoveryPreview', () => ({ CreatorDiscoveryPreview: () => null }))
vi.mock('@/components/consumer-market/screens/PublicArticleReader', () => ({ PublicArticleReader: () => null }))

import ConsumerMarketPage from '@/app/discover/page'
import { PublicArticleReader } from '@/components/consumer-market/screens/PublicArticleReader'

const postId = '03b3daa1-c7e5-4e3a-b02b-6df83a5036e8'
const render = (post?: string) => ConsumerMarketPage({ searchParams: Promise.resolve({ post }) })

describe('public article sharing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getUser.mockResolvedValue({ data: { user: null } })
    mocks.readPosts.mockResolvedValue([])
  })
  afterEach(() => { vi.unstubAllEnvs() })

  it('renders a published article returned by the public feed for a guest', async () => {
    const article = { id: postId, publication: { kind: 'article' } }
    mocks.readPosts.mockResolvedValue([article])
    const result = await render(postId)
    expect(result.type).toBe(PublicArticleReader)
    expect(result.props.post).toBe(article)
    expect(mocks.readPosts).toHaveBeenCalledWith(expect.anything(), postId)
  })

  it('keeps the article destination when no public article is available', async () => {
    await expect(render(postId)).rejects.toThrow(`redirect:/login?next=${encodeURIComponent(`/discover?post=${postId}`)}`)
  })

  it('opens a shared article in a preview deployment', async () => {
    vi.stubEnv('VERCEL_ENV', 'preview')
    mocks.readPosts.mockResolvedValue([{ id: postId, publication: { kind: 'article' } }])
    const result = await render(postId)
    expect(result.type).toBe(PublicArticleReader)
  })

  it('does not expose other publication types through the guest article reader', async () => {
    mocks.readPosts.mockResolvedValue([{ id: postId, publication: { kind: 'video' } }])
    await expect(render(postId)).rejects.toThrow('redirect:/login?next=')
  })

  it('keeps the existing login behavior for the feed and invalid IDs', async () => {
    await expect(render()).rejects.toThrow('redirect:/login?next=%2Fdiscover')
    await expect(render('invalid')).rejects.toThrow('redirect:/login?next=%2Fdiscover')
    expect(mocks.readPosts).not.toHaveBeenCalled()
  })

  it('surfaces feed failures instead of asking guests to log in', async () => {
    mocks.readPosts.mockRejectedValue(new Error('feed unavailable'))
    await expect(render(postId)).rejects.toThrow('feed unavailable')
  })
})
