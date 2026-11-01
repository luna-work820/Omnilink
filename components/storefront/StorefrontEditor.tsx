'use client'

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { Puck, Render, usePuck, type Config, type Data, type Plugin } from '@puckeditor/core'
import '@puckeditor/core/puck.css'
import DynamicSectionRenderer from '@/components/storefront/DynamicSectionRenderer'
import ThemeRoot from '@/components/theme/ThemeRoot'
import { saveStorefrontSchemaAction, publishStorefrontAction } from '@/app/actions/store'
import { storefrontThemeOverrides } from '@/lib/storefront/theme-overrides'
import { createDefaultSchema, type SectionType, type StorefrontSchema } from '@/lib/storefront/schema'
import { fromPuckData, makePuckSection, puckSectionLabels, toPuckData, type StorefrontPuckProps } from '@/lib/storefront/puck-adapter'
import type { StorefrontProduct } from '@/lib/storefront/types'
import { getStorefrontDemoProducts } from '@/lib/storefront/demo-products'
import { ALL_STYLES } from '@/lib/themes/registry'
import { ArrowLeft, Expand, Palette } from 'lucide-react'

const types: SectionType[] = [
  'header', 'hero', 'featured_products', 'collection', 'image_text',
  'rich_text', 'cta', 'footer', 'testimonials', 'faq',
]

interface Props {
  store: { id: string; store_name: string; store_slug: string }
  initialSchema?: StorefrontSchema | null
  products: StorefrontProduct[]
}

interface HeaderActionsProps {
  busy: boolean
  dirty: boolean
  message: string
  onBack: () => void
  onSave: (data: Data) => void
  onPublish: (data: Data) => void
}

function HeaderActions({ busy, dirty, message, onBack, onSave, onPublish }: HeaderActionsProps) {
  const { appState, dispatch, selectedItem } = usePuck()
  const currentData = appState.data as Data
  const selectedId = selectedItem?.props.id

  useEffect(() => {
    if (selectedId) dispatch({ type: 'setUi', ui: { rightSideBarVisible: true }, recordHistory: false })
  }, [selectedId, dispatch])

  return <div className={`flex h-10 items-center gap-2 ${process.env.NODE_ENV === 'development' ? 'mr-14' : ''}`}>
    <button type="button" onClick={onBack} className="flex h-10 items-center gap-1.5 rounded-md border border-[#d8d8d8] bg-white px-3 text-sm font-medium text-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black">
      <ArrowLeft size={16} aria-hidden="true" />返回预览
    </button>
    <span aria-live="polite" className="hidden max-w-36 truncate text-xs text-[#666] sm:inline">{message || (dirty ? '未保存' : '')}</span>
    <button type="button" onClick={() => onSave(currentData)} disabled={busy || !dirty} className="h-10 rounded-md border border-[#d8d8d8] bg-white px-4 text-sm font-medium text-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black disabled:opacity-45">
      保存草稿
    </button>
    <button type="button" onClick={() => onPublish(currentData)} disabled={busy} className="h-10 rounded-[var(--radius-control)] bg-[var(--accent-primary)] px-4 text-sm font-medium text-white transition-colors hover:bg-[var(--accent-primary-hover)] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-secondary)] disabled:opacity-45">
      发布
    </button>
  </div>
}

