'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Eye, EyeOff, Grid2X2, ImageIcon, List, LoaderCircle, Search } from 'lucide-react'
import type { ProductRow } from '@/components/product/ProductTable'
import { useDashboardWorkspace } from '@/components/dashboard/DashboardWorkspaceProvider'

export function ProductAssetLibrary({ products }: { products: ProductRow[] }) {
  const [query, setQuery] = useState('')
  const [grid, setGrid] = useState(true)
  const { registerProducts } = useDashboardWorkspace()

  useEffect(() => {
    registerProducts(products.filter((product) => (product.listingType || 'product') === 'product').map((product) => ({ id: product.id, name: product.name, sku: product.sku })))
  }, [products, registerProducts])
  const needle = query.trim().toLowerCase()
  const filteredProducts = products.filter((product) => (product.listingType || 'product') === 'product' && (!needle || [product.name, product.sku, product.category].some((value) => value?.toLowerCase().includes(needle))))

  return (
    <section className="h-full overflow-y-auto px-6 py-6">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-col gap-4 pb-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">商品</h1>
          </div>
          <Link href="/dashboard/products/new" className="inline-flex h-11 items-center justify-center rounded-full bg-[var(--text-primary)] px-5 text-sm font-medium text-[var(--surface)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-primary)]">添加商品</Link>
        </header>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 pb-3">
            <label className="flex h-10 min-h-10 w-full items-center gap-2 rounded-md border-[0.5px] border-[var(--border-subtle)] bg-[var(--surface)] px-3 focus-within:border-[var(--primary)] sm:w-64">
              <Search className="h-3.5 w-3.5 text-[var(--lavender)]" aria-hidden="true" />
              <span className="sr-only">搜索商品</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索名称、SKU 或分类" className="w-full bg-transparent text-base outline-none sm:text-xs" />
            </label>
            <button type="button" onClick={() => setGrid((value) => !value)} className="grid h-10 w-10 shrink-0 place-items-center rounded-md border-[0.5px] border-[var(--border-subtle)] text-[var(--lavender)] hover:bg-[var(--surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--primary)] focus-visible:outline-offset-2" aria-label={grid ? '切换列表视图' : '切换网格视图'} title={grid ? '列表视图' : '网格视图'}>{grid ? <List className="h-4 w-4" /> : <Grid2X2 className="h-4 w-4" />}</button>
          </div>
        </div>

        <ProductView products={filteredProducts} grid={grid} query={query} onClear={() => setQuery('')} />
      </div>
    </section>
  )
}

function ProductView({ products, grid, query, onClear }: { products: ProductRow[]; grid: boolean; query: string; onClear: () => void }) {
  if (!products.length) return <EmptyLibrary icon={<Grid2X2 className="h-7 w-7" />} title={query ? `没有找到“${query}”` : '暂无商品'} onClear={query ? onClear : undefined} />
  return <div className={`mt-6 ${grid ? 'grid gap-6 sm:grid-cols-2 lg:grid-cols-3' : 'space-y-2'}`}>{products.map((product) => grid ? <ProductCard key={product.id} product={product} /> : <ProductRowItem key={product.id} product={product} />)}</div>
}

