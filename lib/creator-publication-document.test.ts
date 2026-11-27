import { describe, expect, it } from 'vitest'
import { articlePublication, creatorMediaPath, parsePublicationDocument, publicationAssetPaths, publicationDefaults, publicationScene, publicationValidation } from './creator-publication-document'
import { GILDED_EAST_POST_ID, gildedEastArticle } from '@/components/consumer-market/data/theme-article-demo'

const path = '20000000-0000-4000-8000-000000000001/10000000-0000-4000-8000-000000000001/40000000-0000-4000-8000-000000000001.webp'
const image = `/api/creator-posts/media/${path}`
const doc = { version: 1, kind: 'image', fields: { ...publicationDefaults, title: '正式图文' }, media: [image], coverUrl: image }
describe('creator publication documents', () => {
  it('accepts image posts without requiring unrelated catalog products', () => {
    const result = parsePublicationDocument(doc)!
    expect(result.fields.title).toBe('正式图文')
    expect(publicationValidation(result, 'published')).toBeNull()
    expect(publicationAssetPaths(result)).toEqual([path])
  })
  it.each(['blob:http://localhost/file', 'data:image/png;base64,xxx', 'javascript:alert(1)'])('rejects browser-only or unsafe persisted assets: %s', (url) => {
    expect(parsePublicationDocument({ ...doc, media: [url] })).toBeNull()
  })
  it('enforces visibility, media kind and future scheduling', () => {
    expect(parsePublicationDocument({ ...doc, fields: { ...doc.fields, visibility: 'friends' } })).toBeNull()
    expect(parsePublicationDocument({ ...doc, kind: 'video' })).toBeNull()
    expect(publicationValidation(parsePublicationDocument(doc)!, 'scheduled')).toContain('将来')
    expect(creatorMediaPath('/api/creator-posts/media/../secret.webp')).toBeNull()
  })
  it('preserves article layout and rejects unrenderable blocks and unsafe links', () => {
    const article = { version: 2, title: doc.fields.title, background: 'blue-2', cover: { url: image, position: 70 }, blocks: [{ type: 'paragraph', content: [{ type: 'text', text: '长文内容', styles: {} }] }], updatedAt: 1 }
    const input = { ...doc, kind: 'article', media: [], article }
    expect(parsePublicationDocument(input)).toMatchObject({ excerpt: '长文内容', article: { background: 'blue-2', cover: { position: 70 } } })
    expect(parsePublicationDocument({ ...input, article: { ...article, blocks: [{ type: 'unknown' }] } })).toBeNull()
    expect(parsePublicationDocument({ ...input, article: { ...article, blocks: [{ type: 'paragraph', content: [{ type: 'unknownInline' }] }] } })).toBeNull()
    expect(parsePublicationDocument({ ...input, article: { ...article, blocks: [{ type: 'productLink', props: { url: 'https://example.com', name: 123, price: '', image: '' } }] } })).toBeNull()
    expect(parsePublicationDocument({ ...input, article: { ...article, blocks: [{ type: 'paragraph', content: [{ type: 'link', href: 'javascript:alert(1)', content: [] }] }] } })).toBeNull()
  })
  it('keeps the article, feed card and shop link tied to the same publication', () => {
    const article = { ...gildedEastArticle, title: '修改后的文章' }
    const document = parsePublicationDocument(articlePublication(article))!
    const post = publicationScene(GILDED_EAST_POST_ID, document, '创作者')

    expect(publicationValidation(document, 'published')).toBeNull()
    expect(post).toMatchObject({ id: GILDED_EAST_POST_ID, title: article.title, coverImage: article.cover?.url, publication: { article: { title: article.title } } })
    expect(document.article?.blocks.find((block) => block.type === 'productLink')).toMatchObject({
      props: {
        kind: 'shop',
        url: 'https://shop383283250.taobao.com/',
        gallery: expect.arrayContaining([
          expect.objectContaining({ url: '/consumer-market/theme-wuyanyihe-mingzhu.jpg', name: '明珠夫人', price: '188-1598 元', link: 'https://item.taobao.com/item.htm?id=987784779050' }),
          expect.objectContaining({ name: '东方瓷', link: 'https://item.taobao.com/item.htm?id=989844810065' }),
          expect.objectContaining({ name: '墨羽金枝', link: 'https://item.taobao.com/item.htm?id=991339788142' }),
          expect.objectContaining({ name: '鲤花疏影', link: 'https://item.taobao.com/item.htm?id=994301133587' }),
          expect.objectContaining({ url: '/consumer-market/theme-wuyanyihe-p5.jpg', name: '东方既白', price: '457-768 元', link: 'https://item.taobao.com/item.htm?id=1084481841677' }),
        ]),
      },
    })
    expect(post.description).toContain('当极致的东方绮丽')
  })
})
