'use client'

import React, { useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  Check,
  ChevronRight,
  FileText,
  Image as ImageIcon,
  Link2,
  Loader2,
  Package,
  Search,
  UploadCloud,
  Video,
  X,
} from 'lucide-react'
import { DEMO_PRODUCTS } from '@/lib/products/demo-data'
import { SYSTEM_KNOWLEDGE_BASES } from '@/components/knowledge/mockData'

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

const PRODUCT_KNOWLEDGE = SYSTEM_KNOWLEDGE_BASES.find((base) => base.id === 'product-knowledge')

const INITIAL_ASSETS: Asset[] = [
  ...(PRODUCT_KNOWLEDGE?.sources.slice(0, 4).map((source, index) => ({
    id: source.id,
    name: source.name,
    kind: source.type === 'url' ? 'document' : source.type === 'markdown' ? 'document' : 'document',
    size: source.size,
    updatedAt: source.updatedAt,
    visibility: source.visibility,
    status: 'ready',
    productIds: index < 3 ? ['prod-101'] : [],
  })) as Asset[]) || [],
  {
    id: 'asset-demo-image-1',
    name: 'OmniFlow_S1_Product_Hero.webp',
    kind: 'image',
    size: '1.8 MB',
    updatedAt: '刚刚',
    visibility: 'customer-facing',
    status: 'ready',
    url: DEMO_PRODUCTS[0]?.image_url,
    productIds: ['prod-101'],
  },
]

const kindLabels: Record<AssetKind, string> = {
  image: '图片',
  video: '视频',
  document: '文件',
}

