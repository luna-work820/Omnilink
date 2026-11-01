'use client'

import React, { useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  Check,
  FileText,
  Image as ImageIcon,
  Link2,
  Loader2,
  MoreHorizontal,
  Package,
  Search,
  UploadCloud,
  Video,
  X,
} from 'lucide-react'
import { DEMO_PRODUCTS } from '@/lib/products/demo-data'

type AssetKind = 'image' | 'video' | 'document'
type AssetVisibility = 'customer-facing' | 'internal-private'

type Asset = {
  id: string
  name: string
  kind: AssetKind
  size: string
  updatedAt: string
  visibility: AssetVisibility
  status: 'ready' | 'processing' | 'failed'
  url?: string
  productIds: string[]
}

const INITIAL_ASSETS: Asset[] = []

const kindLabels: Record<AssetKind, string> = {
  image: '图片',
  video: '视频',
  document: '文件',
}

function AssetIcon({ kind }: { kind: AssetKind }) {
  const Icon = kind === 'image' ? ImageIcon : kind === 'video' ? Video : FileText
  return <Icon size={16} aria-hidden />
}

function AssetCard({ asset, selected, onSelect, featured }: { asset: Asset; selected: boolean; onSelect: () => void; featured: boolean }) {
  const isFolder = asset.kind !== 'document'
  const folderTone = asset.kind === 'image' ? 'bg-[#FF4D6D]' : 'bg-[#A849D8]'
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={`查看资产 ${asset.name}`}
      className={`group relative flex min-h-[248px] flex-col overflow-hidden rounded-[28px] border text-left shadow-[0_2px_12px_rgba(28,28,28,0.06)] transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-[#B0B0B0] hover:shadow-[0_10px_24px_rgba(28,28,28,0.12)] focus-visible:outline-2 focus-visible:outline-[#024AD8] focus-visible:outline-offset-2 ${selected ? 'border-[#024AD8] ring-2 ring-[#024AD8]/20' : 'border-[#E2E2E2]'} ${isFolder ? `${folderTone} text-white` : 'bg-white text-[#1C1C1C]'}`}
    >
      {isFolder ? (
        <>
          <span className="relative block h-32 overflow-hidden">
            <span className="absolute left-[20%] top-7 h-16 w-24 -rotate-6 rounded-[9px] border border-white/60 bg-white/90 shadow-sm" />
            <span className="absolute left-[36%] top-4 h-[72px] w-28 rotate-3 rounded-[9px] border border-white/60 bg-white/90 shadow-sm" />
            <span className="absolute left-[54%] top-8 h-16 w-28 rounded-[9px] border border-white/60 bg-white/95 shadow-sm" />
            {asset.url && <img src={asset.url} alt="" className="absolute left-1/2 top-8 h-16 w-24 -translate-x-1/2 rounded-[9px] object-cover shadow-sm" />}
          </span>
          <span className="mt-auto flex items-end justify-between px-6 pb-6 pt-5">
            <span className="min-w-0"><span className="block truncate text-xl font-bold">{asset.name}</span><span className="mt-1 block text-sm text-white/85">{asset.productIds.length} 个商品</span></span>
            <MoreHorizontal size={24} className="shrink-0" />
          </span>
        </>
      ) : (
        <span className="flex min-h-0 flex-1 flex-col bg-white p-6">
          <span className="flex items-center justify-between text-[#636363]"><span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em]"><AssetIcon kind={asset.kind} />{kindLabels[asset.kind]}</span><MoreHorizontal size={22} /></span>
          <span className={`mt-5 line-clamp-2 font-bold leading-[1.08] text-[#1C1C1C] ${featured ? 'text-[30px]' : 'text-2xl'}`}>{asset.name}</span>
          <span className="mt-4 line-clamp-3 max-w-[38rem] text-sm leading-6 text-[#636363]">{asset.visibility === 'customer-facing' ? '对外可见的商品资料，可从资产侧继续维护商品关联。' : '内部私密文件，仅供团队工作流使用。'}</span>
          <span className="mt-auto flex items-center justify-between border-t border-[#E2E2E2] pt-5 text-xs font-semibold uppercase tracking-[0.12em] text-[#636363]"><span>{asset.updatedAt}</span><span className="normal-case tracking-normal text-[#024AD8]">{asset.productIds.length} 个商品</span></span>
        </span>
      )}
    </button>
  )
}

