'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useLanguage } from '@/context/LanguageContext'
import StorefrontEditor from '@/components/storefront/StorefrontEditor'
import { TemplateSelector } from '@/components/store/TemplateSelector'
import type { StorefrontSchema } from '@/lib/storefront/schema'
import type { StorefrontProduct } from '@/lib/storefront/types'

interface StorefrontHubProps {
  store: {
    id: string
    store_name: string
    store_slug: string
    base_currency?: string
    currency?: string
  }
  storePage?: {
    id: string
    published?: boolean | null
    template_id?: string | null
    sections?: unknown
  } | null
  storefrontSchema?: StorefrontSchema | null
  storefrontProducts?: StorefrontProduct[]
}

type ActiveHubTab = 'editor' | 'templates'

export function StorefrontHub({
  store,
  storefrontSchema,
  storefrontProducts = [],
}: StorefrontHubProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tabParam = searchParams.get('tab') as ActiveHubTab | null
  const { isZh } = useLanguage()
  const [activeTab, setActiveTab] = useState<ActiveHubTab>(
    tabParam === 'templates' ? 'templates' : 'editor'
  )

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* ============================================================
          1. Segmented Control (分段控制器 - 主题色 var(--primary))
          ============================================================ */}
      <div className="flex items-center gap-1 p-1 rounded-[6px] bg-[var(--surface-muted)] dark:bg-[var(--surface-muted)]/60 border border-[var(--surface-muted)]/80 dark:border-[var(--surface-muted)]/80 max-w-max">
        <button
          type="button"
          onClick={() => setActiveTab('editor')}
          className={`px-3.5 py-1.5  text-xs font-bold transition-all shrink-0 cursor-pointer ${
            activeTab === 'editor'
              ? 'bg-[var(--primary)] text-[var(--surface)] shadow-xs'
              : 'text-[var(--lavender)] dark:text-[var(--lavender)] hover:text-[var(--lavender)] dark:hover:text-[var(--surface)]'
          }`}
        >
          {isZh ? '视觉装修' : 'Visual Builder'}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('templates')}
          className={`px-3.5 py-1.5  text-xs font-bold transition-all shrink-0 cursor-pointer ${
            activeTab === 'templates'
              ? 'bg-[var(--primary)] text-[var(--surface)] shadow-xs'
              : 'text-[var(--lavender)] dark:text-[var(--lavender)] hover:text-[var(--lavender)] dark:hover:text-[var(--surface)]'
          }`}
        >
          {isZh ? '视觉风格库' : 'Style Gallery'}
        </button>
      </div>

      {/* ============================================================
          2. 选项卡主体内容
          ============================================================ */}

      {/* Tab 1: 视觉装修工作台 (WYSIWYG Editor) */}
      {activeTab === 'editor' && (
        <StorefrontEditor
          store={store}
          initialSchema={storefrontSchema ?? undefined}
          products={storefrontProducts}
        />
      )}

      {/* Tab 2: 行业模板库 (Templates Gallery) */}
      {activeTab === 'templates' && (
        <div className="crextio-card p-6">
          <TemplateSelector
            storeId={store.id}
            onTemplateSelect={() => {
              router.refresh()
            }}
          />
        </div>
      )}
    </div>
  )
}
