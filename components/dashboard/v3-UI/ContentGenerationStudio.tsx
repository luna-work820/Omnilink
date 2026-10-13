'use client'

import { useMemo, useRef, useState } from 'react'
import { ArrowLeft, Download, ImagePlus, LoaderCircle, RefreshCw, Sparkles, X } from 'lucide-react'
import type { ContentGenerationResponse, GeneratedImage } from '@/lib/content-generation/types'

type Props = { selectedProduct: { name: string; sku?: string | null } | null; onClose: () => void; onGenerated?: (name: string, image: string) => void }
const channels = { douyin: '抖音', xiaohongshu: '小红书', 'detail-page': '商品详情页' } as const

export function ContentGenerationStudio({ selectedProduct, onClose, onGenerated }: Props) {
  const [name, setName] = useState(selectedProduct?.name || '')
  const [files, setFiles] = useState<File[]>([])
  const [reference, setReference] = useState<File | null>(null)
  const [instruction, setInstruction] = useState('')
  const [result, setResult] = useState<ContentGenerationResponse | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const previews = useMemo(() => files.map((file) => URL.createObjectURL(file)), [files])
  async function generate() {
    if (!files.length || busy) return
    setBusy(true); setError(null)
    try {
      const form = new FormData()
      form.set('productName', name); form.set('instruction', instruction); form.set('channels', 'douyin,xiaohongshu,detail-page')
      files.forEach((file) => form.append('productImages', file))
      if (reference) form.set('referenceImage', reference)
      const response = await fetch('/api/content/generate', { method: 'POST', body: form })
      const payload = await response.json() as ContentGenerationResponse & { error?: string }
      if (!response.ok) throw new Error(payload.error || '生成失败')
      setResult(payload); setSelectedId(payload.images[0]?.id || null)
      const latestGenerated = payload.images.filter((image) => image.kind === 'generated').at(-1)
      if (latestGenerated) onGenerated?.(name, latestGenerated.dataUrl)
    } catch (generationError) { setError(generationError instanceof Error ? generationError.message : '生成失败，请重试。') } finally { setBusy(false) }
  }
  function download(image: GeneratedImage) { const anchor = document.createElement('a'); anchor.href = image.dataUrl; anchor.download = `${name || '商品'}-${image.id}.png`; anchor.click() }
  const selected = result?.images.find((image) => image.id === selectedId) || result?.images[0]

  return <div className="fixed inset-0 z-[90] flex min-h-0 flex-col bg-[var(--canvas)] text-[var(--text-primary)]" role="dialog" aria-modal="true" aria-label="商品内容创作">
    <header className="flex min-h-16 items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--surface)] px-5 sm:px-8"><div className="flex items-center gap-3"><button type="button" onClick={onClose} aria-label="返回工作台" className="grid h-10 w-10 place-items-center rounded-full hover:bg-[var(--surface-muted)]"><ArrowLeft className="h-4 w-4" /></button><div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Product content creation</p><h1 className="text-base font-semibold">商品内容创作</h1></div></div><span className="hidden text-xs text-[var(--text-secondary)] sm:inline">商品语义 · 图片结果 · 渠道文案</span></header>
    <main className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[260px_minmax(0,1fr)_300px]">
      <section className="border-b border-[var(--border-subtle)] bg-[var(--surface)] p-5 lg:border-b-0 lg:border-r"><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">01 / 商品素材</p><label className="mt-4 block text-xs font-semibold">商品名称<input value={name} onChange={(event) => setName(event.target.value)} className="mt-2 h-10 w-full rounded-[10px] border border-[var(--border-subtle)] bg-[var(--canvas)] px-3 text-sm font-normal outline-none" placeholder="例如：猫爪棉拖" /></label>{selectedProduct?.sku && <p className="mt-2 text-[11px] text-[var(--text-secondary)]">SKU：{selectedProduct.sku}</p>}<div className="mt-5"><div className="flex items-center justify-between text-xs font-semibold"><span>商品图 / 三视图</span><span className="text-[var(--text-secondary)]">{files.length}/3</span></div><div className="mt-2 grid grid-cols-3 gap-2"><button type="button" onClick={() => inputRef.current?.click()} className="grid aspect-square place-items-center rounded-[10px] border border-dashed border-[var(--border-subtle)] text-[var(--text-secondary)]"><ImagePlus className="h-4 w-4" /></button>{previews.map((src, index) => <div key={src} className="relative overflow-hidden rounded-[10px]"><img src={src} alt="商品素材" className="aspect-square w-full object-cover" /><button type="button" onClick={() => setFiles((current) => current.filter((_, item) => item !== index))} aria-label="移除素材" className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-full bg-black/70 text-white"><X className="h-3 w-3" /></button></div>)}</div><input ref={inputRef} type="file" multiple accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => setFiles(Array.from(event.target.files || []).slice(0, 3))} /></div><label className="mt-5 block text-xs font-semibold">参考风格图<input type="file" accept="image/jpeg,image/png,image/webp" className="mt-2 block w-full text-xs text-[var(--text-secondary)]" onChange={(event) => setReference(event.target.files?.[0] || null)} /></label><label className="mt-5 block text-xs font-semibold">修改要求<textarea value={instruction} onChange={(event) => setInstruction(event.target.value)} rows={3} className="mt-2 w-full resize-none rounded-[10px] border border-[var(--border-subtle)] bg-[var(--canvas)] p-2 text-sm font-normal outline-none" placeholder="例如：背景更暖，突出猫爪细节" /></label><button type="button" onClick={generate} disabled={!files.length || busy} className="mt-5 flex h-10 w-full items-center justify-center gap-2 rounded-full bg-[var(--text-primary)] text-sm font-semibold text-[var(--surface)] disabled:opacity-40">{busy ? <><LoaderCircle className="h-4 w-4 animate-spin" />生成中</> : <><Sparkles className="h-4 w-4" />生成内容包</>}</button>{error && <p role="alert" className="mt-3 text-xs leading-5 text-red-700">{error}</p>}</section>
      <section className="min-w-0 bg-[var(--canvas)] p-5 sm:p-6"><div className="flex items-center justify-between"><div><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">02 / 视觉结果</p><h2 className="mt-2 text-lg font-semibold">图片与商品语义</h2></div>{result && <button type="button" onClick={generate} disabled={busy} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[var(--border-subtle)] px-3 text-xs font-semibold"><RefreshCw className="h-3.5 w-3.5" />重新生成</button>}</div>{result ? <><div className="mt-4 rounded-[14px] border border-[var(--border-subtle)] bg-[var(--surface)] p-4"><div className="grid gap-3 text-xs sm:grid-cols-2"><p><b>材质：</b>{result.semantics.material.join('、') || '待确认'}</p><p><b>颜色：</b>{result.semantics.colors.join('、') || '待确认'}</p><p><b>功能：</b>{result.semantics.functions.join('、') || '待确认'}</p><p><b>卖点：</b>{result.semantics.sellingPoints.join('、') || '待确认'}</p></div>{result.notices.map((notice) => <p key={notice} className="mt-3 border-t border-[var(--border-subtle)] pt-3 text-[11px] text-[var(--text-secondary)]">{notice}</p>)}</div><div className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4">{result.images.map((image) => <button type="button" key={image.id} onClick={() => setSelectedId(image.id)} className={`relative overflow-hidden rounded-[12px] border ${selected?.id === image.id ? 'border-[var(--text-primary)] ring-2 ring-black/10' : 'border-[var(--border-subtle)]'}`}><img src={image.dataUrl} alt={image.kind === 'generated' ? 'AI生成商品图' : '素材预览'} className="aspect-square w-full object-cover" /><span className="absolute bottom-2 left-2 rounded-full bg-white/90 px-2 py-1 text-[10px] font-semibold">{image.kind === 'generated' ? 'AI 生成' : '素材预览'}</span></button>)}</div></> : <div className="mt-4 grid min-h-[420px] place-items-center rounded-[16px] border border-dashed border-[var(--border-subtle)] bg-[var(--surface)] text-center"><div><ImagePlus className="mx-auto h-8 w-8 text-[var(--text-muted)]" /><p className="mt-3 text-sm font-semibold">先上传商品图，再生成内容包</p><p className="mt-2 text-xs text-[var(--text-secondary)]">图片生成能力已经并入商品内容创作 Skill。</p></div></div>}</section>
      <section className="border-t border-[var(--border-subtle)] bg-[var(--surface)] p-5 lg:border-l lg:border-t-0 sm:p-6"><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">03 / 渠道内容</p><h2 className="mt-2 text-lg font-semibold">文案草稿</h2>{result ? <>{result.copy.map((copy) => <article key={copy.channel} className="mt-5 border-b border-[var(--border-subtle)] pb-5"><p className="text-[10px] font-semibold text-[var(--text-muted)]">{channels[copy.channel]}</p><h3 className="mt-2 text-sm font-semibold">{copy.title}</h3><p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">{copy.body}</p></article>)}<button type="button" onClick={() => selected && download(selected)} disabled={!selected || selected.kind !== 'generated'} className="mt-6 flex h-10 w-full items-center justify-center gap-2 rounded-full border border-[var(--border-subtle)] text-sm font-semibold disabled:opacity-40"><Download className="h-4 w-4" />下载选中图片</button></> : <p className="mt-5 text-sm leading-6 text-[var(--text-secondary)]">生成后展示抖音、小红书和商品详情页内容。</p>}</section>
    </main>
  </div>
}