export function AssetLibrary() {
  const [assets, setAssets] = useState<Asset[]>(INITIAL_ASSETS)
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState<'all' | AssetKind>('all')
  const [visibility, setVisibility] = useState<'all' | AssetVisibility>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const selected = assets.find((asset) => asset.id === selectedId) || null
  const filteredAssets = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return assets.filter((asset) => {
      const matchesQuery = !normalizedQuery || asset.name.toLowerCase().includes(normalizedQuery)
      const matchesKind = kind === 'all' || asset.kind === kind
      const matchesVisibility = visibility === 'all' || asset.visibility === visibility
      return matchesQuery && matchesKind && matchesVisibility
    })
  }, [assets, kind, query, visibility])

  const handleUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    event.target.value = ''
    if (files.length === 0) return

    const invalid = files.find((file) => file.size > 20 * 1024 * 1024)
    if (invalid) {
      setUploadError(`“${invalid.name}” 超过 20 MB，未添加`)
      return
    }

    setUploadError(null)
    setIsUploading(true)
    window.setTimeout(() => {
      const newAssets = files.map<Asset>((file) => ({
        id: crypto.randomUUID(),
        name: file.name,
        kind: file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'document',
        size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
        updatedAt: '刚刚',
        visibility: 'customer-facing',
        status: 'ready',
        url: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
        productIds: [],
      }))
      setAssets((current) => [...newAssets, ...current])
      setIsUploading(false)
    }, 500)
  }

  const toggleProduct = (assetId: string, productId: string) => {
    setAssets((current) => current.map((asset) => {
      if (asset.id !== assetId) return asset
      const productIds = asset.productIds.includes(productId)
        ? asset.productIds.filter((id) => id !== productId)
        : [...asset.productIds, productId]
      return { ...asset, productIds }
    }))
  }

  return (
    <section className="min-h-[calc(100vh-3rem)] bg-[#F4F4F1] text-[#1C1C1C]">
      <div className="mx-auto max-w-[1480px] space-y-6 px-5 py-6 lg:px-8 lg:py-8">
        <header className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#636363]">Omnilink / Asset library</p>
            <h1 className="mt-3 text-4xl font-bold tracking-[-0.04em] text-[#1C1C1C]">资产库</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#636363]">让商品图片、视频和知识文件在同一个空间里被看见、被使用，也能随时追溯它们关联的商品。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleUpload} />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-control)] bg-[var(--accent-primary)] px-5 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-primary-hover)] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-[var(--accent-secondary)] focus-visible:outline-offset-2"
            >
              {isUploading ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
              {isUploading ? '正在添加' : '上传资产'}
            </button>
          </div>
        </header>

        {uploadError && (
          <div role="alert" className="flex items-center gap-2 rounded-[16px] border border-[#FFCDD2] bg-[#FFF2F2] px-4 py-3 text-sm text-[#B71C1C]">
            <AlertCircle size={16} />
            <span>{uploadError}</span>
            <button type="button" onClick={() => setUploadError(null)} className="ml-auto flex min-h-11 min-w-11 items-center justify-center rounded-[4px] focus-visible:outline-2 focus-visible:outline-[#024AD8]" aria-label="关闭提示"><X size={15} /></button>
          </div>
        )}

        <div className="flex flex-col gap-4 rounded-[20px] bg-white p-4 shadow-[0_2px_8px_rgba(28,28,28,0.04)] lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="资产类型">
            {(['all', 'document', 'image', 'video'] as const).map((value) => (
              <button key={value} type="button" onClick={() => setKind(value)} aria-pressed={kind === value} className={`min-h-10 rounded-[var(--radius-control)] px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-[var(--accent-secondary)] focus-visible:outline-offset-2 ${kind === value ? 'bg-[var(--accent-secondary-soft)] text-[var(--accent-secondary)]' : 'text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]'}`}>
                {value === 'all' ? '全部资产' : kindLabels[value]}
              </button>
            ))}
            <span className="ml-1 text-xs text-[#636363]">{filteredAssets.length} 项</span>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="relative min-w-0 sm:w-64"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#636363]" /><span className="sr-only">搜索文件名</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索文件名" className="h-10 w-full rounded-full border border-[#D1D1D1] bg-white pl-9 pr-3 text-sm outline-none focus:border-[#024AD8] focus:ring-1 focus:ring-[#024AD8]" /></label>
            <select aria-label="可见范围" value={visibility} onChange={(event) => setVisibility(event.target.value as typeof visibility)} className="h-10 rounded-full border border-[#D1D1D1] bg-white px-4 text-sm outline-none focus:border-[#024AD8] focus:ring-1 focus:ring-[#024AD8]"><option value="all">全部范围</option><option value="customer-facing">对外可见</option><option value="internal-private">内部私密</option></select>
          </div>
        </div>

        <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0">
            {filteredAssets.length === 0 ? (
              <div className="flex min-h-72 flex-col items-center justify-center rounded-[28px] bg-white px-6 text-center shadow-[0_2px_12px_rgba(28,28,28,0.06)]">
                <FileText size={28} className="text-[#636363]" />
                <p className="mt-4 text-base font-bold">资产库还是空的</p>
                <p className="mt-1 text-sm text-[#636363]">上传第一个文件，开始建立商品与资产的关联。</p>
              </div>
            ) : <div className="grid gap-5 md:grid-cols-2">
              {filteredAssets.map((asset, index) => (
                <div key={asset.id} className={index === 0 ? 'md:col-span-2' : ''}>
                  <AssetCard asset={asset} featured={index === 0} selected={selectedId === asset.id} onSelect={() => setSelectedId(asset.id)} />
                </div>
              ))}
            </div>}
          </div>

          <aside className="min-w-0 rounded-[28px] bg-white shadow-[0_2px_12px_rgba(28,28,28,0.06)] xl:sticky xl:top-6 xl:self-start">
            {selected ? (
              <div className="p-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#636363]">Selected asset</p><h2 className="mt-2 truncate text-xl font-bold">{selected.name}</h2><p className="mt-1 text-sm text-[#636363]">{selected.size} · {kindLabels[selected.kind]}</p></div>
                  <button type="button" onClick={() => setSelectedId(null)} className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-[#636363] hover:bg-[#F4F4F1] focus-visible:outline-2 focus-visible:outline-[#024AD8]" aria-label="关闭资产详情"><X size={16} /></button>
                </div>
                <div className="mt-8 border-t border-[#E2E2E2] pt-5">
                  <div className="flex items-start justify-between gap-3"><div><h3 className="text-base font-bold">关联商品</h3><p className="mt-1 text-sm leading-5 text-[#636363]">在资产侧维护关系，商品详情页会同步显示。</p></div><Link2 size={18} className="mt-1 shrink-0 text-[#024AD8]" /></div>
                  <div className="mt-5 space-y-2">
                    {DEMO_PRODUCTS.slice(0, 4).map((product) => {
                      const linked = selected.productIds.includes(product.id)
                      return <button key={product.id} type="button" onClick={() => toggleProduct(selected.id, product.id)} className={`flex min-h-12 w-full items-center gap-3 rounded-[12px] border px-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-[#024AD8] ${linked ? 'border-[#024AD8] bg-[#EFF4FF]' : 'border-[#E2E2E2] bg-white hover:bg-[#F7F7F7]'}`}><span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-[4px] border ${linked ? 'border-[#024AD8] bg-[#024AD8] text-white' : 'border-[#B0B0B0] bg-white'}`}>{linked && <Check size={13} />}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{product.name}</span><span className="mt-0.5 block text-xs text-[#636363]">{product.sku}</span></span><Package size={15} className={linked ? 'text-[#024AD8]' : 'text-[#636363]'} /></button>
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex min-h-72 flex-col justify-between p-6"><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#636363]">Asset details</p><h2 className="mt-3 text-2xl font-bold leading-tight">选择一张卡片<br />开始维护关联</h2><p className="mt-3 text-sm leading-6 text-[#636363]">文件和商品之间的关系，从这里建立，也会同步回商品详情。</p></div><div className="mt-8 rounded-[18px] bg-[#F4F4F1] p-4 text-sm leading-6 text-[#636363]"><Link2 size={18} className="mb-3 text-[#024AD8]" />每条关联都能回到具体资产，方便团队协作和追溯。</div></div>
            )}
          </aside>
        </div>
      </div>
    </section>
  )
}
