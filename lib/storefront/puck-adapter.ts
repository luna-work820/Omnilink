import type { Data } from '@puckeditor/core'
import {
  createDefaultSchema,
  type SectionType,
  type StorefrontSchema,
  type StorefrontSection,
} from '@/lib/storefront/schema'

const sectionTypes: SectionType[] = [
  'header', 'hero', 'featured_products', 'collection', 'image_text',
  'rich_text', 'cta', 'footer', 'testimonials', 'faq',
]

export const puckSectionLabels: Record<SectionType, string> = {
  header: '导航栏',
  hero: '主视觉',
  featured_products: '精选商品',
  collection: '系列展示',
  image_text: '图文故事',
  rich_text: '品牌文字',
  cta: '行动入口',
  footer: '页脚',
  testimonials: '用户评价',
  faq: '常见问题',
}

type EditableKey = 'title' | 'subtitle' | 'description' | 'imageUrl'

export interface StorefrontPuckProps {
  id: string
  section: StorefrontSection
  title: string
  subtitle: string
  description: string
  imageUrl: string
}

export function makePuckSection(type: SectionType, id: string): StorefrontSection {
  const base = createDefaultSchema().sections.find((section) => section.type === type)
  return base
    ? { ...structuredClone(base), id, order: 0 }
    : { id, type, order: 0, visible: true, content: {} }
}

export function toPuckData(schema: StorefrontSchema): Data {
  const language = schema.theme.language ?? 'en'
  return {
    root: { props: {} },
    content: [...schema.sections]
      .sort((a, b) => a.order - b.order)
      .map((section) => {
        const localized = section.content[language] as Record<string, unknown> | undefined
        const value = (key: EditableKey) => String(localized?.[key] ?? section.content[key] ?? '')
        return ({
        type: section.type,
        props: {
          id: section.id,
          section: structuredClone(section),
          title: value('title'),
          subtitle: value('subtitle'),
          description: value('description'),
          imageUrl: value('imageUrl'),
        },
      })}),
  }
}

export function fromPuckData(data: Data, previous: StorefrontSchema): StorefrontSchema {
  const priorSections = new Map(previous.sections.map((section) => [section.id, section]))
  const ids = new Set<string>()
  const sections = data.content.map((item, order) => {
    if (!sectionTypes.includes(item.type as SectionType)) {
      throw new Error(`Unsupported section type: ${item.type}`)
    }
    const props = item.props as unknown as Partial<StorefrontPuckProps>
    const id = typeof props.id === 'string' && props.id ? props.id : crypto.randomUUID()
    if (ids.has(id)) throw new Error(`Duplicate section ID: ${id}`)
    ids.add(id)
    const type = item.type as SectionType
    const saved = priorSections.get(id)
    const embedded = props.section?.type === type ? props.section : undefined
    const base = structuredClone(saved?.type === type ? saved : embedded ?? makePuckSection(type, id))
    const content = { ...base.content }
    const language = previous.theme.language ?? 'en'
    const originalLocalized = embedded?.content[language] as Record<string, unknown> | undefined
    const localized = { ...(content[language] as Record<string, unknown> | undefined) }
    for (const key of ['title', 'subtitle', 'description', 'imageUrl'] as EditableKey[]) {
      if (typeof props[key] !== 'string') continue
      const original = originalLocalized?.[key] ?? embedded?.content[key]
      if (props[key] !== String(original ?? '')) {
        if (language === 'zh') localized[key] = props[key]
        else {
          content[key] = props[key]
          if (content.en && typeof content.en === 'object') localized[key] = props[key]
        }
      }
    }
    if (Object.keys(localized).length) content[language] = localized
    return { ...base, id, type, order, content }
  })

  return { ...structuredClone(previous), sections }
}
