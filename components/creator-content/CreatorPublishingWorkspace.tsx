'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, FileVideo2, ImagePlus, UploadCloud, X } from 'lucide-react'
import Image from 'next/image'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { archiveLocalPublication, getLocalPublication, saveLocalPublication } from '@/lib/creator-publications'
import { readRemotePublication, saveRemotePublication, uploadArticleImages, uploadCreatorFile } from '@/lib/creator-publication-client'
import { articlePublication, type PublicationDocument } from '@/lib/creator-publication-document'
import type { ArticleDraft } from '@/lib/creator-article-draft'
import { isCreatorImage, isCreatorVideo, MAX_CREATOR_IMAGE_BYTES, MAX_CREATOR_IMAGE_COUNT, MAX_CREATOR_VIDEO_BYTES, takeStagedCreatorUpload, validateCreatorImages } from '@/lib/creator-preview-upload'

type PublishKind = 'video' | 'image' | 'article'
type MediaKind = 'video' | 'image'
type Visibility = 'public' | 'friends' | 'private'
type Timing = 'now' | 'scheduled'
type LocalMedia = { file: File | null; url: string }

type DraftFields = {
  title: string
  summary: string
  topics: string
  collection: string
  declaration: string
  location: string
  visibility: Visibility
  allowSave: boolean
  timing: Timing
  scheduledAt: string
}

const emptyDraft: DraftFields = {
  title: '', summary: '', topics: '', collection: '', declaration: '', location: '',
  visibility: 'public', allowSave: true, timing: 'now', scheduledAt: '',
}

const kinds: { id: PublishKind; label: string }[] = [
  { id: 'video', label: '发布视频' },
  { id: 'image', label: '发布图文' },
  { id: 'article', label: '发布文章' },
]

const CreatorArticleWorkspace = dynamic(() => import('./CreatorArticleWorkspace'), {
  ssr: false,
  loading: () => <p className="py-16 text-center text-sm text-[var(--text-secondary)]" role="status">正在加载文章编辑器…</p>,
})

