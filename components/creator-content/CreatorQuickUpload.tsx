'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileVideo2, Image as ImageIcon, Upload, X } from 'lucide-react'
import { isCreatorImage, isCreatorVideo, MAX_CREATOR_VIDEO_BYTES, stageCreatorUpload, validateCreatorImages } from '@/lib/creator-preview-upload'

export function CreatorQuickUpload({ destination, onDismiss }: { destination: string; onDismiss: () => void }) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<File[]>([])
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState('')
  const file = files[0]
  const detected = file ? isCreatorVideo(file) ? 'video' : 'image' : null

  function inspect(next: File[]) {
    setDragging(false)
    if (!next.length) return
    if (next.some((item) => !isCreatorVideo(item) && !isCreatorImage(item))) {
      setFiles([])
      setError('请选择 MP4、WebM、JPG、PNG 或 WebP 文件。')
      return
    }
    const videos = next.filter(isCreatorVideo)
    if (videos.length && next.length > 1) {
      setFiles([])
      setError('每次请选择一个视频或一组图片。')
      return
    }
    if (videos[0]?.size > MAX_CREATOR_VIDEO_BYTES) {
      setFiles([])
      setError('视频不能超过 100 MB。')
      return
    }
    const imageError = videos.length ? null : validateCreatorImages(next)
    if (imageError) {
      setFiles([])
      setError(imageError)
      return
    }
    setError('')
    setFiles(next)
  }

  return (
    <div className="relative mt-7 w-full text-left">
      <button type="button" onClick={onDismiss} aria-label="关闭素材上传提示" title="不再显示" className="workbench-upload-dismiss absolute right-2 top-2 z-10 grid size-8 place-items-center rounded-full text-[var(--text-secondary)] hover:bg-[var(--interactive-hover)] focus-visible:outline-2 focus-visible:outline-[var(--accent-secondary)]"><X size={16} aria-hidden="true" /></button>
      <input ref={inputRef} type="file" multiple accept="video/mp4,video/webm,image/jpeg,image/png,image/webp" className="hidden" aria-label="选择创作素材" onChange={(event) => { inspect(Array.from(event.target.files ?? [])); event.target.value = '' }} />
      <div
        data-glasswork=""
        data-glasswork-radius="16"
        data-glasswork-rim="12"
        data-glasswork-dispersion="0.18"
        data-glasswork-tint="1.15"
        onDragOver={(event) => { event.preventDefault(); setDragging(true) }}
        onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false) }}
        onDrop={(event) => { event.preventDefault(); inspect(Array.from(event.dataTransfer.files)) }}
        className={`workbench-upload-surface flex min-h-24 flex-col justify-center gap-3 rounded-2xl border-[0.5px] py-4 pl-5 pr-12 sm:flex-row sm:items-center sm:justify-between ${dragging ? 'is-dragging border-[var(--accent-secondary)]' : 'border-[var(--border-subtle)]'}`}
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="workbench-upload-icon grid size-10 shrink-0 place-items-center rounded-full text-[var(--text-primary)]"><Upload size={19} aria-hidden="true" /></span>
          <span className="min-w-0"><strong className="block text-sm font-semibold">拖入素材开始创作</strong><span className="mt-1 block text-xs text-[var(--text-secondary)]">识别类型后确认，再填写发布信息</span></span>
        </div>
        <button type="button" onClick={() => inputRef.current?.click()} className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-full bg-[var(--text-primary)] px-5 text-sm font-medium text-[var(--surface)] hover:bg-[var(--accent-primary-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-secondary)]">选择素材</button>
      </div>
      {file && <div data-glasswork="" data-glasswork-radius="16" data-glasswork-rim="12" data-glasswork-dispersion="0.18" className="workbench-upload-file mt-3 flex flex-wrap items-center gap-3 rounded-2xl border-[0.5px] border-[var(--border-subtle)] px-4 py-3 text-sm">
        {detected === 'video' ? <FileVideo2 size={18} aria-hidden="true" /> : <ImageIcon size={18} aria-hidden="true" />}
        <span className="min-w-0 flex-1 truncate" title={files.map((item) => item.name).join('、')}>{files.length > 1 ? `${file.name} 等 ${files.length} 张图片` : file.name}</span>
        <span className="text-xs text-[var(--text-secondary)]">检测为{detected === 'video' ? '视频' : '图文'}</span>
        <button type="button" onClick={() => { stageCreatorUpload(detected === 'video' ? { kind: 'video', file } : { kind: 'image', files }); router.push(destination) }} className="min-h-11 rounded-full bg-[var(--text-primary)] px-4 text-xs font-medium text-[var(--surface)] hover:bg-[var(--accent-primary-hover)] focus-visible:outline-2 focus-visible:outline-[var(--accent-secondary)]">确认{detected === 'video' ? '视频' : '图文'}</button>
        <button type="button" onClick={() => setFiles([])} className="grid size-8 place-items-center rounded-full hover:bg-[var(--interactive-hover)] focus-visible:outline-2 focus-visible:outline-[var(--accent-secondary)]" aria-label="移除素材"><X size={16} aria-hidden="true" /></button>
      </div>}
      {error && <p role="alert" className="mt-2 text-xs text-[var(--palette-danger)]">{error}</p>}
    </div>
  )
}