export default function StorefrontEditor({ store, initialSchema, products }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [schema, setSchema] = useState<StorefrontSchema>(initialSchema ?? createDefaultSchema())
  const [data, setData] = useState<Data>(() => toPuckData(initialSchema ?? createDefaultSchema()))
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [dirty, setDirty] = useState(false)
  useEffect(() => {
    if (!dirty) return
    const beforeUnload = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [dirty])
  const previewProducts = useMemo(
    () => store.id === 'demo-store'
      ? getStorefrontDemoProducts(schema.theme.language ?? 'en')
      : products,
    [products, schema.theme.language, store.id]
  )

  const config = useMemo<Config>(() => {
    const components: Config['components'] = {}
    for (const type of types) {
      const defaultSection = makePuckSection(type, `new-${type}`)
      components[type] = {
        label: puckSectionLabels[type],
        defaultProps: {
          section: defaultSection,
          title: String(defaultSection.content.title ?? ''),
          subtitle: String(defaultSection.content.subtitle ?? ''),
          description: String(defaultSection.content.description ?? ''),
          imageUrl: String(defaultSection.content.imageUrl ?? ''),
        },
        fields: {
          title: { type: 'text', label: '标题' },
          subtitle: { type: 'textarea', label: '副标题' },
          description: { type: 'textarea', label: '正文' },
          ...(type === 'hero' || type === 'image_text' || type === 'collection'
            ? { imageUrl: { type: 'text' as const, label: '图片地址' } }
            : {}),
        },
        render: (props) => {
          const { id, section, title, subtitle, description, imageUrl } = props as unknown as StorefrontPuckProps
          const base = section?.type === type ? section : makePuckSection(type, id)
          const language = schema.theme.language ?? 'en'
          const edited = { title, subtitle, description, imageUrl }
          const localized = { ...(base.content[language] as Record<string, unknown> | undefined), ...edited }
          return <DynamicSectionRenderer
            section={{
              ...base,
              id,
              content: { ...base.content, ...edited, [language]: localized },
            }}
            storeSlug={store.store_slug}
            products={previewProducts}
            globalInfo={schema.globalInfo}
            contact={schema.contact}
            social={schema.social}
            language={language}
          />
        },
      }
    }
    return {
      components,
      root: {
        fields: {},
        render: ({ children }: { children: ReactNode }) => <ThemeRoot themeId={schema.theme.themeId}>
          <div
            className="min-h-screen bg-[var(--th-color-background)] text-[var(--th-color-text)] [font-family:var(--th-font-body)]"
            style={storefrontThemeOverrides(schema.theme, schema.theme.language) as CSSProperties}
          >{children}</div>
        </ThemeRoot>,
      },
    }
  }, [previewProducts, schema, store.store_slug])

  const plugins = useMemo<Plugin[]>(() => [{
    name: 'omnilink-style',
    label: '视觉风格',
    icon: <Palette size={18} aria-hidden="true" />,
    render: () => <div className="p-4 space-y-3">
      <h3 className="text-sm font-semibold text-black">视觉风格库</h3>
      <p className="text-xs text-[#666]">只切换主题；区块、文案和商品保持原样。</p>
      <div className="grid gap-2">
        {ALL_STYLES.map((style) => <button
          type="button"
          key={style.id}
          onClick={() => {
            setSchema((current) => ({ ...current, theme: { ...current.theme, themeId: style.id } }))
            setDirty(true)
          }}
          aria-pressed={schema.theme.themeId === style.id}
          className={`min-h-11 rounded-[var(--radius-control)] border px-3 text-left text-sm font-medium ${schema.theme.themeId === style.id ? 'border-[var(--accent-secondary)] bg-[var(--accent-secondary-soft)] text-[var(--accent-secondary)]' : 'border-[var(--border-subtle)] bg-white text-[var(--ink)] hover:border-[var(--accent-secondary)]'}`}
        >{style.name}</button>)}
      </div>
    </div>,
  }], [schema.theme.themeId])

  async function persist(nextData: Data, publish: boolean) {
    setBusy(true)
    setMessage('')
    try {
      const nextSchema = fromPuckData(nextData, schema)
      const result = publish
        ? await publishStorefrontAction(store.id, nextSchema)
        : await saveStorefrontSchemaAction(store.id, nextSchema)
      if (!result.success) throw new Error(result.error)
      setSchema(nextSchema)
      setDirty(false)
      setMessage(publish ? '已发布' : '草稿已保存')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '保存失败')
    } finally {
      setBusy(false)
    }
  }

  if (!expanded) {
    return <section className="mx-auto flex h-full min-h-0 w-full max-w-[1160px] flex-col gap-3">
      <div className="flex h-10 shrink-0 items-center justify-center">
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="flex h-9 items-center gap-1.5 rounded-md border border-[#d8d8d8] bg-white px-3 text-xs font-medium text-[#333] transition-colors hover:bg-[#f5f5f5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
        >
          <Expand size={14} aria-hidden="true" />展开编辑
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-[#dedede] bg-white">
        <div className="h-full overflow-auto" aria-label="店铺网页预览">
          <div inert><Render config={config} data={data} /></div>
        </div>
      </div>
    </section>
  }

  return <div className="fixed inset-0 z-[1000] bg-white">
    <Puck
      config={config}
      plugins={plugins}
      data={data}
      onChange={(next) => { setData(next); setDirty(true) }}
      headerTitle={store.store_name}
      overrides={{
        headerActions: () => <HeaderActions
          busy={busy}
          dirty={dirty}
          message={message}
          onBack={() => setExpanded(false)}
          onSave={(next) => void persist(next, false)}
          onPublish={(next) => void persist(next, true)}
        />,
      }}
      ui={{ rightSideBarVisible: false }}
      iframe={{ enabled: true, syncHostStyles: true }}
      height="100dvh"
    />
  </div>
}
