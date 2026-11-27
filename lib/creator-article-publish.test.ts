import { beforeEach, describe, expect, it, vi } from 'vitest'
import { articlePublication } from './creator-publication-document'
import { gildedEastArticle } from '@/components/consumer-market/data/theme-article-demo'

const mocks = vi.hoisted(() => ({
  getLocal: vi.fn(), saveLocal: vi.fn(), archiveLocal: vi.fn(),
  readRemote: vi.fn(), saveRemote: vi.fn(), upload: vi.fn(),
}))
vi.mock('@/lib/creator-publications', () => ({
  getLocalPublication: mocks.getLocal, saveLocalPublication: mocks.saveLocal, archiveLocalPublication: mocks.archiveLocal,
}))
vi.mock('@/lib/creator-publication-client', () => ({
  readRemotePublication: mocks.readRemote, saveRemotePublication: mocks.saveRemote, uploadArticleImages: mocks.upload,
}))
import { publishManagedArticle } from './creator-article-publish'

const id = 'article-id'
const ownerKey = 'preview-owner'
const pendingArticle = { ...gildedEastArticle, title: '待发布的修改' }

beforeEach(() => {
  vi.clearAllMocks()
  mocks.saveLocal.mockResolvedValue({})
  mocks.saveRemote.mockResolvedValue({})
  mocks.archiveLocal.mockResolvedValue(undefined)
  mocks.upload.mockImplementation(async (article) => article)
})

describe('publishing an article from content management', () => {
  it('publishes the saved pending version to the same local record', async () => {
    const pending = { kind: 'article', article: pendingArticle }
    mocks.getLocal.mockResolvedValue({ id, status: 'published', content: { kind: 'article', article: gildedEastArticle }, pending })
    await publishManagedArticle({ id, ownerKey, local: true, previewMode: true })
    expect(mocks.saveLocal).toHaveBeenCalledWith(ownerKey, pending, 'published', id)
    expect(mocks.saveRemote).not.toHaveBeenCalled()
  })

  it('publishes the latest remote draft using the existing record id', async () => {
    const pending = articlePublication(pendingArticle)
    mocks.readRemote.mockResolvedValue({ id, status: 'published', content: articlePublication(gildedEastArticle), pending })
    await publishManagedArticle({ id, ownerKey, local: false, previewMode: false })
    expect(mocks.saveRemote).toHaveBeenCalledWith(pending, 'published', id)
  })

  it('blocks an incomplete shop card before saving', async () => {
    const article = { ...gildedEastArticle, blocks: [...gildedEastArticle.blocks, { type: 'productLink', props: { kind: 'shop', url: '', name: '' } }] }
    mocks.getLocal.mockResolvedValue({ id, status: 'draft', content: { kind: 'article', article } })
    await expect(publishManagedArticle({ id, ownerKey, local: true, previewMode: true })).rejects.toThrow('请补全商品或店铺卡片信息')
    expect(mocks.saveLocal).not.toHaveBeenCalled()
  })

  it('uploads a local draft before publishing it online', async () => {
    mocks.getLocal.mockResolvedValue({ id, status: 'draft', content: { kind: 'article', article: pendingArticle } })
    await publishManagedArticle({ id, ownerKey, local: true, previewMode: false })
    expect(mocks.upload).toHaveBeenCalledWith(pendingArticle, expect.any(Map))
    expect(mocks.saveRemote).toHaveBeenCalledWith(articlePublication(pendingArticle), 'published')
    expect(mocks.archiveLocal).toHaveBeenCalledWith(ownerKey, id)
  })
})
