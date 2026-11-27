'use client'

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import dynamic from 'next/dynamic'
import { ArchiveRestore, CheckCircle2, Clock3, FileText, Film, ImageIcon, Plus, Search, Trash2, X } from 'lucide-react'
import { archiveLocalPublication, listLocalPublications, publicationTitle, type LocalPublication, type PublicationKind, type PublicationStatus } from '@/lib/creator-publications'
import { readContentBlocks, type ContentBlock } from '@/lib/creator-content'
import { getArticleBackground } from '@/lib/creator-article-backgrounds'
import { remotePublication, type RemotePublication } from '@/lib/creator-publication-document'
import { archiveRemotePublication } from '@/lib/creator-publication-client'
import { publishManagedArticle } from '@/lib/creator-article-publish'
import styles from './CreatorContentManager.module.css'

const ArticlePhonePreview = dynamic(() => import('./ArticlePhonePreview').then((module) => module.ArticlePhonePreview), { ssr: false, loading: () => <p role="status">正在加载文章…</p> })
type OnlinePost = { id: string; title: string; cover_url: string; body: string; blocks: unknown; product_ids: string[]; status: PublicationStatus; published_at: string | null; updated_at: string; created_at: string; draft_version: unknown; publication?: unknown; scheduled_at?: string; visibility?: string }
type Product = { id: string; name: string; image: string | null }
type Row = { id: string; kind: PublicationKind; title: string; status: PublicationStatus; updatedAt: number; publishedAt: number | null; cover: string; urls: string[]; local?: LocalPublication; online?: OnlinePost; remote?: RemotePublication; pending: boolean }
const kindLabels: Record<PublicationKind, string> = { video: '视频', image: '图文', article: '文章' }
const statusLabels: Record<PublicationStatus, string> = { published: '已发布', scheduled: '定时', draft: '草稿', archived: '回收站' }
const dateFormat = new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })

function contentTime(row: Row) {
  if (row.status === 'scheduled' && row.remote?.scheduledAt) return Date.parse(row.remote.scheduledAt)
  const content = row.local?.content
  const scheduled = row.status === 'scheduled' && content && content.kind !== 'article' ? new Date(content.fields.scheduledAt).getTime() : NaN
  return Number.isFinite(scheduled) ? scheduled : row.publishedAt ?? row.updatedAt
}

function localRow(record: LocalPublication, objectUrls: string[]): Row {
  const content = record.content
  const url = (file: File) => { const value = URL.createObjectURL(file); objectUrls.push(value); return value }
  const media = content.kind === 'article' ? [] : content.media.map(url)
  return { id: record.id, kind: content.kind, title: publicationTitle(content), status: record.status, updatedAt: record.updatedAt, publishedAt: record.publishedAt, cover: content.kind === 'article' ? content.article.cover?.url ?? '' : content.cover ? url(content.cover) : content.kind === 'image' ? media[0] ?? '' : '', urls: media, local: record, pending: Boolean(record.pending) }
}

function onlineRow(post: OnlinePost): Row {
  const remote = remotePublication(post)
  if (remote) return { id: post.id, kind: remote.content.kind, title: remote.content.fields.title, status: remote.status, updatedAt: remote.updatedAt, publishedAt: remote.publishedAt, cover: remote.content.coverUrl, urls: remote.content.media, online: post, remote, pending: Boolean(remote.pending) }
  const blocks = readContentBlocks(post.blocks, post.body, post.product_ids)
  const kind = blocks.some((block) => block.type === 'video') ? 'video' : blocks.some((block) => block.type === 'image') ? 'image' : 'article'
  return { id: post.id, kind, title: post.title, status: post.status, updatedAt: Date.parse(post.updated_at), publishedAt: post.published_at ? Date.parse(post.published_at) : null, cover: post.cover_url, urls: [], online: post, pending: Boolean(post.draft_version) }
}

