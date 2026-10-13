'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { Check, Eye, EyeOff, FileImage, Grid2X2, ImageIcon, List, LoaderCircle, Package, Search } from 'lucide-react'
import { ProductCreateDialog } from '@/components/product/ProductCreateDialog'
import type { ProductRow } from '@/components/product/ProductTable'
import { useDashboardWorkspace } from '@/components/dashboard/DashboardWorkspaceProvider'

type LibraryView = 'products' | 'media'

export function ProductAssetLibrary({ products }: { products: ProductRow[] }) {
  const [view, setView] = useState<LibraryView>('products')
  const [query, setQuery] = useState('')
  const [grid, setGrid] = useState(true)
  const { registerProducts } = useDashboardWorkspace()

  useEffect(() => {
    registerProducts(products.map((product) => ({ id: product.id, name: product.name, sku: product.sku })))
  }, [products, registerProducts])
  const media = useMemo(() => products.filter((product) => product.image_url).map((product) => ({ id: `${product.id}-cover`, product })), [products])
  const needle = query.trim().toLowerCase()
  const filteredProducts = products.filter((product) => !needle || [product.name, product.sku, product.category].some((value) => value?.toLowerCase().includes(needle)))
  const filteredMedia = media.filter(({ product }) => !needle || [product.name, product.category, product.image_url].some((value) => value?.toLowerCase().includes(needle)))

  return (
    <section className="h-full overflow-y-auto px-6 py-6">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-col gap-4 pb-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">商品资产库</h1>
          </div>
          <ProductCreateDialog />
        </header>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-1">
            <LibraryTab active={view === 'products'} onClick={() => setView('products')} icon={<Package className="h-3.5 w-3.5" />} label="商品" count={products.length} />
            <LibraryTab active={view === 'media'} onClick={() => setView('media')} icon={<FileImage className="h-3.5 w-3.5" />} label="媒体" count={media.length} />
          </div>
          <div className="flex items-center gap-2 pb-3">
            <label className="flex h-10 min-h-10 w-full items-center gap-2 rounded-[10px] border border-[var(--border-subtle)] bg-[var(--surface)] px-3 focus-within:border-[var(--primary)] sm:w-64">
              <Search className="h-3.5 w-3.5 text-[var(--lavender)]" aria-hidden="true" />
              <span className="sr-only">搜索资产</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={view === 'products' ? '搜索商品、SKU 或分类' : '搜索媒体或商品'} className="w-full bg-transparent text-base outline-none sm:text-xs" />
            </label>
            <button type="button" onClick={() => setGrid((value) => !value)} className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] border border-[var(--border-subtle)] text-[var(--lavender)] hover:bg-[var(--surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--primary)] focus-visible:outline-offset-2" aria-label={grid ? '切换列表视图' : '切换网格视图'} title={grid ? '列表视图' : '网格视图'}>{grid ? <List className="h-4 w-4" /> : <Grid2X2 className="h-4 w-4" />}</button>
          </div>
        </div>

        {view === 'products' ? (
          <ProductView products={filteredProducts} grid={grid} query={query} onClear={() => setQuery('')} />
        ) : (
          <MediaView media={filteredMedia} grid={grid} query={query} onClear={() => setQuery('')} />
        )}
      </div>
    </section>
  )
}

function LibraryTab({ active, onClick, icon, label, count }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; count: number }) {
  return <button type="button" onClick={onClick} className={`inline-flex min-h-10 items-center gap-1.5 border-b-2 px-3 text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--primary)] focus-visible:outline-offset-2 ${active ? 'border-[var(--primary)] text-[var(--primary)]' : 'border-transparent text-[var(--lavender)] hover:text-[var(--ink)]'}`}>{icon}{label}<span className="rounded-full bg-[var(--surface-muted)] px-1.5 py-0.5 text-[10px]">{count}</span></button>
}

function ProductView({ products, grid, query, onClear }: { products: ProductRow[]; grid: boolean; query: string; onClear: () => void }) {
  if (!products.length) return <EmptyLibrary icon={<Package className="h-7 w-7" />} title={query ? `没有找到“${query}”` : '没有商品'} description={query ? '清除关键词后查看全部商品。' : '创建第一个商品后，它会出现在这里。'} onClear={query ? onClear : undefined} />
  return <div className={`mt-6 ${grid ? 'grid gap-6 sm:grid-cols-2 lg:grid-cols-3' : 'space-y-2'}`}>{products.map((product) => grid ? <ProductCard key={product.id} product={product} /> : <ProductRowItem key={product.id} product={product} />)}</div>
}

function ProductCard({ product }: { product: ProductRow }) {
  return (
    <article className="group flex min-h-[390px] flex-col rounded-[24px] border border-[var(--border-subtle)] bg-[var(--surface)] shadow-[0_1px_2px_var(--ink)] transition-[transform,box-shadow,border-color] duration-300 ease-out hover:-translate-y-0.5 hover:border-[var(--text-primary)] hover:shadow-md motion-reduce:transition-none motion-reduce:hover:transform-none">
      <Link href={`/dashboard/products/${product.id}`} className="flex min-h-0 flex-1 flex-col focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--primary)] focus-visible:outline-offset-2">
        <div className="relative min-h-0 flex-1 overflow-hidden rounded-t-[24px] bg-[var(--surface-muted)]">
          {product.image_url ? <Image src={product.image_url} alt={product.name} fill unoptimized className="object-cover transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transition-none" /> : <div className="flex h-full items-center justify-center text-[var(--lavender)]"><ImageIcon className="h-8 w-8" aria-hidden="true" /></div>}
        </div>
        <div className="shrink-0 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="mb-1 text-[10px] font-semibold tracking-[0.08em] text-[var(--text-muted)]">{product.category || '未分类商品'}</p>
              <h2 className="truncate text-sm font-semibold">{product.name}</h2>
              <p className="mt-1 truncate text-[11px] text-[var(--lavender)]">库存量：{product.inventory ?? 0}{product.sku ? ` · ${product.sku}` : ''}</p>
            </div>
            <span className="shrink-0 tabular-nums text-sm font-semibold">¥{Number(product.price || 0).toLocaleString('zh-CN')}</span>
          </div>
        </div>
      </Link>
      <div className="flex min-h-12 items-center justify-between gap-2 border-t border-[var(--border-subtle)] px-3">
        {product.channel_visibility_supported ? <>
          <span className={`truncate text-[11px] ${product.consumer_visible ? 'text-[var(--primary)]' : 'text-[var(--text-muted)]'}`}>{product.consumer_visible ? 'C 端商城可见' : '未在 C 端展示'}</span>
          <StorefrontVisibilityButton product={product} />
        </> : <span className="ml-auto text-[10px] text-[var(--text-muted)]">演示数据</span>}
      </div>
    </article>
  )
}

