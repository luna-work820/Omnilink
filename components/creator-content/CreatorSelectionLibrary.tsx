'use client'

import Image from 'next/image'
import { useMemo, useState, useSyncExternalStore } from 'react'
import { Search, ShoppingBag } from 'lucide-react'
import type { ProductItem } from '@/components/consumer-market/types'

const STORAGE_KEY = 'omnilink.creator-selection.v1'
const subscribe = (callback: () => void) => {
  window.addEventListener('storage', callback)
  window.addEventListener('omnilink:creator-selection', callback)
  return () => {
    window.removeEventListener('storage', callback)
    window.removeEventListener('omnilink:creator-selection', callback)
  }
}
const getSelectedSnapshot = () => window.localStorage.getItem(STORAGE_KEY) || '[]'
const getServerSnapshot = () => '[]'

export function CreatorSelectionLibrary({ items }: { items: ProductItem[] }) {
  const [query, setQuery] = useState('')
  const snapshot = useSyncExternalStore(subscribe, getSelectedSnapshot, getServerSnapshot)
  const selected = useMemo(() => {
    try {
      const value: unknown = JSON.parse(snapshot)
      return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : []
    } catch {
      return []
    }
  }, [snapshot])

  const visible = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase()
    if (!normalized) return items
    return items.filter((item) => [item.name, item.storeName, item.category, item.shortDescription]
      .some((value) => value?.toLocaleLowerCase().includes(normalized)))
  }, [items, query])

  const toggle = (id: string) => {
    const next = selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id]
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    window.dispatchEvent(new Event('omnilink:creator-selection'))
  }

  return <section className="mx-auto max-w-[1120px] px-5 py-8 sm:px-8">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-xs text-[var(--text-secondary)]">创作者中心</p><h1 className="mt-1 text-2xl font-semibold">选品库</h1></div>
      <p className="text-sm text-[var(--text-secondary)]">已选 {selected.length} 件</p>
    </header>
    <label className="mt-6 flex h-11 max-w-xl items-center gap-2 border-b border-[var(--border-subtle)] px-1 focus-within:border-[#315BFF]">
      <Search size={17} className="shrink-0 text-[var(--text-secondary)]" aria-hidden="true" />
      <span className="sr-only">检索商品</span>
      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索商品、店铺或分类" className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--text-secondary)]" />
    </label>
    {visible.length ? <div className="mt-7 grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
      {visible.map((item) => {
        const isSelected = selected.includes(item.id)
        return <article key={item.id} className="group min-w-0">
          <div className="relative overflow-hidden rounded-[var(--radius-card)] bg-[var(--surface-muted)]">
            <Image unoptimized src={item.mainImage || '/consumer-market/product-image-pending.svg'} alt="" width={420} height={500} className="aspect-[4/5] w-full object-cover" />
            <button type="button" onClick={() => toggle(item.id)} aria-pressed={isSelected} className={`absolute bottom-2 right-2 inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-xs font-medium shadow-sm focus-visible:outline-2 focus-visible:outline-[#315BFF] ${isSelected ? 'bg-white text-[var(--text-primary)]' : 'bg-[var(--text-primary)] text-white'}`}>
              <ShoppingBag size={14} aria-hidden="true" />{isSelected ? '已选' : '加入选品'}
            </button>
          </div>
          <p className="mt-3 truncate text-xs text-[var(--text-secondary)]">{item.storeName}</p>
          <h2 className="mt-1 line-clamp-2 min-h-10 text-sm font-medium leading-5">{item.name}</h2>
          <p className="mt-1 text-sm">{item.formattedPrice}</p>
        </article>
      })}
    </div> : <p className="mt-12 text-sm text-[var(--text-secondary)]">{items.length ? '没有找到匹配商品' : '暂时没有可选商品'}</p>}
  </section>
}
