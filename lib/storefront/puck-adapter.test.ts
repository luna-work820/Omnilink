import { describe, expect, it } from 'vitest'
import { createDefaultSchema, normalizeStorefrontSchema } from './schema'
import { fromPuckData, toPuckData } from './puck-adapter'

describe('StorefrontSchema and Puck data bridge', () => {
  it('preserves the original store data through an unchanged editor session', () => {
    const schema = createDefaultSchema()
    schema.theme = {
      themeId: 'glass', language: 'zh', fontFamily: 'songti-ming',
      accent: '#123456', radius: 12, customTokens: { '--brand': '#abcdef' },
    }
    schema.globalInfo = { brandName: '测试品牌', contact: { email: 'hello@example.com' } }
    schema.sections[1].settings = { animations: false, spacing: 32, custom: 'kept' }
    const restored = fromPuckData(toPuckData(schema), schema)
    expect(restored).toEqual(schema)
    expect(normalizeStorefrontSchema(restored)?.theme).toEqual(schema.theme)
  })

  it('edits one field and reorders sections without changing unrelated content', () => {
    const schema = createDefaultSchema()
    const data = toPuckData(schema)
    const first = data.content[0]
    const hero = data.content[1]
    data.content = [hero, first, ...data.content.slice(2)]
    hero.props.title = '新的标题'
    const next = fromPuckData(data, schema)
    expect(next.sections[0].id).toBe(hero.props.id)
    expect(next.sections[0].content.title).toBe('新的标题')
    expect(next.sections[0].content.zh).toEqual(schema.sections[1].content.zh)
    expect(next.sections[1].content).toEqual(schema.sections[0].content)
    expect(next.sections.map((section) => section.order)).toEqual(schema.sections.map((_, index) => index))
  })

  it('rejects an unknown section instead of publishing it', () => {
    const schema = createDefaultSchema()
    const data = toPuckData(schema)
    data.content[0].type = 'arbitrary_script'
    expect(() => fromPuckData(data, schema)).toThrow('Unsupported section type')
  })

  it('keeps content when Puck duplicates a section with a new ID', () => {
    const schema = createDefaultSchema()
    const data = toPuckData(schema)
    const duplicate = structuredClone(data.content[1])
    duplicate.props.id = 'copied-hero'
    data.content.push(duplicate)
    const next = fromPuckData(data, schema)
    expect(next.sections.at(-1)?.id).toBe('copied-hero')
    expect(next.sections.at(-1)?.content).toEqual(schema.sections[1].content)
  })
})