function ProductRowItem({ product }: { product: ProductRow }) {
  return <div className="flex min-h-16 items-center gap-3 rounded-[12px] border border-[var(--border-subtle)] bg-[var(--surface)] p-2.5"><div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-[8px] bg-[var(--surface-muted)]">{product.image_url ? <Image src={product.image_url} alt="" fill unoptimized className="object-cover" /> : <ImageIcon className="m-3 h-6 w-6 text-[var(--lavender)]" aria-hidden="true" />}</div><Link href={`/dashboard/products/${product.id}`} className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{product.name}</p><p className="mt-1 truncate text-[10px] text-[var(--lavender)]">库存量：{product.inventory ?? 0}</p></Link><span className="hidden tabular-nums text-xs font-semibold sm:block">¥{Number(product.price || 0).toLocaleString('zh-CN')}</span>{product.channel_visibility_supported ? <StorefrontVisibilityButton product={product} /> : <span className="shrink-0 text-[10px] text-[var(--text-muted)]">演示数据</span>}
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
    <button type="button" onClick={toggleVisibility} disabled={busy} aria-pressed={visible} aria-label={`${visible ? '从' : '在'} C 端商城${visible ? '下架' : '展示'}：${product.name}`} className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-[10px] border border-[var(--border-subtle)] px-2.5 text-[11px] font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--primary)] focus-visible:outline-offset-2 disabled:cursor-wait disabled:opacity-60">
      {busy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : visible ? <EyeOff className="h-3.5 w-3.5" aria-hidden="true" /> : <Eye className="h-3.5 w-3.5" aria-hidden="true" />}
      {visible ? '下架' : '展示'}
    </button>
    {error && <span role="status" className="absolute bottom-full right-0 z-10 mb-1 max-w-56 rounded-[8px] border border-red-200 bg-white px-2 py-1 text-left text-[10px] leading-4 text-red-700 shadow-sm">{error}</span>}
  </div>
}

function MediaView({ media, grid, query, onClear }: { media: { id: string; product: ProductRow }[]; grid: boolean; query: string; onClear: () => void }) {
  if (!media.length) return <EmptyLibrary icon={<FileImage className="h-7 w-7" />} title={query ? `没有找到“${query}”` : '媒体库为空'} description={query ? '清除关键词后查看全部媒体。' : '商品图片上传后会出现在这里。'} onClear={query ? onClear : undefined} />
  return <div className={`mt-6 ${grid ? 'grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4' : 'space-y-2'}`}>{media.map(({ id, product }) => grid ? <MediaCard key={id} product={product} /> : <MediaRow key={id} product={product} />)}</div>
}

function MediaCard({ product }: { product: ProductRow }) {
  return <article className="group overflow-hidden rounded-[16px] border border-[var(--border-subtle)] bg-[var(--surface)]"><Link href={`/dashboard/products/${product.id}`} className="block focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--primary)] focus-visible:outline-offset-2"><div className="relative aspect-square overflow-hidden bg-[var(--surface-muted)]"><Image src={product.image_url as string} alt={product.name} fill unoptimized className="object-cover transition-transform duration-300 group-hover:scale-[1.03]" /><span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-[var(--surface)]/90 px-2 py-1 text-[10px] font-semibold text-[var(--ink)]"><Check className="h-3 w-3 text-[var(--primary)]" />主图</span></div></Link><div className="p-3"><p className="truncate text-xs font-semibold">{product.name}</p><p className="mt-1 truncate text-[10px] text-[var(--lavender)]">库存量：{product.inventory ?? 0}</p></div></article>
}

function MediaRow({ product }: { product: ProductRow }) {
  return <div className="flex items-center gap-3 rounded-[12px] border border-[var(--border-subtle)] bg-[var(--surface)] p-2.5"><div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-[8px] bg-[var(--surface-muted)]"><Image src={product.image_url as string} alt="" fill unoptimized className="object-cover" /></div><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{product.name}</p><p className="mt-1 truncate text-[10px] text-[var(--lavender)]">库存量：{product.inventory ?? 0}</p></div></div>
}

function EmptyLibrary({ icon, title, description, onClear }: { icon: React.ReactNode; title: string; description: string; onClear?: () => void }) {
  return <div className="mt-6 flex min-h-80 flex-col items-center justify-center rounded-[18px] border border-dashed border-[var(--border)] bg-[var(--surface)] text-center text-[var(--lavender)]"><span>{icon}</span><h2 className="mt-4 text-lg font-semibold text-[var(--ink)]">{title}</h2><p className="mt-2 text-sm">{description}</p>{onClear && <button type="button" onClick={onClear} className="mt-4 min-h-9 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--primary)] focus-visible:outline-offset-2">清除搜索</button>}</div>
}