export function CreatorPublishingWorkspace({ draftKey, fromWorkbench = false, recordId, managementHref = '/dashboard/content/manage', previewMode = false }: { draftKey: string; fromWorkbench?: boolean; recordId?: string; managementHref?: string; previewMode?: boolean }) {
  const router = useRouter()
  const recordIds = useRef<Partial<Record<PublishKind, string>>>({})
  const migratedLocalId = useRef<string | null>(null)
  const uploadedFiles = useRef(new WeakMap<File, string>())
  const uploadedArticleImages = useRef(new Map<string, string>())
  const [publishing, setPublishing] = useState(false)
  const [recordLoading, setRecordLoading] = useState(Boolean(recordId))
  const [publicationError, setPublicationError] = useState('')
  const videoInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const coverInputRef = useRef<HTMLInputElement>(null)
  const reviewDialogRef = useRef<HTMLDialogElement>(null)
  const uploadFeedbackRef = useRef<HTMLParagraphElement>(null)
  const videoMediaRef = useRef<LocalMedia | null>(null)
  const imageMediaRef = useRef<LocalMedia[]>([])
  const coverMediaRef = useRef<Record<MediaKind, LocalMedia | null>>({ video: null, image: null })
  const [kind, setKind] = useState<PublishKind>('video')
  const [articleVisited, setArticleVisited] = useState(false)
  const [videoMedia, setVideoMedia] = useState<LocalMedia | null>(null)
  const [imageMedia, setImageMedia] = useState<LocalMedia[]>([])
  const [coverMedia, setCoverMedia] = useState<Record<MediaKind, LocalMedia | null>>({ video: null, image: null })
  const [drafts, setDrafts] = useState<Record<MediaKind, DraftFields>>({ video: { ...emptyDraft }, image: { ...emptyDraft } })
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState('')
  const [uploadError, setUploadError] = useState('')
  const [status, setStatus] = useState('')
  const [reviewOpen, setReviewOpen] = useState(false)
  const [previewTab, setPreviewTab] = useState<'media' | 'cover'>('media')
  const [previewImageIndex, setPreviewImageIndex] = useState(0)
  const mediaKind: MediaKind = kind === 'image' ? 'image' : 'video'
  const fields = drafts[mediaKind]
  const videoFile = videoMedia?.file ?? null
  const videoUrl = videoMedia?.url ?? ''
  const coverUrl = coverMedia[mediaKind]?.url ?? (mediaKind === 'image' ? imageMedia[0]?.url : '') ?? ''
  const hasMedia = mediaKind === 'image' ? imageMedia.length > 0 : Boolean(videoMedia)
  const currentImageIndex = Math.min(previewImageIndex, Math.max(0, imageMedia.length - 1))
  const currentImage = imageMedia[currentImageIndex]
  const mediaLabel = mediaKind === 'image' ? '图片' : '视频'

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const restored = { video: { ...emptyDraft }, image: { ...emptyDraft } }
        let hasSavedDraft = false
        for (const type of ['video', 'image'] as const) {
          const saved = window.localStorage.getItem(type === 'video' ? draftKey : `${draftKey}:image`)
          if (saved) {
            restored[type] = { ...emptyDraft, ...JSON.parse(saved) as Partial<DraftFields> }
            if (restored[type].visibility === 'friends') restored[type].visibility = 'private'
            hasSavedDraft = true
          }
        }
        setDrafts(restored)
        if (hasSavedDraft) setStatus('已恢复本地草稿，请重新选择素材。')
      } catch {
        setStatus('本地草稿无法读取，请重新填写。')
      }
      const staged = takeStagedCreatorUpload()
      if (staged?.kind === 'video') {
        const media = { file: staged.file, url: URL.createObjectURL(staged.file) }
        if (videoMediaRef.current) URL.revokeObjectURL(videoMediaRef.current.url)
        videoMediaRef.current = media
        setVideoMedia(media)
      } else if (staged?.kind === 'image') {
        const media = staged.files.map((file) => ({ file, url: URL.createObjectURL(file) }))
        imageMediaRef.current.forEach((image) => URL.revokeObjectURL(image.url))
        imageMediaRef.current = media
        setImageMedia(media)
        setKind('image')
      }
    }, 0)
    return () => window.clearTimeout(timer)
  }, [draftKey])

  useEffect(() => () => {
    if (videoMediaRef.current) URL.revokeObjectURL(videoMediaRef.current.url)
    imageMediaRef.current.forEach((image) => URL.revokeObjectURL(image.url))
    Object.values(coverMediaRef.current).forEach((cover) => { if (cover) URL.revokeObjectURL(cover.url) })
  }, [])

  useEffect(() => {
    if (!recordId) return
    let active = true
    const read = async () => {
      if (previewMode) return getLocalPublication(draftKey, recordId)
      try { return await readRemotePublication(recordId) } catch (cause) {
        const local = await getLocalPublication(draftKey, recordId)
        if (!local) throw cause
        migratedLocalId.current = local.id
        return local
      }
    }
    void read().then((record) => {
      if (!active) return
      if (!record) throw new Error('没有找到这篇内容，请返回内容管理。')
      const content = record.pending ?? record.content
      const local = 'ownerKey' in record
      recordIds.current[content.kind] = !previewMode && local ? undefined : record.id
      setKind(content.kind)
      if (content.kind === 'article') { setArticleVisited(true); return }
      if ('cover' in content) {
        if (content.kind === 'video' && content.media[0]) selectVideo(content.media[0])
        if (content.kind === 'image') selectImages(content.media)
      } else {
        if (content.kind === 'video' && content.media[0]) { const media = { file: null, url: content.media[0] }; videoMediaRef.current = media; setVideoMedia(media) }
        if (content.kind === 'image') { const media = content.media.map((url) => ({ file: null, url })); imageMediaRef.current = media; setImageMedia(media) }
      }
      const restoredCover = 'cover' in content ? content.cover ? { file: content.cover, url: URL.createObjectURL(content.cover) } : null : content.coverUrl ? { file: null, url: content.coverUrl } : null
      if (restoredCover) {
        const media = restoredCover
        coverMediaRef.current[content.kind] = media
        setCoverMedia({ ...coverMediaRef.current })
      }
      const restoredFields = { ...content.fields, visibility: content.fields.visibility === 'friends' ? 'private' : content.fields.visibility }
      if (!local && restoredFields.scheduledAt) { const time = new Date(restoredFields.scheduledAt); restoredFields.scheduledAt = new Date(time.getTime() - time.getTimezoneOffset() * 60000).toISOString().slice(0, 16) }
      setDrafts((current) => ({ ...current, [content.kind]: restoredFields }))
      setStatus('已恢复内容，可继续编辑。')
    }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : '读取内容失败。') }).finally(() => { if (active) setRecordLoading(false) })
    return () => { active = false }
  }, [draftKey, recordId, previewMode])

  useEffect(() => {
    const dialog = reviewDialogRef.current
    if (reviewOpen && !dialog?.open) dialog?.showModal()
    if (!reviewOpen && dialog?.open) dialog.close()
  }, [reviewOpen])

  useEffect(() => {
    if (uploadError) uploadFeedbackRef.current?.scrollIntoView({ block: 'nearest' })
  }, [uploadError])

  function update<K extends keyof DraftFields>(key: K, value: DraftFields[K]) {
    setDrafts((current) => ({ ...current, [mediaKind]: { ...current[mediaKind], [key]: value } }))
    setError('')
    setStatus('')
  }

  function selectVideo(file: File | undefined) {
    setDragging(false)
    if (!file) return
    if (!isCreatorVideo(file)) return setUploadError('请选择 MP4 或 WebM 视频。')
    if (file.size > MAX_CREATOR_VIDEO_BYTES) return setUploadError('视频不能超过 100 MB。')
    const media = { file, url: URL.createObjectURL(file) }
    if (videoMediaRef.current) URL.revokeObjectURL(videoMediaRef.current.url)
    videoMediaRef.current = media
    setVideoMedia(media)
    setUploadError('')
    setError('')
    setStatus('')
  }

  function selectCover(file: File | undefined) {
    if (!file) return
    if (!isCreatorImage(file)) return setError('封面请选择 JPG、PNG 或 WebP 图片。')
    if (file.size > MAX_CREATOR_IMAGE_BYTES) return setError('封面不能超过 5 MB。')
    const media = { file, url: URL.createObjectURL(file) }
    if (coverMediaRef.current[mediaKind]) URL.revokeObjectURL(coverMediaRef.current[mediaKind].url)
    coverMediaRef.current = { ...coverMediaRef.current, [mediaKind]: media }
    setCoverMedia(coverMediaRef.current)
    setError('')
    setStatus('')
  }

  function selectImages(files: File[]) {
    setDragging(false)
    if (!files.length) return
    const current = imageMediaRef.current
    const additions = files.filter((file) => !current.some((image) => image.file?.name === file.name && image.file.size === file.size && image.file.lastModified === file.lastModified))
    const validationError = validateCreatorImages(additions, current.length)
    if (validationError) return setUploadError(validationError)
    setUploadError('')
    if (!additions.length) {
      setError('')
      setStatus('这些图片已添加。')
      return
    }
    const media = [...current, ...additions.map((file) => ({ file, url: URL.createObjectURL(file) }))]
    imageMediaRef.current = media
    setImageMedia(media)
    setError('')
    setStatus('')
  }

  function resetImageCover() {
    const cover = coverMediaRef.current.image
    if (cover) URL.revokeObjectURL(cover.url)
    coverMediaRef.current = { ...coverMediaRef.current, image: null }
    setCoverMedia(coverMediaRef.current)
    setError('')
    setStatus('')
  }

  function removeImage(index: number) {
    const current = imageMediaRef.current
    URL.revokeObjectURL(current[index].url)
    const media = current.filter((_, itemIndex) => itemIndex !== index)
    imageMediaRef.current = media
    setImageMedia(media)
    setPreviewImageIndex((active) => active > index ? active - 1 : Math.min(active, Math.max(0, media.length - 1)))
    if (!media.length) resetImageCover()
    setUploadError('')
    setError('')
    setStatus('')
  }

  function moveImage(index: number, direction: -1 | 1) {
    const target = index + direction
    const media = [...imageMediaRef.current]
    if (target < 0 || target >= media.length) return
    const [moved] = media.splice(index, 1)
    media.splice(target, 0, moved)
    imageMediaRef.current = media
    setImageMedia(media)
    setPreviewImageIndex((active) => active === index ? target : active === target ? index : active)
    setError('')
    setStatus('')
  }

  async function uploadedMedia(media: LocalMedia) {
    if (!media.file) return media.url
    const existing = uploadedFiles.current.get(media.file)
    if (existing) return existing
    const url = await uploadCreatorFile(media.file)
    uploadedFiles.current.set(media.file, url)
    return url
  }

  async function mediaDocument(): Promise<PublicationDocument> {
    const media = []
    for (const item of mediaKind === 'image' ? imageMedia : videoMedia ? [videoMedia] : []) media.push(await uploadedMedia(item))
    const cover = coverMedia[mediaKind]
    return { version: 1, kind: mediaKind, fields: { ...fields, scheduledAt: fields.timing === 'scheduled' && fields.scheduledAt ? new Date(fields.scheduledAt).toISOString() : '' },
      media, coverUrl: cover ? await uploadedMedia(cover) : mediaKind === 'image' ? media[0] ?? '' : '', excerpt: fields.summary }
  }

  async function finishMigration() {
    if (!migratedLocalId.current) return
    try { await archiveLocalPublication(draftKey, migratedLocalId.current); migratedLocalId.current = null }
    catch { /* The server save already committed; local cleanup must not turn it into a failed publication. */ }
  }

  async function saveDraft() {
    setPublishing(true)
    try {
      window.localStorage.setItem(mediaKind === 'video' ? draftKey : `${draftKey}:image`, JSON.stringify(fields))
      const record = previewMode
        ? await saveLocalPublication(draftKey, { kind: mediaKind, fields, media: mediaKind === 'video' ? videoFile ? [videoFile] : [] : imageMedia.flatMap((item) => item.file ? [item.file] : []), cover: coverMedia[mediaKind]?.file ?? null }, 'draft', recordIds.current[mediaKind])
        : await saveRemotePublication(await mediaDocument(), 'draft', recordIds.current[mediaKind])
      recordIds.current[mediaKind] = record.id
      if (!previewMode) { await finishMigration(); window.history.replaceState(null, '', `/dashboard/content?post=${record.id}`) }
      setStatus('草稿已保存，可在内容管理中查看。')
      setError('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '草稿保存失败，请重试。')
    } finally { setPublishing(false) }
  }

  async function publishMedia() {
    setPublishing(true); setPublicationError('')
    try {
      const target = fields.timing === 'scheduled' ? 'scheduled' : 'published'
      const record = previewMode
        ? await saveLocalPublication(draftKey, { kind: mediaKind, fields, media: mediaKind === 'video' ? videoFile ? [videoFile] : [] : imageMedia.flatMap((item) => item.file ? [item.file] : []), cover: coverMedia[mediaKind]?.file ?? null }, target, recordIds.current[mediaKind])
        : await saveRemotePublication(await mediaDocument(), target, recordIds.current[mediaKind])
      recordIds.current[mediaKind] = record.id
      if (!previewMode) await finishMigration()
      setReviewOpen(false)
      router.push(managementHref)
    } catch (cause) { setPublicationError(cause instanceof Error ? cause.message : '保存失败，请重试。') }
    finally { setPublishing(false) }
  }

  async function storeArticle(article: ArticleDraft) {
    const uploadedArticle = previewMode ? article : await uploadArticleImages(article, uploadedArticleImages.current)
    const record = previewMode ? await saveLocalPublication(draftKey, { kind: 'article', article }, 'draft', recordIds.current.article)
      : await saveRemotePublication(articlePublication(uploadedArticle), 'draft', recordIds.current.article)
    recordIds.current.article = record.id
    if (!previewMode) await finishMigration()
    if (!previewMode) window.history.replaceState(null, '', `/dashboard/content?post=${record.id}`)
  }

  function checkPublication() {
    if (!hasMedia) return setError(`请先选择${mediaLabel}。`)
    if (!fields.title.trim()) return setError('请填写作品标题。')
    if (!coverUrl) return setError('请选择封面。')
    const scheduledTime = new Date(fields.scheduledAt).getTime()
    if (fields.timing === 'scheduled' && (!Number.isFinite(scheduledTime) || scheduledTime <= Date.now())) return setError('请选择将来的发布时间。')
    setError('')
    setReviewOpen(true)
  }

  const missingCount = Number(!hasMedia) + Number(!fields.title.trim()) + Number(!coverUrl)

  return (
    <div className="creator-publishing-workspace min-h-full bg-[var(--canvas)] px-5 pb-20 pt-7 text-[var(--text-primary)] sm:px-8 lg:px-12">
      <div className="mx-auto max-w-[1480px]">
        <div className="flex flex-wrap items-center gap-2 border-b-[0.5px] border-[var(--border-subtle)] pb-3 sm:gap-3" role="tablist" aria-label="发布类型">
          {kinds.map((item) => <button key={item.id} type="button" data-liquid-skip="" role="tab" aria-selected={kind === item.id} onClick={() => { setKind(item.id); if (item.id === 'article') setArticleVisited(true); setError(''); setUploadError(''); setStatus(''); setDragging(false); setPreviewTab('media') }} className={`relative inline-flex min-h-12 shrink-0 cursor-pointer items-center justify-center whitespace-nowrap rounded-full px-4 py-2 text-base leading-6 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-primary)] ${kind === item.id ? 'font-semibold text-[var(--text-primary)] after:absolute after:bottom-1.5 after:left-4 after:right-4 after:h-[2px] after:bg-[var(--text-primary)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}>{item.label}</button>)}
        </div>

        {recordLoading && <p role="status" className="py-8 text-sm text-[var(--text-secondary)]">正在恢复内容…</p>}
        {articleVisited && <div role="tabpanel" hidden={kind !== 'article'}><CreatorArticleWorkspace key={`${draftKey}:${recordId ?? 'new'}`} draftKey={`${draftKey}:article${recordId ? `:${recordId}` : ''}`} ownerKey={draftKey} recordId={recordId} previewMode={previewMode} onSaveDraft={storeArticle} /></div>}
        {kind !== 'article' && <div role="tabpanel">
          <input ref={videoInputRef} type="file" accept="video/mp4,video/webm" className="hidden" aria-label="选择视频文件" onChange={(event) => { selectVideo(event.target.files?.[0]); event.target.value = '' }} />
          <input ref={imageInputRef} type="file" multiple accept="image/jpeg,image/png,image/webp" className="hidden" aria-label="选择图文图片" onChange={(event) => { selectImages(Array.from(event.target.files ?? [])); event.target.value = '' }} />
          <input ref={coverInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" aria-label="选择封面图片" onChange={(event) => { selectCover(event.target.files?.[0]); event.target.value = '' }} />

          <section id="creator-media" className="pt-8">
            <div
              onDragOver={(event) => { event.preventDefault(); setDragging(true) }}
              onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false) }}
              onDrop={(event) => { event.preventDefault(); if (mediaKind === 'image') selectImages(Array.from(event.dataTransfer.files)); else selectVideo(event.dataTransfer.files[0]) }}
              className={`flex flex-col items-center justify-center rounded-2xl px-4 text-center sm:px-6 ${hasMedia ? 'min-h-44 py-7' : 'min-h-[320px] py-10'} ${dragging ? 'bg-[var(--accent-primary-soft)] outline-[0.5px] outline-[var(--brand-primary)]' : 'bg-[var(--surface-muted)]'}`}
            >
              {mediaKind === 'image' && imageMedia.length ? <>
                <div className="flex w-full flex-wrap items-center justify-between gap-3 text-left">
                  <h2 className="text-lg font-semibold">已选择 {imageMedia.length} 张图片</h2>
                  <button type="button" onClick={() => imageInputRef.current?.click()} disabled={imageMedia.length >= MAX_CREATOR_IMAGE_COUNT} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[var(--text-primary)] px-5 text-sm font-medium text-[var(--surface)] hover:bg-[var(--accent-primary-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-primary)] disabled:cursor-not-allowed disabled:opacity-40"><ImagePlus size={17} aria-hidden="true" />添加图片</button>
                </div>
                <ol className="mt-5 grid w-full grid-cols-1 gap-3 min-[480px]:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                  {imageMedia.map((media, index) => <li key={media.url} className="min-w-0">
                    <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-[var(--canvas)]">
                      <Image src={media.url} alt={`图片 ${index + 1}${media.file ? `：${media.file.name}` : ''}`} fill sizes="(max-width: 640px) 45vw, 240px" unoptimized className="object-contain" />
                    </div>
                    <div className="mt-1 flex items-center justify-between text-xs text-[var(--text-secondary)]">
                      <span className="shrink-0">{index === 0 ? '首图' : index + 1}</span>
                      <div className="flex items-center">
                        <button type="button" onClick={() => moveImage(index, -1)} disabled={index === 0} aria-label={`前移第 ${index + 1} 张图片`} className="grid size-11 place-items-center rounded-full hover:bg-[var(--interactive-hover)] focus-visible:outline-2 focus-visible:outline-[var(--brand-primary)] disabled:opacity-30"><ArrowLeft size={15} aria-hidden="true" /></button>
                        <button type="button" onClick={() => moveImage(index, 1)} disabled={index === imageMedia.length - 1} aria-label={`后移第 ${index + 1} 张图片`} className="grid size-11 place-items-center rounded-full hover:bg-[var(--interactive-hover)] focus-visible:outline-2 focus-visible:outline-[var(--brand-primary)] disabled:opacity-30"><ArrowRight size={15} aria-hidden="true" /></button>
                        <button type="button" onClick={() => removeImage(index)} aria-label={`删除第 ${index + 1} 张图片`} className="grid size-11 place-items-center rounded-full hover:bg-[var(--interactive-hover)] focus-visible:outline-2 focus-visible:outline-[var(--brand-primary)]"><X size={15} aria-hidden="true" /></button>
                      </div>
                    </div>
                  </li>)}
                </ol>
              </> : mediaKind === 'video' && videoMedia ? <>
                <FileVideo2 size={32} strokeWidth={1.6} className="text-[var(--text-secondary)]" aria-hidden="true" />
                <h2 className="mt-3 text-lg font-semibold">已选择视频</h2>
                <p className="mt-1 max-w-full truncate text-sm text-[var(--text-secondary)]" title={videoFile?.name}>{videoFile?.name ?? '已上传的视频'}</p>
                <button type="button" onClick={() => videoInputRef.current?.click()} className="mt-4 min-h-10 rounded-full bg-[var(--text-primary)] px-5 text-sm font-medium text-[var(--surface)] hover:bg-[var(--accent-primary-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-primary)]">更换视频</button>
              </> : <>
                <UploadCloud size={58} strokeWidth={1.6} className="text-[var(--text-secondary)]" aria-hidden="true" />
                <h2 className="mt-6 text-lg font-semibold">点击上传或将{mediaLabel}拖入此区域</h2>
                <p className="mt-3 text-sm text-[var(--text-secondary)]">{mediaKind === 'image' ? '支持 JPG、PNG、WebP，最多 9 张，每张最大 5 MB' : '支持 MP4、WebM，最大 100 MB'}</p>
                <button type="button" onClick={() => mediaKind === 'image' ? imageInputRef.current?.click() : videoInputRef.current?.click()} className="mt-8 inline-flex min-h-12 min-w-52 items-center justify-center gap-2 rounded-full bg-[var(--text-primary)] px-7 text-sm font-medium text-[var(--surface)] hover:bg-[var(--accent-primary-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-primary)]">{mediaKind === 'image' ? <ImagePlus size={17} aria-hidden="true" /> : <FileVideo2 size={17} aria-hidden="true" />}上传{mediaLabel}</button>
              </>}
            </div>
          </section>
          {uploadError && <p ref={uploadFeedbackRef} role="alert" className="mt-4 text-sm text-[var(--palette-danger)]">{uploadError}</p>}
          {hasMedia && <div className="pt-8">

            {fromWorkbench && <section aria-label="发布信息完成情况" className="mb-8 rounded-xl border-[0.5px] border-[var(--border-subtle)] px-5 py-4">
              <div className="flex items-center justify-between gap-3"><h3 className="text-sm font-semibold">发布信息</h3><span className="text-xs text-[var(--text-secondary)]">{missingCount ? `还需补全 ${missingCount} 项` : '必填项已完成'}</span></div>
              <div className="mt-3 overflow-x-auto"><table className="w-full border-collapse text-left text-sm"><thead className="text-xs text-[var(--text-secondary)]"><tr><th className="py-2 font-medium">项目</th><th className="py-2 font-medium">状态</th><th className="py-2 text-right font-medium">操作</th></tr></thead><tbody>{[
                { label: mediaLabel, complete: hasMedia, target: 'creator-media' },
                { label: '标题', complete: Boolean(fields.title.trim()), target: 'creator-title' },
                { label: '封面', complete: Boolean(coverUrl), target: 'creator-cover' },
              ].map((row) => <tr key={row.label} className="border-t-[0.5px] border-[var(--border-subtle)]"><td className="py-2.5">{row.label}</td><td className="py-2.5 text-[var(--text-secondary)]">{row.complete ? '已完成' : '待填写'}</td><td className="py-2.5 text-right"><button type="button" onClick={() => document.getElementById(row.target)?.scrollIntoView({ behavior: 'smooth', block: 'center' })} className="text-[var(--accent-primary)] hover:underline focus-visible:outline-2 focus-visible:outline-[var(--brand-primary)]">{row.complete ? '查看' : '填写'}</button></td></tr>)}</tbody></table></div>
            </section>}

            <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_280px] 2xl:grid-cols-[minmax(0,1fr)_340px]">
              <div className="min-w-0 space-y-9">
                <section aria-labelledby="basic-title">
                  <h3 id="basic-title" className="text-lg font-semibold">基础信息</h3>
                  <div className="mt-5 space-y-5">
                    <label id="creator-title" className="block"><span className="mb-2 flex justify-between text-sm font-medium"><span>作品标题 <span className="text-[var(--palette-danger)]">*</span></span><span className="font-normal text-[var(--text-secondary)]">{fields.title.length}/30</span></span><input value={fields.title} maxLength={30} onChange={(event) => update('title', event.target.value)} placeholder="填写作品标题" className="h-12 w-full rounded-lg border-[0.5px] border-[var(--border-subtle)] bg-[var(--surface)] px-4 text-sm outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--brand-primary)]" /></label>
                    <label className="block"><span className="mb-2 flex justify-between text-sm font-medium"><span>{mediaKind === 'image' ? '图文正文' : '作品简介'}</span><span className="font-normal text-[var(--text-secondary)]">{fields.summary.length}/1000</span></span><textarea value={fields.summary} maxLength={1000} onChange={(event) => update('summary', event.target.value)} placeholder={mediaKind === 'image' ? '填写图文内容' : '介绍视频内容'} rows={5} className="w-full resize-y rounded-lg border-[0.5px] border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-3 text-sm outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--brand-primary)]" /></label>
                    <label className="block"><span className="mb-2 block text-sm font-medium">话题</span><input value={fields.topics} onChange={(event) => update('topics', event.target.value)} placeholder="输入话题，用空格分隔" className="h-12 w-full rounded-lg border-[0.5px] border-[var(--border-subtle)] bg-[var(--surface)] px-4 text-sm outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--brand-primary)]" /></label>
                  </div>
                </section>

                <section id="creator-cover" aria-labelledby="cover-title" className="border-t-[0.5px] border-[var(--border-subtle)] pt-7">
                  <div className="flex flex-wrap items-center justify-between gap-3"><h3 id="cover-title" className="text-lg font-semibold">设置封面 <span className="text-[var(--palette-danger)]">*</span></h3><div className="flex flex-wrap gap-2">{mediaKind === 'image' && coverMedia.image && <button type="button" onClick={resetImageCover} className="min-h-11 rounded-full px-4 text-sm hover:bg-[var(--interactive-hover)] focus-visible:outline-2 focus-visible:outline-[var(--brand-primary)]">使用首图</button>}<button type="button" onClick={() => coverInputRef.current?.click()} className="inline-flex min-h-11 items-center gap-2 rounded-full border-[0.5px] border-[var(--border-subtle)] px-4 text-sm hover:bg-[var(--interactive-hover)] focus-visible:outline-2 focus-visible:outline-[var(--brand-primary)]"><ImagePlus size={16} aria-hidden="true" />{coverUrl ? '更换封面' : '选择封面'}</button></div></div>
                  <div className="mt-5 flex flex-wrap items-end gap-5"><CoverSample url={coverUrl} ratio="3 / 4" label="竖版 3:4" className="w-36" /><CoverSample url={coverUrl} ratio="4 / 3" label="横版 4:3" className="w-52" /></div>
                </section>

                <section aria-labelledby="more-title" className="border-t-[0.5px] border-[var(--border-subtle)] pt-7">
                  <h3 id="more-title" className="text-lg font-semibold">更多信息</h3>
                  <div className="mt-5 grid gap-5 sm:grid-cols-2">
                    <label className="block"><span className="mb-2 block text-sm font-medium">合集</span><input value={fields.collection} onChange={(event) => update('collection', event.target.value)} placeholder="不加入合集" className="h-12 w-full rounded-lg border-[0.5px] border-[var(--border-subtle)] bg-[var(--surface)] px-4 text-sm outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--brand-primary)]" /></label>
                    <label className="block"><span className="mb-2 block text-sm font-medium">自主声明</span><select value={fields.declaration} onChange={(event) => update('declaration', event.target.value)} className="h-12 w-full rounded-lg border-[0.5px] border-[var(--border-subtle)] bg-[var(--surface)] px-4 text-sm outline-none focus:border-[var(--brand-primary)]"><option value="">请选择</option><option value="原创">原创</option><option value="转载">转载</option></select></label>
                    <label className="block sm:col-span-2"><span className="mb-2 block text-sm font-medium">位置</span><input value={fields.location} onChange={(event) => update('location', event.target.value)} placeholder="添加地理位置（选填）" className="h-12 w-full rounded-lg border-[0.5px] border-[var(--border-subtle)] bg-[var(--surface)] px-4 text-sm outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--brand-primary)]" /></label>
                  </div>
                </section>

                <section aria-labelledby="settings-title" className="border-t-[0.5px] border-[var(--border-subtle)] pt-7">
                  <h3 id="settings-title" className="text-lg font-semibold">发布设置</h3>
                  <div className="mt-5 space-y-5">
                    <fieldset><legend className="mb-2 text-sm font-medium">谁可以看</legend><div className="flex flex-wrap gap-3">{[{ value: 'public', label: '公开' }, { value: 'private', label: '仅自己可见' }].map((option) => <label key={option.value} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg bg-[var(--surface-muted)] px-4 text-sm"><input type="radio" name="visibility" value={option.value} checked={fields.visibility === option.value} onChange={() => update('visibility', option.value as Visibility)} className="accent-[var(--text-primary)]" />{option.label}</label>)}</div></fieldset>
                    <fieldset><legend className="mb-2 text-sm font-medium">保存权限</legend><div className="flex flex-wrap gap-3">{[{ value: true, label: '允许' }, { value: false, label: '不允许' }].map((option) => <label key={option.label} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg bg-[var(--surface-muted)] px-4 text-sm"><input type="radio" name="allowSave" checked={fields.allowSave === option.value} onChange={() => update('allowSave', option.value)} className="accent-[var(--text-primary)]" />{option.label}</label>)}</div></fieldset>
                    <fieldset><legend className="mb-2 text-sm font-medium">发布时间</legend><div className="flex flex-wrap gap-3">{[{ value: 'now', label: '立即发布' }, { value: 'scheduled', label: '定时发布' }].map((option) => <label key={option.value} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg bg-[var(--surface-muted)] px-4 text-sm"><input type="radio" name="timing" checked={fields.timing === option.value} onChange={() => update('timing', option.value as Timing)} className="accent-[var(--text-primary)]" />{option.label}</label>)}</div>{fields.timing === 'scheduled' && <label className="mt-3 block max-w-xs"><span className="sr-only">选择发布时间</span><input type="datetime-local" value={fields.scheduledAt} onChange={(event) => update('scheduledAt', event.target.value)} className="h-11 w-full rounded-lg border-[0.5px] border-[var(--border-subtle)] bg-[var(--surface)] px-3 text-sm focus-visible:outline-2 focus-visible:outline-[var(--brand-primary)]" /></label>}</fieldset>
                  </div>
                </section>

                <div className="flex flex-wrap items-center gap-3 border-t-[0.5px] border-[var(--border-subtle)] pt-7"><button type="button" disabled={publishing} onClick={checkPublication} className="min-h-12 min-w-40 rounded-full bg-[var(--text-primary)] px-6 text-sm font-medium text-[var(--surface)] hover:bg-[var(--accent-primary-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-primary)]">检查发布信息</button><button type="button" disabled={publishing} onClick={saveDraft} className="min-h-12 rounded-full bg-[var(--surface-muted)] px-6 text-sm hover:bg-[var(--interactive-hover)] focus-visible:outline-2 focus-visible:outline-[var(--brand-primary)]">{publishing ? '保存中…' : previewMode ? '保存本地草稿' : '存草稿'}</button></div>
              </div>

              <aside className="lg:sticky lg:top-6">
                <div className="flex gap-5 border-b-[0.5px] border-[var(--border-subtle)]">
                  <button type="button" onClick={() => setPreviewTab('media')} aria-pressed={previewTab === 'media'} className={`min-h-11 pb-3 text-sm focus-visible:outline-2 focus-visible:outline-[var(--brand-primary)] ${previewTab === 'media' ? 'border-b-2 border-[var(--text-primary)] font-semibold' : 'text-[var(--text-secondary)]'}`}>预览{mediaKind === 'image' ? '图文' : '视频'}</button>
                  <button type="button" onClick={() => setPreviewTab('cover')} aria-pressed={previewTab === 'cover'} className={`min-h-11 pb-3 text-sm focus-visible:outline-2 focus-visible:outline-[var(--brand-primary)] ${previewTab === 'cover' ? 'border-b-2 border-[var(--text-primary)] font-semibold' : 'text-[var(--text-secondary)]'}`}>预览封面和标题</button>
                </div>
                <div className="mx-auto mt-6 w-[min(100%,300px)] rounded-[32px] bg-[var(--text-primary)] p-2">
                  <div className="relative aspect-[9/16] overflow-hidden rounded-[26px] bg-[var(--text-primary)] text-[var(--surface)]">
                    {previewTab === 'media' && mediaKind === 'image' && currentImage ? <Image src={currentImage.url} alt={`图文预览，第 ${currentImageIndex + 1} 张`} fill sizes="300px" unoptimized className="object-contain" /> : previewTab === 'media' && videoUrl ? <video src={videoUrl} controls playsInline preload="metadata" className="h-full w-full object-contain" aria-label="视频预览" /> : previewTab === 'cover' && coverUrl ? <Image src={coverUrl} alt="封面预览" fill sizes="300px" unoptimized className="object-cover" /> : <div className="grid h-full place-items-center text-xs text-[var(--surface)]">选择封面后预览</div>}
                    {previewTab === 'cover' && <div className="absolute inset-x-0 bottom-0 bg-black/70 px-4 py-4 text-sm font-medium">{fields.title || '作品标题'}</div>}
                  </div>
                </div>
                {previewTab === 'media' && mediaKind === 'image' && <>
                  {imageMedia.length > 1 && <div className="mt-3 flex items-center justify-center gap-3"><button type="button" onClick={() => setPreviewImageIndex(currentImageIndex - 1)} disabled={currentImageIndex === 0} aria-label="预览上一张图片" className="grid size-11 place-items-center rounded-full hover:bg-[var(--interactive-hover)] focus-visible:outline-2 focus-visible:outline-[var(--brand-primary)] disabled:opacity-30"><ArrowLeft size={16} aria-hidden="true" /></button><span className="text-xs text-[var(--text-secondary)]">{currentImageIndex + 1} / {imageMedia.length}</span><button type="button" onClick={() => setPreviewImageIndex(currentImageIndex + 1)} disabled={currentImageIndex === imageMedia.length - 1} aria-label="预览下一张图片" className="grid size-11 place-items-center rounded-full hover:bg-[var(--interactive-hover)] focus-visible:outline-2 focus-visible:outline-[var(--brand-primary)] disabled:opacity-30"><ArrowRight size={16} aria-hidden="true" /></button></div>}
                  {(fields.title || fields.summary) && <div className="mt-4 text-sm"><p className="break-words font-semibold">{fields.title}</p><p className="mt-2 whitespace-pre-wrap break-words text-[var(--text-secondary)]">{fields.summary}</p></div>}
                </>}
              </aside>
            </div>
          </div>}
          {(error || status) && <p role={error ? 'alert' : 'status'} className={`mt-5 text-sm ${error ? 'text-[var(--palette-danger)]' : 'text-[var(--text-secondary)]'}`}>{error || status}</p>}
        </div>}
      </div>

      <dialog ref={reviewDialogRef} aria-labelledby="review-title" onClose={() => setReviewOpen(false)} className="fixed inset-0 m-auto max-h-[calc(100dvh_-_32px)] w-[calc(100%_-_32px)] max-w-md overflow-y-auto rounded-2xl bg-[var(--surface)] p-6 text-[var(--text-primary)] backdrop:bg-black/35">
        <div className="flex items-center justify-between"><h2 id="review-title" className="text-lg font-semibold">发布信息预览</h2><button type="button" onClick={() => setReviewOpen(false)} aria-label="关闭发布信息预览" className="grid size-11 place-items-center rounded-full hover:bg-[var(--interactive-hover)] focus-visible:outline-2 focus-visible:outline-[var(--brand-primary)]"><X size={18} aria-hidden="true" /></button></div>
        <dl className="mt-5 grid grid-cols-[88px_minmax(0,1fr)] gap-y-3 text-sm">
          <dt className="text-[var(--text-secondary)]">类型</dt><dd>{mediaKind === 'image' ? '图文' : '视频'}</dd>
          <dt className="text-[var(--text-secondary)]">{mediaLabel}</dt><dd className="truncate">{mediaKind === 'image' ? `${imageMedia.length} 张图片` : videoFile?.name}</dd>
          <dt className="text-[var(--text-secondary)]">标题</dt><dd className="break-words">{fields.title}</dd>
          <dt className="text-[var(--text-secondary)]">可见范围</dt><dd>{{ public: '公开', friends: '好友可见', private: '仅自己可见' }[fields.visibility]}</dd>
          <dt className="text-[var(--text-secondary)]">发布时间</dt><dd>{fields.timing === 'now' ? '立即发布' : fields.scheduledAt.replace('T', ' ')}</dd>
        </dl>
        {previewMode && <p className="mt-6 text-xs text-[var(--text-secondary)]">内容将保存到本机，并记录在内容管理中。</p>}
        {publicationError && <p role="alert" className="mt-3 text-sm text-[var(--palette-danger)]">{publicationError}</p>}
        <button type="button" onClick={() => setReviewOpen(false)} className="mt-5 min-h-11 w-full rounded-full bg-[var(--text-primary)] px-5 text-sm text-[var(--surface)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-primary)]">返回编辑</button>
        <button type="button" disabled={publishing} onClick={() => { void publishMedia() }} className="mt-3 min-h-11 w-full rounded-full bg-[var(--text-primary)] px-5 text-sm text-[var(--surface)]">{publishing ? '保存中…' : fields.timing === 'scheduled' ? previewMode ? '保存定时预览' : '定时发布' : previewMode ? '发布到本机预览' : '确认发布'}</button>
      </dialog>
    </div>
  )
}

function CoverSample({ url, ratio, label, className }: { url: string; ratio: string; label: string; className: string }) {
  return <div className={className}><div className="relative grid w-full place-items-center overflow-hidden rounded-lg bg-[var(--surface-muted)] text-[var(--text-muted)]" style={{ aspectRatio: ratio }}>{url ? <Image src={url} alt="" fill sizes="208px" unoptimized className="object-cover" /> : <ImagePlus size={24} aria-hidden="true" />}</div><p className="mt-2 text-center text-xs text-[var(--text-secondary)]">{label}</p></div>
}