export function CreatorContentManager({ ownerKey, publishingHref, previewMode = false }: { ownerKey: string; publishingHref: string; previewMode?: boolean }) {
  const [rows, setRows] = useState<Row[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [status, setStatus] = useState<PublicationStatus | 'all'>('all')
  const [kind, setKind] = useState<PublicationKind | 'all'>('all')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [previewId, setPreviewId] = useState<string | null>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const urls = useRef<string[]>([])
  const alive = useRef(false)
  const loadSequence = useRef(0)
  const previewRow = rows.find((row) => row.id === previewId)

  const load = useCallback(async () => {
    const sequence = ++loadSequence.current
    try {
      const [local, online] = await Promise.all([
        listLocalPublications(ownerKey),
        previewMode ? Promise.resolve({ posts: [] as OnlinePost[], products: [] as Product[], error: '' }) : fetch('/api/creator-posts').then(async (response) => {
          const result = await response.json()
          if (!response.ok) return { posts: [], products: [], error: result.error || '线上内容加载失败，请重试。' }
          return { posts: result.posts as OnlinePost[], products: result.products as Product[], error: '' }
        }).catch(() => ({ posts: [] as OnlinePost[], products: [] as Product[], error: '网络连接失败，请重试。' })),
      ])
      if (!alive.current || sequence !== loadSequence.current) return
      const nextUrls: string[] = []
      const next = [...local.map((record) => localRow(record, nextUrls)), ...online.posts.map(onlineRow)].sort((a, b) => b.updatedAt - a.updatedAt)
      urls.current.forEach((url) => URL.revokeObjectURL(url))
      urls.current = nextUrls
      setRows(next); setProducts(online.products); setError(online.error); setLoading(false)
    } catch {
      if (alive.current && sequence === loadSequence.current) { setError('本机内容读取失败，请检查浏览器存储权限后重试。'); setLoading(false) }
    }
  }, [ownerKey, previewMode])

  useEffect(() => {
    alive.current = true
    void Promise.resolve().then(load)
    const refresh = () => { void load() }
    window.addEventListener('focus', refresh)
    return () => { alive.current = false; loadSequence.current += 1; window.removeEventListener('focus', refresh); urls.current.forEach((url) => URL.revokeObjectURL(url)); urls.current = [] }
  }, [load])

  useEffect(() => {
    const scheduled = rows.filter((row) => row.status === 'scheduled' && row.local?.content.kind !== 'article')
    if (!scheduled.length) return
    const timer = window.setTimeout(() => { void load() }, 30000)
    return () => window.clearTimeout(timer)
  }, [rows, load])

  useEffect(() => {
    const dialog = dialogRef.current
    if (previewId && previewRow && !dialog?.open) dialog?.showModal()
    if ((!previewId || !previewRow) && dialog?.open) dialog.close()
  }, [previewId, previewRow])

  const visible = rows.filter((row) => (status === 'all' ? row.status !== 'archived' : row.status === status) && (kind === 'all' || row.kind === kind) && row.title.toLowerCase().includes(query.toLowerCase().trim()))
  const selectable = visible.map((row) => row.id)
  const count = (value: PublicationStatus | 'all') => rows.filter((row) => value === 'all' ? row.status !== 'archived' : row.status === value).length
  const editHref = (row: Row) => row.local || row.remote ? `${publishingHref}${publishingHref.includes('?') ? '&' : '?'}post=${encodeURIComponent(row.id)}` : `/dashboard/content/manage?edit=${encodeURIComponent(row.id)}`
  const publicHref = (row: Row) => row.status !== 'published' ? null : row.local ? previewMode && (row.local.content.kind === 'article' || row.local.content.fields.visibility === 'public') ? `/discover?creatorPreview=1&post=${row.id}` : null : row.online?.visibility !== 'private' ? `/discover?post=${row.id}` : null

  async function archive(ids: string[], restore = false) {
    setBusy(true)
    try {
      await Promise.all(ids.map((id) => rows.find((row) => row.id === id)?.local ? archiveLocalPublication(ownerKey, id, restore) : archiveRemotePublication(id, restore)))
      setSelected([]); setNotice(restore ? '内容已恢复。' : '已移入回收站，可随时恢复。'); await load()
    } catch { setError('操作未完成，请重试。') }
    finally { setBusy(false) }
  }

  async function publishArticle(row: Row) {
    setBusy(true); setError(''); setNotice('')
    try {
      const result = await publishManagedArticle({ id: row.id, ownerKey, local: Boolean(row.local), previewMode })
      setNotice(result.localCleanupFailed ? '文章已发布，本机记录未能归档。' : previewMode ? '已发布到本机预览。' : '文章已发布。')
      await load()
    } catch (cause) { setError(cause instanceof Error ? cause.message : '发布失败，请重试。') }
    finally { setBusy(false) }
  }

  return <div className={styles.workspace}>
    <div className={styles.heading}><h1>内容管理</h1><Link href={publishingHref} className={styles.button} data-glass-control=""><Plus size={16} aria-hidden="true" />发布内容</Link></div>
    <div className={styles.tabs} role="tablist" aria-label="内容状态">{(['all', 'published', 'scheduled', 'draft', 'archived'] as const).map((value) => <button key={value} type="button" role="tab" className={styles.tab} aria-selected={status === value} onClick={() => { setStatus(value); setSelected([]) }}>{value === 'all' ? '全部' : statusLabels[value]}<span>{count(value)}</span></button>)}</div>
    <div className={`${styles.toolbar} ui-glass`}>
      <div className={styles.filters} role="group" aria-label="内容类型">{(['all', 'video', 'image', 'article'] as const).map((value) => <button key={value} type="button" aria-pressed={kind === value} onClick={() => { setKind(value); setSelected([]) }}>{value === 'all' ? '全部类型' : kindLabels[value]}</button>)}</div>
      <label className={`${styles.search} ui-glass`}><Search size={16} aria-hidden="true" /><input aria-label="搜索内容" placeholder="搜索标题" value={query} data-liquid-skip="" onChange={(event) => { setQuery(event.target.value); setSelected([]) }} /></label>
    </div>
    {error && <p className={`${styles.feedback} ${styles.error}`} role="alert">{error}<button type="button" className={styles.button} onClick={() => { void load() }}>重试</button></p>}
    {notice && <p className={styles.feedback} role="status">{notice}</p>}
    {loading ? <p className={styles.empty} role="status">正在加载内容…</p> : !visible.length ? <div className={styles.empty}><FileText size={36} strokeWidth={1.4} aria-hidden="true" /><h2>{query || kind !== 'all' ? '没有匹配的内容' : status === 'archived' ? '回收站为空' : status === 'all' ? '还没有内容' : `暂无${statusLabels[status]}内容`}</h2><Link href={publishingHref} className={styles.button} data-glass-control="">发布内容</Link></div> : <>
      {selectable.length > 0 && <div className={styles.selection}><label><input type="checkbox" aria-label="选择本页内容" checked={selectable.every((id) => selected.includes(id))} onChange={(event) => setSelected(event.target.checked ? selectable : [])} />全选</label>{selected.length > 0 && <><span>已选 {selected.length} 项</span><button type="button" className={styles.button} disabled={busy} onClick={() => { void archive(selected, status === 'archived') }}>{status === 'archived' ? '恢复' : '移入回收站'}</button></>}</div>}
      <div className={styles.tableHeading} aria-hidden="true"><span /><span>作品</span><span>状态</span><span>更新时间</span><span>操作</span></div>
      <div aria-label="内容列表">{visible.map((row) => <article key={`${row.local ? 'local' : 'online'}-${row.id}`} className={styles.row}>
        <label className={styles.rowCheck}><input type="checkbox" aria-label={`选择${row.title || '未命名内容'}`} checked={selected.includes(row.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, row.id] : current.filter((id) => id !== row.id))} /></label>
        <div className={styles.content}><button type="button" className={styles.cover} data-liquid-skip="" aria-label={`预览${row.title || '未命名内容'}`} onClick={() => setPreviewId(row.id)}>{row.cover ? <Image src={row.cover} alt="" fill unoptimized sizes="104px" /> : row.kind === 'video' ? <Film size={24} aria-hidden="true" /> : row.kind === 'image' ? <ImageIcon size={24} aria-hidden="true" /> : <FileText size={24} aria-hidden="true" />}</button><div><h2 className={styles.title}>{row.title.trim() || '未命名内容'}</h2><div className={styles.meta}><span>{kindLabels[row.kind]}</span><span>{row.local ? '本机预览' : '线上'}</span>{(row.online?.visibility === 'private' || row.local && row.local.content.kind !== 'article' && row.local.content.fields.visibility === 'private') && <span>仅自己可见</span>}{row.pending && <span>有未发布修改</span>}<time dateTime={new Date(contentTime(row)).toISOString()}>{row.status === 'scheduled' ? '预约 ' : ''}{dateFormat.format(contentTime(row))}</time></div></div></div>
        <div className={styles.state}>{row.status === 'published' ? <CheckCircle2 size={15} aria-hidden="true" /> : row.status === 'scheduled' ? <Clock3 size={15} aria-hidden="true" /> : row.status === 'archived' ? <Trash2 size={15} aria-hidden="true" /> : <FileText size={15} aria-hidden="true" />}{statusLabels[row.status]}</div>
        <time className={styles.date} dateTime={new Date(row.updatedAt).toISOString()}>{dateFormat.format(row.updatedAt)}</time>
        <div className={styles.actions}><button type="button" onClick={() => setPreviewId(row.id)}>预览</button>{publicHref(row) && <Link href={publicHref(row)!} className={styles.button} data-glass-control="">查看</Link>}{row.status !== 'archived' && <Link href={editHref(row)} className={styles.button} data-glass-control="">编辑</Link>}{row.kind === 'article' && (row.local || row.remote) && row.status !== 'archived' && row.status !== 'scheduled' && (row.status === 'draft' || row.pending || Boolean(row.local && !previewMode)) && <button type="button" disabled={busy} aria-label={`${row.status === 'published' && row.pending ? '发布更新' : '发布'}：${row.title}`} onClick={() => { void publishArticle(row) }}>{row.status === 'published' && row.pending ? '更新' : '发布'}</button>}<button type="button" className={styles.iconButton} disabled={busy} aria-label={row.status === 'archived' ? `恢复${row.title}` : `移入回收站：${row.title}`} onClick={() => { void archive([row.id], row.status === 'archived') }}>{row.status === 'archived' ? <ArchiveRestore size={16} aria-hidden="true" /> : <Trash2 size={16} aria-hidden="true" />}</button></div>
      </article>)}</div>
    </>}
    <dialog ref={dialogRef} className={styles.dialog} aria-labelledby="managed-preview-title" onClose={() => setPreviewId(null)} onCancel={() => setPreviewId(null)} onClick={(event) => { if (event.target === event.currentTarget) setPreviewId(null) }}>
      <div className={styles.dialogHeading}><h2 id="managed-preview-title">内容预览</h2><button type="button" className={styles.iconButton} aria-label="关闭内容预览" onClick={() => setPreviewId(null)}><X size={18} aria-hidden="true" /></button></div>
      {previewRow && <PublicationPreview row={previewRow} products={products} />}
    </dialog>
  </div>
}

