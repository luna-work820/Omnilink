'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowDown, ArrowLeft, ArrowUp, Check, ExternalLink, Film, GripVertical, ImagePlus, LoaderCircle, Package, Plus, Type, X } from 'lucide-react'
import { contentProductIds, readContentBlocks, validContentImageUrl, validContentVideoUrl, type ContentBlock, type CreatorPostInput } from '@/lib/creator-content'
import { supabase } from '@/lib/supabase/client'

type Post = {
  id: string
  title: string
  cover_url: string
  body: string
  product_ids: string[]
  blocks: unknown
  draft_version: { title: string; coverUrl: string; blocks: unknown } | null
  status: 'draft' | 'published'
  published_at: string | null
  updated_at: string
}
type Product = { id: string; name: string; image: string | null; status: string; hasLink: boolean }
type Library = { posts: Post[]; products: Product[] }
type InsertType = ContentBlock['type']

const freshBlock = (type: InsertType): ContentBlock => {
  const id = crypto.randomUUID()
  if (type === 'text') return { id, type, text: '' }
  if (type === 'image') return { id, type, url: '' }
  if (type === 'video') return { id, type, url: '' }
  return { id, type, productIds: [] }
}
const blank = (): CreatorPostInput => ({ title: '', coverUrl: '', blocks: [freshBlock('text')], status: 'draft' })
const productName = (product: Product) => product.status === 'active' && product.hasLink ? '可发布' : '需先上架并设置链接'

async function fetchLibrary(): Promise<Library> {
  const response = await fetch('/api/creator-posts')
  const result = await response.json()
  if (!response.ok) throw new Error(response.status === 401 ? '请登录后管理内容' : result.error || '加载内容失败')
  return result
}

function draftFromPost(post: Post): CreatorPostInput {
  const pending = post.draft_version
  return {
    title: pending?.title ?? post.title,
    coverUrl: pending?.coverUrl ?? post.cover_url,
    blocks: readContentBlocks(pending?.blocks ?? post.blocks, post.body, post.product_ids),
    status: post.status,
  }
}

function ProductRows({ ids, products, remove, move, compact = false }: {
  ids: string[]
  products: Product[]
  remove?: (id: string) => void
  move?: (from: number, to: number) => void
  compact?: boolean
}) {
  if (!ids.length) return <p className="text-sm text-[var(--text-secondary)]">选择商品库中的商品</p>
  return <div className={compact ? 'grid gap-2 sm:grid-cols-2' : 'space-y-2'}>{ids.map((id, index) => {
    const product = products.find((item) => item.id === id)
    if (!product) return null
    return <div key={id} className="flex min-w-0 items-center gap-3 rounded-[var(--radius-control)] p-2 hover:bg-[#E9EDF2]">
      {product.image ? <Image unoptimized src={product.image} alt="" width={52} height={52} className="size-13 shrink-0 rounded-[var(--radius-control)] object-cover" /> : <span className="size-13 shrink-0 rounded-[var(--radius-control)] border border-[var(--border-subtle)]" />}
      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{product.name}</span><span className="text-xs text-[var(--text-secondary)]">{productName(product)}</span></span>
      {move && <span className="flex shrink-0 flex-col"><button type="button" onClick={() => move(index, index - 1)} disabled={index === 0} aria-label={`上移${product.name}`} className="grid size-7 place-items-center rounded hover:bg-white disabled:opacity-30"><ArrowUp size={13} /></button><button type="button" onClick={() => move(index, index + 1)} disabled={index === ids.length - 1} aria-label={`下移${product.name}`} className="grid size-7 place-items-center rounded hover:bg-white disabled:opacity-30"><ArrowDown size={13} /></button></span>}
      {remove && <button type="button" onClick={() => remove(id)} aria-label={`移除${product.name}`} className="grid size-9 place-items-center rounded-[var(--radius-control)] hover:bg-[#E9EDF2] focus-visible:outline-2 focus-visible:outline-[#315BFF]"><X size={16} /></button>}
    </div>
  })}</div>
}