function AssetIcon({ kind }: { kind: AssetKind }) {
  const Icon = kind === 'image' ? ImageIcon : kind === 'video' ? Video : FileText
  return <Icon size={16} aria-hidden />
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
    <section className="min-h-[calc(100vh-3rem)] bg-white text-[#1C1C1C]">
      <div className="mx-auto max-w-[1440px] space-y-5">
        <header className="flex flex-col gap-4 border-b border-[#E2E2E2] pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#636363]">Omnilink / 资产管理</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-[#1C1C1C]">资产库</h1>
            <p className="mt-1 max-w-2xl text-sm text-[#636363]">统一管理商品图片、视频和知识文件，并从任一侧维护商品关联。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleUpload} />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex min-h-11 items-center gap-2 rounded-[4px] bg-[#024AD8] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#003198] active:bg-[#00226B] focus-visible:outline-2 focus-visible:outline-[#024AD8] focus-visible:outline-offset-2"
            >
              {isUploading ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
              {isUploading ? '正在添加' : '上传资产'}
            </button>
          </div>
        </header>

        {uploadError && (
          <div role="alert" className="flex items-center gap-2 rounded-[4px] border border-[#FFCDD2] bg-[#FFF2F2] px-3 py-2 text-sm text-[#B71C1C]">
            <AlertCircle size={16} />
            <span>{uploadError}</span>
            <button type="button" onClick={() => setUploadError(null)} className="ml-auto flex min-h-11 min-w-11 items-center justify-center rounded-[4px] focus-visible:outline-2 focus-visible:outline-[#024AD8]" aria-label="关闭提示"><X size={15} /></button>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['全部资产', assets.length],
            ['商品图片', assets.filter((asset) => asset.kind === 'image').length],
            ['知识文件', assets.filter((asset) => asset.kind === 'document').length],
            ['已关联商品', assets.filter((asset) => asset.productIds.length > 0).length],
          ].map(([label, value], index) => (
            <div key={label} className={`border p-4 ${index === 0 ? 'border-[#024AD8] bg-[#EFF4FF]' : 'border-[#E2E2E2] bg-[#F7F7F7]'}`}>
              <div className="text-xs text-[#636363]">{label}</div>
              <div className="mt-2 text-2xl font-bold text-[#1C1C1C]">{value}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-3 border-y border-[#E2E2E2] py-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#636363]" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索文件名" className="h-11 w-full rounded-[4px] border border-[#D1D1D1] bg-white pl-9 pr-3 text-sm outline-none focus:border-[#024AD8] focus:ring-1 focus:ring-[#024AD8]" />
          </div>
          <div className="flex flex-wrap gap-2">
            <select aria-label="资产类型" value={kind} onChange={(event) => setKind(event.target.value as typeof kind)} className="h-11 rounded-[4px] border border-[#D1D1D1] bg-white px-3 text-sm outline-none focus:border-[#024AD8] focus:ring-1 focus:ring-[#024AD8]">
              <option value="all">全部类型</option>
              <option value="image">图片</option>
              <option value="video">视频</option>
              <option value="document">文件</option>
            </select>
            <select aria-label="可见范围" value={visibility} onChange={(event) => setVisibility(event.target.value as typeof visibility)} className="h-11 rounded-[4px] border border-[#D1D1D1] bg-white px-3 text-sm outline-none focus:border-[#024AD8] focus:ring-1 focus:ring-[#024AD8]">
              <option value="all">全部范围</option>
              <option value="customer-facing">对外可见</option>
              <option value="internal-private">内部私密</option>
            </select>
          </div>
        </div>

        <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0 overflow-hidden border border-[#E2E2E2]">
            <div className="hidden grid-cols-[minmax(0,1fr)_110px_120px_120px_36px] gap-3 border-b border-[#E2E2E2] bg-[#F7F7F7] px-4 py-3 text-xs font-semibold text-[#636363] sm:grid">
              <span>资产</span><span>类型</span><span>范围</span><span>商品关联</span><span />
            </div>
            {filteredAssets.length === 0 ? (
              <div className="flex min-h-64 flex-col items-center justify-center gap-2 px-6 text-center">
                <FileText size={24} className="text-[#636363]" />
                <p className="text-sm font-semibold">没有匹配的资产</p>
                <p className="text-xs text-[#636363]">调整筛选条件，或上传一个新文件。</p>
              </div>
            ) : filteredAssets.map((asset) => (
              <button key={asset.id} type="button" onClick={() => setSelectedId(asset.id)} className={`grid w-full grid-cols-1 gap-3 border-b border-[#E2E2E2] px-4 py-4 text-left transition-colors last:border-b-0 hover:bg-[#F7F7F7] focus-visible:outline-2 focus-visible:outline-[#024AD8] focus-visible:outline-offset-[-2px] sm:grid-cols-[minmax(0,1fr)_110px_120px_120px_36px] sm:items-center ${selectedId === asset.id ? 'bg-[#EFF4FF]' : 'bg-white'}`}>
                <span className="flex min-w-0 items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-[4px] border border-[#E2E2E2] bg-[#F7F7F7] text-[#024AD8]">
                    {asset.url && asset.kind === 'image' ? <img src={asset.url} alt="" className="h-full w-full object-cover" /> : <AssetIcon kind={asset.kind} />}
                  </span>
                  <span className="min-w-0"><span className="block truncate text-sm font-semibold text-[#1C1C1C]">{asset.name}</span><span className="mt-1 block text-xs text-[#636363]">{asset.size} · {asset.updatedAt}</span></span>
                </span>
                <span className="text-xs text-[#636363] sm:block">{kindLabels[asset.kind]}</span>
                <span className="text-xs text-[#636363]">{asset.visibility === 'customer-facing' ? '对外可见' : '内部私密'}</span>
                <span className="flex items-center gap-1 text-xs font-semibold text-[#024AD8]"><Link2 size={13} />{asset.productIds.length} 个商品</span>
                <ChevronRight size={16} className="hidden justify-self-end text-[#636363] sm:block" />
              </button>
            ))}
          </div>

          <aside className="border border-[#E2E2E2] bg-[#F7F7F7] xl:sticky xl:top-5 xl:self-start">
            {selected ? (
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[4px] bg-white text-[#024AD8]"><AssetIcon kind={selected.kind} /></span><div className="min-w-0"><h2 className="truncate text-sm font-bold">{selected.name}</h2><p className="mt-1 text-xs text-[#636363]">{selected.size} · {kindLabels[selected.kind]}</p></div></div>
                  <button type="button" onClick={() => setSelectedId(null)} className="flex min-h-11 min-w-11 items-center justify-center rounded-[4px] text-[#636363] hover:bg-white focus-visible:outline-2 focus-visible:outline-[#024AD8]" aria-label="关闭资产详情"><X size={16} /></button>
                </div>
                <div className="mt-5 border-t border-[#E2E2E2] pt-4">
                  <div className="flex items-center justify-between"><div><h3 className="text-sm font-bold">关联商品</h3><p className="mt-1 text-xs text-[#636363]">在资产侧维护关系，商品详情页会同步显示。</p></div><Link2 size={16} className="text-[#024AD8]" /></div>
                  <div className="mt-4 space-y-2">
                    {DEMO_PRODUCTS.slice(0, 4).map((product) => {
                      const linked = selected.productIds.includes(product.id)
                      return <button key={product.id} type="button" onClick={() => toggleProduct(selected.id, product.id)} className={`flex min-h-11 w-full items-center gap-3 rounded-[4px] border px-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-[#024AD8] ${linked ? 'border-[#024AD8] bg-[#EFF4FF]' : 'border-[#D1D1D1] bg-white hover:bg-[#F7F7F7]'}`}><span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-[4px] border ${linked ? 'border-[#024AD8] bg-[#024AD8] text-white' : 'border-[#B0B0B0] bg-white'}`}>{linked && <Check size={13} />}</span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold">{product.name}</span><span className="mt-0.5 block text-[11px] text-[#636363]">{product.sku}</span></span><Package size={15} className={linked ? 'text-[#024AD8]' : 'text-[#636363]'} /></button>
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center"><Link2 size={24} className="text-[#024AD8]" /><h2 className="mt-3 text-sm font-bold">选择一个资产</h2><p className="mt-1 text-xs leading-5 text-[#636363]">查看文件详情，并从资产侧维护商品双向关联。</p></div>
            )}
          </aside>
        </div>
      </div>
    </section>
  )
}