function PublicationPreview({ row, products }: { row: Row; products: Product[] }) {
  const published = row.remote?.content ?? row.local?.content
  const pending = row.remote?.pending ?? row.local?.pending
  const content = row.kind === 'article' && pending?.kind === 'article' ? pending : published
  if (content?.kind === 'article' && content.article) return <div className={styles.articlePreview} style={{ '--article-background': getArticleBackground(content.article.background).color } as CSSProperties}><ArticlePhonePreview draft={content.article} /></div>
  const blocks: ContentBlock[] = row.online && !row.remote ? readContentBlocks(row.online.blocks, row.online.body, row.online.product_ids) : []
  return <div className={styles.preview}>
    <h2>{row.title || '未命名内容'}</h2>
    {content?.kind === 'video' && row.urls[0] && <video src={row.urls[0]} controls playsInline preload="metadata" />}
    {content?.kind === 'image' && row.urls.map((url, index) => <div key={url} className={styles.previewImage}><Image src={url} alt={`图片 ${index + 1}`} fill sizes="680px" unoptimized /></div>)}
    {content && 'fields' in content && <p>{content.fields.summary}</p>}
    {blocks.map((block) => block.type === 'text' ? <p key={block.id}>{block.text}</p> : block.type === 'image' ? <div key={block.id} className={styles.previewImage}><Image src={block.url} alt="内容图片" fill sizes="680px" unoptimized /></div> : block.type === 'video' ? <video key={block.id} src={block.url} controls playsInline preload="metadata" /> : <div key={block.id} className={styles.legacyProducts}>{block.productIds.map((id) => <span key={id}>{products.find((product) => product.id === id)?.name ?? '商品'}</span>)}</div>)}
  </div>
}
