import { describe, expect, it } from 'vitest'
import { creatorMediaPath, parsePublicationDocument, publicationAssetPaths, publicationDefaults, publicationValidation } from './creator-publication-document'

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
})