function ProductCard({ product }: { product: ProductRow }) {
  return (
    <article className="ui-card ui-card--interactive group flex min-h-[390px] flex-col transition-colors hover:bg-[var(--interactive-hover)] motion-reduce:transition-none">
      <Link href={`/dashboard/products/${product.id}`} className="flex min-h-0 flex-1 flex-col focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--primary)] focus-visible:outline-offset-2">
        <div className="relative min-h-0 flex-1 overflow-hidden rounded-t-[24px] bg-[var(--surface-muted)]">
          {product.image_url ? <Image src={product.image_url} alt={product.name} fill unoptimized className="object-cover" /> : <div className="flex h-full items-center justify-center text-[var(--lavender)]"><ImageIcon className="h-8 w-8" aria-hidden="true" /></div>}
        </div>
        <div className="shrink-0 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="mb-1 text-xs font-semibold tracking-[0.08em] text-[var(--text-muted)]">{product.category || '未分类商品'}</p>
              <h2 className="truncate text-sm font-semibold">{product.name}</h2>
              <p className="mt-1 truncate text-xs text-[var(--lavender)]">库存量：{product.inventory ?? 0}{product.sku ? `，${product.sku}` : ''}</p>
            </div>
            <span className="shrink-0 tabular-nums text-sm font-semibold">{product.priceMode === 'inquiry' ? '询价' : product.priceMode === 'free' ? '免费' : `¥${Number(product.price || 0).toLocaleString('zh-CN')}`}</span>
          </div>
        </div>
      </Link>
      <div className="flex min-h-12 items-center justify-between gap-2 border-t-[0.5px] border-[var(--border-subtle)] px-3">
        {product.channel_visibility_supported ? <>
          <span className={`truncate text-xs ${product.consumer_visible ? 'text-[var(--primary)]' : 'text-[var(--text-muted)]'}`}>{product.consumer_visible ? '发现页可见' : '未发布到发现页'}</span>
          <StorefrontVisibilityButton product={product} />
        </> : <span className="ml-auto text-xs text-[var(--text-muted)]">演示数据</span>}
      </div>
    </article>
  )
}

function ProductRowItem({ product }: { product: ProductRow }) {
  return <div className="flex min-h-16 items-center gap-3 rounded-lg border-[0.5px] border-[var(--border-subtle)] bg-[var(--surface)] p-2.5"><div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-[var(--surface-muted)]">{product.image_url ? <Image src={product.image_url} alt="" fill unoptimized className="object-cover" /> : <ImageIcon className="m-3 h-6 w-6 text-[var(--lavender)]" aria-hidden="true" />}</div><Link href={`/dashboard/products/${product.id}`} className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{product.name}</p><p className="mt-1 truncate text-xs text-[var(--lavender)]">库存量：{product.inventory ?? 0}</p></Link><span className="hidden tabular-nums text-xs font-semibold sm:block">{product.priceMode === 'inquiry' ? '询价' : product.priceMode === 'free' ? '免费' : `¥${Number(product.price || 0).toLocaleString('zh-CN')}`}</span>{product.channel_visibility_supported ? <StorefrontVisibilityButton product={product} /> : <span className="shrink-0 text-xs text-[var(--text-muted)]">演示数据</span>}
  </div>
}

function StorefrontVisibilityButton({ product }: { product: ProductRow }) {
  const [visible, setVisible] = useState(Boolean(product.consumer_visible))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function toggleVisibility() {
    setBusy(true)
    setError('')
    try {
      const response = await fetch(`/api/merchant/products/${product.id}/storefront`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visible: !visible }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || '更新失败')
      setVisible(Boolean(result.visible))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '更新失败')
    } finally {
      setBusy(false)
    }
  }

  return <div className="relative shrink-0" title={error || undefined}>
    <button type="button" onClick={toggleVisibility} disabled={busy} aria-pressed={visible} aria-label={`${visible ? '从发现页下架' : '在发现页展示'}：${product.name}`} className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-[var(--radius-control)] border-[0.5px] border-[var(--border-subtle)] px-2.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--primary)] focus-visible:outline-offset-2 disabled:cursor-wait disabled:opacity-60">
      {busy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : visible ? <EyeOff className="h-3.5 w-3.5" aria-hidden="true" /> : <Eye className="h-3.5 w-3.5" aria-hidden="true" />}
      {visible ? '下架' : '展示'}
    </button>
    {error && <span role="status" className="absolute bottom-full right-0 z-10 mb-1 max-w-56 rounded-md border border-red-200 bg-white px-2 py-1 text-left text-xs leading-4 text-red-700 shadow-sm">{error}</span>}
  </div>
}

function EmptyLibrary({ icon, title, onClear }: { icon: React.ReactNode; title: string; onClear?: () => void }) {
  return <div className="mt-6 flex min-h-80 flex-col items-center justify-center rounded-[var(--radius-card)] border border-dashed border-[var(--border)] bg-[var(--surface)] text-center text-[var(--lavender)]"><span>{icon}</span><h2 className="mt-4 text-base font-semibold text-[var(--ink)]">{title}</h2>{onClear && <button type="button" onClick={onClear} className="mt-4 min-h-9 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-3 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--primary)] focus-visible:outline-offset-2">清除搜索</button>}</div>
}