export function CreatorContentWorkspace({ requestedId, startNew = false }: { requestedId?: string; startNew?: boolean }) {
  const [products, setProducts] = useState<Product[]>([])
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [wasPublished, setWasPublished] = useState(false)
  const [hasPending, setHasPending] = useState(false)
  const [draft, setDraft] = useState<CreatorPostInput>(blank)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [previewOpen, setPreviewOpen] = useState(false)
  const [insertAt, setInsertAt] = useState<number | null>(null)
  const [picking, setPicking] = useState<string | null>(null)
  const [dragging, setDragging] = useState<number | null>(null)
  const [uploadingVideoBlock, setUploadingVideoBlock] = useState<string | null>(null)
  const [videoUploadError, setVideoUploadError] = useState('')
  const blockRefs = useRef<Record<string, HTMLTextAreaElement | null>>({})
  const videoInputRef = useRef<HTMLInputElement>(null)
  const videoBlockIdRef = useRef<string | null>(null)

  useEffect(() => {
    let active = true
    void fetchLibrary().then((library) => {
      if (!active) return
      setProducts(library.products)
      const post = requestedId
        ? library.posts.find((item) => item.id === requestedId)
        : startNew ? undefined : library.posts.find((item) => item.status === 'draft')
      if (post) {
        setCurrentId(post.id)
        setWasPublished(post.status === 'published')
        setHasPending(Boolean(post.draft_version))
        setDraft(draftFromPost(post))
      } else if (requestedId) setError('没有找到这篇内容')
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : '加载内容失败')
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [requestedId, startNew])

  useEffect(() => {
    if (!previewOpen && picking === null) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setPreviewOpen(false); setPicking(null) }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [previewOpen, picking])

  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault() }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const change = (updater: (previous: CreatorPostInput) => CreatorPostInput) => {
    setDraft(updater)
    setDirty(true)
    setNotice('')
  }
  const replaceBlock = (id: string, next: ContentBlock) => change((previous) => ({
    ...previous, blocks: previous.blocks.map((block) => block.id === id ? next : block),
  }))
  const insert = (type: InsertType, index: number) => {
    const block = freshBlock(type)
    change((previous) => ({ ...previous, blocks: [...previous.blocks.slice(0, index), block, ...previous.blocks.slice(index)] }))
    setInsertAt(null)
    if (type === 'product' || type === 'group') setPicking(block.id)
    if (type === 'text') requestAnimationFrame(() => blockRefs.current[block.id]?.focus())
  }
  const move = (from: number, to: number) => {
    if (from === to || to < 0 || to >= draft.blocks.length) return
    change((previous) => {
      const blocks = [...previous.blocks]
      blocks.splice(to, 0, blocks.splice(from, 1)[0])
      return { ...previous, blocks }
    })
  }
  const removeBlock = (id: string) => change((previous) => ({
    ...previous, blocks: previous.blocks.filter((block) => block.id !== id),
  }))
  const uploadVideo = async (blockId: string, file: File) => {
    if (file.type !== 'video/mp4' && file.type !== 'video/webm') {
      setVideoUploadError('请选择 MP4 或 WebM 视频。')
      return
    }
    if (file.size > 100 * 1024 * 1024) {
      setVideoUploadError('视频不能超过 100 MB。')
      return
    }
    setVideoUploadError('')
    setUploadingVideoBlock(blockId)
    try {
      const signResponse = await fetch('/api/creator-posts/media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentType: file.type }),
      })
      const signed = await signResponse.json() as { path?: string; token?: string; url?: string; error?: string }
      if (!signResponse.ok || !signed.path || !signed.token || !signed.url) throw new Error(signed.error || '无法创建视频上传地址。')

      const { error: uploadError } = await supabase.storage
        .from('creator-content-videos')
        .uploadToSignedUrl(signed.path, signed.token, file, { contentType: file.type, upsert: false })
      if (uploadError) throw new Error('视频上传失败，请重试。')

      const block = draft.blocks.find((item) => item.id === blockId)
      if (block?.type === 'video') replaceBlock(blockId, { ...block, url: signed.url })
    } catch (cause) {
      setVideoUploadError(cause instanceof Error ? cause.message : '视频上传失败，请重试。')
    } finally {
      setUploadingVideoBlock(null)
      if (videoInputRef.current) videoInputRef.current.value = ''
    }
  }
  const splitText = (block: Extract<ContentBlock, { type: 'text' }>, index: number, at: number, end: number) => {
    const next = { id: crypto.randomUUID(), type: 'text' as const, text: block.text.slice(end) }
    change((previous) => ({ ...previous, blocks: [
      ...previous.blocks.slice(0, index), { ...block, text: block.text.slice(0, at) }, next,
      ...previous.blocks.slice(index + 1),
    ] }))
    requestAnimationFrame(() => blockRefs.current[next.id]?.focus())
  }
  const toggleProduct = (block: Extract<ContentBlock, { type: 'product' | 'group' }>, id: string) => {
    const selected = block.productIds.includes(id)
    if (!selected && block.productIds.length >= (block.type === 'group' ? 6 : 1)) return
    replaceBlock(block.id, { ...block, productIds: selected ? block.productIds.filter((item) => item !== id) : [...block.productIds, id] })
  }
  const moveGroupedProduct = (block: Extract<ContentBlock, { type: 'product' | 'group' }>, from: number, to: number) => {
    if (to < 0 || to >= block.productIds.length) return
    const productIds = [...block.productIds]
    productIds.splice(to, 0, productIds.splice(from, 1)[0])
    replaceBlock(block.id, { ...block, productIds })
  }
  const save = async (status: 'draft' | 'published') => {
    if (uploadingVideoBlock) return
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const response = await fetch('/api/creator-posts', {
        method: currentId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...draft, id: currentId, status }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(response.status === 401 ? '请登录后保存内容' : result.error || '保存失败')
      setCurrentId(result.id)
      setDirty(false)
      if (status === 'published') {
        setWasPublished(true)
        setHasPending(false)
        setDraft((previous) => ({ ...previous, status: 'published' }))
        setNotice('已发布到发现页')
      } else {
        if (wasPublished) setHasPending(true)
        setNotice(wasPublished ? '修改已存为草稿，线上作品未改变' : '草稿已保存')
      }
      if (!requestedId && !currentId) window.history.replaceState(null, '', `/dashboard/content?id=${result.id}`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '保存失败')
    } finally { setSaving(false) }
  }

  const selectedIds = contentProductIds(draft.blocks)
  const selectedProducts = selectedIds.map((id) => products.find((item) => item.id === id)).filter((item): item is Product => Boolean(item))
  const pickingBlock = draft.blocks.find((block) => block.id === picking)

  return <div className="mx-auto max-w-[1120px] px-4 pb-20 pt-5 sm:px-8">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-4">
      <div className="flex min-h-10 items-center gap-3"><h1 className="text-base font-semibold">内容</h1><span className="text-xs text-[var(--text-secondary)]">{loading ? '加载中…' : dirty ? '未保存' : hasPending ? '待发布修改' : wasPublished ? '已发布' : '草稿'}</span></div>
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/dashboard/content/works" onClick={(event) => { if (dirty && !window.confirm('内容尚未保存，仍要离开吗？')) event.preventDefault() }} className="ui-secondary inline-flex min-h-10 items-center rounded-[var(--radius-control)] px-4 text-sm focus-visible:outline-2 focus-visible:outline-[#315BFF]">管理作品</Link>
        <button type="button" onClick={() => setPreviewOpen(true)} className="ui-secondary min-h-10 rounded-[var(--radius-control)] px-4 text-sm">预览</button>
        <button type="button" onClick={() => void save('draft')} disabled={saving || loading || Boolean(uploadingVideoBlock)} className="ui-secondary min-h-10 rounded-[var(--radius-control)] px-4 text-sm disabled:opacity-50">保存草稿</button>
        <button type="button" onClick={() => void save('published')} disabled={saving || loading || Boolean(uploadingVideoBlock)} className="min-h-10 rounded-full bg-[var(--text-primary)] px-5 text-sm font-medium text-white disabled:opacity-50">{uploadingVideoBlock ? '视频上传中…' : saving ? '保存中…' : wasPublished ? '更新发布' : '发布'}</button>
      </div>
    </header>
    {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
    {videoUploadError && <p role="alert" className="mt-3 text-sm text-red-700">{videoUploadError}</p>}
    {notice && <p role="status" className="mt-4 text-sm text-[var(--text-secondary)]">{notice}</p>}
    <input ref={videoInputRef} type="file" accept="video/mp4,video/webm" className="sr-only" aria-label="选择视频文件" onChange={(event) => {
      const blockId = videoBlockIdRef.current
      const file = event.target.files?.[0]
      if (blockId && file) void uploadVideo(blockId, file)
    }} />
    <main className="mx-auto max-w-[760px] pt-8 sm:pt-12">
      <div className="mb-4">
        {draft.coverUrl && validContentImageUrl(draft.coverUrl) ? <div className="group relative"><Image unoptimized src={draft.coverUrl} alt="封面预览" width={900} height={500} className="aspect-[16/9] w-full rounded-[var(--radius-card)] object-cover" /><button type="button" onClick={() => change((previous) => ({ ...previous, coverUrl: '' }))} className="absolute right-3 top-3 rounded-[var(--radius-control)] bg-white px-3 py-2 text-xs focus-visible:outline-2 focus-visible:outline-[#315BFF]">移除封面</button></div> : <span className="inline-flex min-h-10 items-center gap-2 text-sm text-[var(--text-secondary)]"><ImagePlus size={17} />添加封面</span>}
        {draft.coverUrl && <label className="mt-2 block text-xs text-[var(--text-secondary)]">封面链接<input type="url" value={draft.coverUrl} onChange={(event) => change((previous) => ({ ...previous, coverUrl: event.target.value }))} className="mt-1 h-9 w-full border-b border-[var(--border-subtle)] bg-transparent text-sm text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-[#315BFF]" /></label>}
        {!draft.coverUrl && <input type="url" aria-label="粘贴封面图片链接" placeholder="粘贴 HTTPS 图片链接" value={draft.coverUrl} onChange={(event) => change((previous) => ({ ...previous, coverUrl: event.target.value }))} className="mt-1 h-9 w-full border-b border-[var(--border-subtle)] bg-transparent text-sm focus-visible:outline-2 focus-visible:outline-[#315BFF]" />}
      </div>
      <input aria-label="标题" value={draft.title} maxLength={100} onChange={(event) => change((previous) => ({ ...previous, title: event.target.value }))} placeholder="未命名内容" className="mb-7 w-full bg-transparent text-3xl font-semibold leading-tight outline-none placeholder:text-[#9AA3AF] focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-[#315BFF] sm:text-4xl" />
      <div aria-label="内容块" className="space-y-1">
        {draft.blocks.map((block, index) => <div key={block.id} className="group relative grid grid-cols-[38px_minmax(0,1fr)] gap-1 rounded-[var(--radius-control)] hover:bg-[#E9EDF2] focus-within:bg-[#E9EDF2]" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); if (dragging !== null) move(dragging, index); setDragging(null) }}>
          <div className="flex items-start pt-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
            <button type="button" onClick={() => setInsertAt(insertAt === index ? null : index)} aria-label={`在第${index + 1}块前插入`} className="grid size-7 place-items-center rounded hover:bg-white focus-visible:outline-2 focus-visible:outline-[#315BFF]"><Plus size={17} /></button>
            <button type="button" draggable onDragStart={() => setDragging(index)} onDragEnd={() => setDragging(null)} aria-label={`拖动第${index + 1}块`} className="hidden size-7 cursor-grab place-items-center rounded hover:bg-white focus-visible:outline-2 focus-visible:outline-[#315BFF] sm:grid"><GripVertical size={16} /></button>
          </div>
          <div className="min-w-0 py-1 pr-2">
            {block.type === 'text' && <textarea ref={(element) => { blockRefs.current[block.id] = element }} aria-label={`第${index + 1}段文字`} rows={Math.max(1, Math.ceil(block.text.length / 65))} value={block.text} onChange={(event) => replaceBlock(block.id, { ...block, text: event.target.value })} onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); splitText(block, index, event.currentTarget.selectionStart, event.currentTarget.selectionEnd) }
              if (event.key === 'Backspace' && !block.text && index > 0) { event.preventDefault(); removeBlock(block.id); requestAnimationFrame(() => blockRefs.current[draft.blocks[index - 1].id]?.focus()) }
            }} placeholder="输入文字…" className="block min-h-9 w-full resize-none bg-transparent py-1.5 text-base leading-7 outline-none placeholder:text-[#9AA3AF]" />}
            {block.type === 'image' && <div className="space-y-2"><input type="url" aria-label="图片链接" value={block.url} onChange={(event) => replaceBlock(block.id, { ...block, url: event.target.value })} placeholder="粘贴 HTTPS 图片链接" className="min-h-10 w-full bg-transparent text-sm outline-none placeholder:text-[#9AA3AF]" />{block.url && validContentImageUrl(block.url) && <Image unoptimized src={block.url} alt="" width={800} height={500} className="max-h-[480px] w-full rounded-[var(--radius-card)] object-cover" />}</div>}
            {block.type === 'video' && <div className="space-y-3 py-2">
              {validContentVideoUrl(block.url) ? <video key={block.url} controls playsInline preload="metadata" className="max-h-[520px] w-full rounded-[var(--radius-card)] bg-black" aria-label="内容视频预览"><source src={block.url} type={block.url.split('?')[0].toLowerCase().endsWith('.webm') ? 'video/webm' : 'video/mp4'} />浏览器不支持播放此视频。</video> : <div className="grid min-h-36 place-items-center rounded-[var(--radius-card)] border border-dashed border-[var(--border-subtle)] text-center"><div><Film size={24} className="mx-auto text-[var(--text-secondary)]" aria-hidden="true" /><p className="mt-2 text-sm text-[var(--text-secondary)]">在正文当前位置插入视频</p></div></div>}
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" disabled={uploadingVideoBlock === block.id} onClick={() => { videoBlockIdRef.current = block.id; videoInputRef.current?.click() }} className="inline-flex min-h-9 items-center gap-2 rounded-[var(--radius-control)] border border-[var(--border-subtle)] px-3 text-xs font-medium hover:bg-[#E9EDF2] focus-visible:outline-2 focus-visible:outline-[#315BFF] disabled:opacity-50">
                  {uploadingVideoBlock === block.id ? <LoaderCircle size={15} className="animate-spin" aria-hidden="true" /> : <Film size={15} aria-hidden="true" />}
                  {uploadingVideoBlock === block.id ? '上传中…' : block.url ? '更换视频' : '上传视频'}
                </button>
                <span className="text-xs text-[var(--text-secondary)]">MP4 / WebM · 不超过 100 MB</span>
                {block.url && <button type="button" onClick={() => replaceBlock(block.id, { ...block, url: '' })} className="ml-auto min-h-9 rounded-[var(--radius-control)] px-3 text-xs text-[var(--text-secondary)] hover:bg-[#E9EDF2] focus-visible:outline-2 focus-visible:outline-[#315BFF]">移除视频</button>}
              </div>
              <label className="block text-xs text-[var(--text-secondary)]">视频链接<input type="url" aria-label="视频链接" value={block.url} onChange={(event) => replaceBlock(block.id, { ...block, url: event.target.value })} placeholder="粘贴 HTTPS MP4 或 WebM 链接" className="mt-1 h-9 w-full border-b border-[var(--border-subtle)] bg-transparent text-sm text-[var(--text-primary)] outline-none placeholder:text-[#9AA3AF] focus-visible:border-[#315BFF]" /></label>
              {block.url && !validContentVideoUrl(block.url) && <p className="text-xs text-red-700" role="status">请输入可直接播放的 HTTPS MP4 或 WebM 链接。</p>}
            </div>}
            {(block.type === 'product' || block.type === 'group') && <div className="py-1"><div className="mb-2 flex items-center justify-between"><span className="text-xs font-medium text-[var(--text-secondary)]">{block.type === 'group' ? '商品组' : '商品'}</span><button type="button" onClick={() => setPicking(block.id)} className="text-xs text-[#315BFF] hover:underline">{block.productIds.length ? '更换商品' : '选择商品'}</button></div><ProductRows ids={block.productIds} products={products} compact={block.type === 'group'} move={block.type === 'group' ? (from, to) => moveGroupedProduct(block, from, to) : undefined} remove={(id) => replaceBlock(block.id, { ...block, productIds: block.productIds.filter((item) => item !== id) })} /></div>}
            <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
              <button type="button" onClick={() => move(index, index - 1)} disabled={index === 0} aria-label={`上移第${index + 1}块`} className="grid size-8 place-items-center rounded hover:bg-white disabled:opacity-30"><ArrowUp size={14} /></button>
              <button type="button" onClick={() => move(index, index + 1)} disabled={index === draft.blocks.length - 1} aria-label={`下移第${index + 1}块`} className="grid size-8 place-items-center rounded hover:bg-white disabled:opacity-30"><ArrowDown size={14} /></button>
              <button type="button" onClick={() => removeBlock(block.id)} aria-label={`删除第${index + 1}块`} className="grid size-8 place-items-center rounded hover:bg-white"><X size={14} /></button>
            </div>
          </div>
          {insertAt === index && <InsertMenu choose={(type) => insert(type, index)} close={() => setInsertAt(null)} />}
        </div>)}
        <div className="relative ml-[38px]"><button type="button" onClick={() => setInsertAt(insertAt === draft.blocks.length ? null : draft.blocks.length)} className="inline-flex min-h-10 items-center gap-2 rounded-[var(--radius-control)] px-2 text-sm text-[var(--text-secondary)] hover:bg-[#E9EDF2] focus-visible:outline-2 focus-visible:outline-[#315BFF]"><Plus size={17} />添加内容</button>{insertAt === draft.blocks.length && <InsertMenu choose={(type) => insert(type, draft.blocks.length)} close={() => setInsertAt(null)} />}</div>
      </div>
      {selectedProducts.length > 0 && <div className="mt-14 border-t border-[var(--border-subtle)] pt-6"><h2 className="mb-3 text-base font-semibold">相关商品</h2><ProductRows ids={selectedIds} products={products} compact /></div>}
    </main>
    {pickingBlock && (pickingBlock.type === 'product' || pickingBlock.type === 'group') && <div role="dialog" aria-modal="true" aria-label="选择商品" className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"><div className="max-h-[80vh] w-full max-w-xl overflow-y-auto rounded-[var(--radius-card)] bg-[#FCFDFE] p-5"><div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold">选择商品</h2><button type="button" onClick={() => setPicking(null)} aria-label="关闭选择商品" className="grid size-9 place-items-center rounded-[var(--radius-control)] hover:bg-[#E9EDF2]"><X size={18} /></button></div><p className="mb-3 text-xs text-[var(--text-secondary)]">{pickingBlock.type === 'group' ? '最多选择 6 件商品' : '选择 1 件商品'}</p>{products.length ? <div className="space-y-1">{products.map((product) => <button type="button" key={product.id} onClick={() => toggleProduct(pickingBlock, product.id)} disabled={!pickingBlock.productIds.includes(product.id) && pickingBlock.productIds.length >= (pickingBlock.type === 'group' ? 6 : 1)} className="flex min-h-14 w-full items-center gap-3 rounded-[var(--radius-control)] p-2 text-left hover:bg-[#E9EDF2] disabled:opacity-40">{product.image && <Image unoptimized src={product.image} alt="" width={44} height={44} className="size-11 rounded object-cover" />}<span className="min-w-0 flex-1"><span className="block truncate text-sm">{product.name}</span><span className="text-xs text-[var(--text-secondary)]">{productName(product)}</span></span>{pickingBlock.productIds.includes(product.id) && <Check size={17} className="text-[#315BFF]" />}</button>)}</div> : <p className="text-sm text-[var(--text-secondary)]">商品库为空。先添加商品，再回到这里选择。</p>}<div className="mt-5 flex justify-between border-t border-[var(--border-subtle)] pt-4"><Link href="/dashboard/products/new" className="inline-flex items-center gap-1 text-sm text-[#315BFF]">新建商品<ExternalLink size={13} /></Link><button type="button" onClick={() => setPicking(null)} className="rounded-full bg-[var(--text-primary)] px-5 py-2 text-sm text-white">完成</button></div></div></div>}
      {previewOpen && <div role="dialog" aria-modal="true" aria-label="内容预览" className="fixed inset-0 z-50 overflow-y-auto bg-[#FCFDFE]"><div className="mx-auto max-w-2xl px-4 pb-20 sm:px-6"><div className="sticky top-0 z-10 flex h-14 items-center justify-between bg-[#FCFDFE]"><span className="text-sm font-semibold">内容预览</span><button type="button" autoFocus onClick={() => setPreviewOpen(false)} aria-label="关闭预览" className="grid size-10 place-items-center rounded-[var(--radius-control)] hover:bg-[#E9EDF2]"><X size={20} /></button></div>{draft.coverUrl && validContentImageUrl(draft.coverUrl) && <Image unoptimized src={draft.coverUrl} alt="" width={800} height={500} className="aspect-[16/9] w-full rounded-[var(--radius-card)] object-cover" />}<h2 className="mt-6 text-3xl font-semibold">{draft.title || '未命名内容'}</h2><div className="mt-7 space-y-6">{draft.blocks.map((block) => <div key={block.id}>{block.type === 'text' && <p className="whitespace-pre-wrap leading-8">{block.text}</p>}{block.type === 'image' && block.url && validContentImageUrl(block.url) && <Image unoptimized src={block.url} alt="" width={800} height={500} className="w-full rounded-[var(--radius-card)]" />}{block.type === 'video' && validContentVideoUrl(block.url) && <video controls playsInline preload="metadata" className="max-h-[520px] w-full rounded-[var(--radius-card)] bg-black"><source src={block.url} type={block.url.split('?')[0].toLowerCase().endsWith('.webm') ? 'video/webm' : 'video/mp4'} /></video>}{(block.type === 'product' || block.type === 'group') && <ProductRows ids={block.productIds} products={products} compact={block.type === 'group'} />}</div>)}</div>{selectedIds.length > 0 && <div className="mt-10 border-t border-[var(--border-subtle)] pt-6"><h3 className="mb-3 text-lg font-semibold">相关商品</h3><ProductRows ids={selectedIds} products={products} compact /></div>}</div></div>}
  </div>
}

function InsertMenu({ choose, close }: { choose: (type: InsertType) => void; close: () => void }) {
  const options: { type: InsertType; label: string; icon: typeof Type }[] = [
    { type: 'text', label: '文字', icon: Type },
    { type: 'image', label: '图片', icon: ImagePlus },
    { type: 'video', label: '视频', icon: Film },
    { type: 'product', label: '商品', icon: Package },
    { type: 'group', label: '商品组', icon: Package },
  ]
  return <div role="menu" aria-label="插入内容" className="absolute left-8 top-9 z-20 w-44 rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[#FCFDFE] p-1 shadow-sm">{options.map(({ type, label, icon: Icon }) => <button key={type} type="button" role="menuitem" onClick={() => choose(type)} className="flex min-h-10 w-full items-center gap-3 rounded-[var(--radius-control)] px-3 text-left text-sm hover:bg-[#E9EDF2] focus-visible:outline-2 focus-visible:outline-[#315BFF]"><Icon size={16} />{label}</button>)}<button type="button" onClick={close} className="w-full rounded-[var(--radius-control)] px-3 py-2 text-left text-xs text-[var(--text-secondary)] hover:bg-[#E9EDF2]">取消</button></div>
}

export function CreatorWorksManager() {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'published' | 'draft'>('published')
  useEffect(() => {
    let active = true
    void fetchLibrary().then((library) => { if (active) setPosts(library.posts) })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : '加载作品失败') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])
  const visible = posts.filter((post) => post.status === tab)
  return <div className="mx-auto max-w-[1100px] px-4 py-6 sm:px-8">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><Link href="/dashboard/content" className="mb-3 inline-flex items-center gap-1 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"><ArrowLeft size={15} />返回编辑</Link><h1 className="text-2xl font-semibold">管理作品</h1></div><Link href="/dashboard/content?new=1" className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[var(--text-primary)] px-5 text-sm text-white"><Plus size={16} />新建内容</Link></header>
    <div className="mt-8 flex gap-5 border-b border-[var(--border-subtle)]">{(['published', 'draft'] as const).map((value) => <button key={value} type="button" onClick={() => setTab(value)} aria-current={tab === value ? 'page' : undefined} className={`border-b-2 pb-3 text-sm ${tab === value ? 'border-[#315BFF] font-semibold text-[var(--text-primary)]' : 'border-transparent text-[var(--text-secondary)]'}`}>{value === 'published' ? '已发布' : '草稿'} · {posts.filter((post) => post.status === value).length}</button>)}</div>
    {error && <p role="alert" className="mt-6 text-sm text-red-700">{error}</p>}
    {loading ? <p className="mt-8 text-sm text-[var(--text-secondary)]">正在加载作品…</p> : visible.length === 0 ? <div className="mt-12"><p className="text-sm text-[var(--text-secondary)]">{tab === 'published' ? '还没有发布的作品。' : '还没有保存的草稿。'}</p><Link href="/dashboard/content?new=1" className="mt-3 inline-block text-sm text-[#315BFF] hover:underline">新建内容</Link></div> : <div className="mt-3 space-y-1">{visible.map((post) => <div key={post.id} className="flex flex-wrap items-center gap-4 rounded-[var(--radius-control)] p-3 hover:bg-[#E9EDF2]"><Link href={`/dashboard/content?id=${post.id}`} className="flex min-w-0 flex-1 items-center gap-4 focus-visible:outline-2 focus-visible:outline-[#315BFF]">{post.cover_url ? <Image unoptimized src={post.cover_url} alt="" width={68} height={68} className="size-16 shrink-0 rounded-[var(--radius-control)] object-cover" /> : <span className="size-16 shrink-0 rounded-[var(--radius-control)] border border-[var(--border-subtle)]" />}<span className="min-w-0"><span className="block truncate text-sm font-medium">{post.title || '未命名内容'}</span><span className="mt-1 block text-xs text-[var(--text-secondary)]">{post.draft_version ? '有待发布修改 · ' : ''}{new Date(post.updated_at).toLocaleDateString('zh-CN')}</span></span></Link><Link href={`/dashboard/content?id=${post.id}`} className="text-sm text-[#315BFF] hover:underline">{tab === 'published' ? '编辑' : '继续编辑'}</Link>{tab === 'published' && <Link href={`/discover?post=${post.id}`} className="inline-flex items-center gap-1 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">查看作品<ExternalLink size={13} /></Link>}</div>)}</div>}
  </div>
}
