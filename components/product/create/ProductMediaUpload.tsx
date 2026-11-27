'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import { Check, Plus, Star, UploadCloud, X } from 'lucide-react'
import { useLanguage } from '@/context/LanguageContext'
import type { ImageFileItem } from './types'

interface ProductMediaUploadProps {
  images: ImageFileItem[]
  onChange: (images: ImageFileItem[]) => void
  disabled?: boolean
  maxImages?: number
}

export function ProductMediaUpload({ images, onChange, disabled = false, maxImages = 8 }: ProductMediaUploadProps) {
  const { isZh } = useLanguage()
  const [previewIndex, setPreviewIndex] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const activeIndex = Math.min(previewIndex, Math.max(0, images.length - 1))
  const activeImage = images[activeIndex]
  const accept = 'image/png,image/jpeg,image/webp,image/jpg'

  const handleSelectFiles = (files: FileList | null) => {
    if (!files?.length) return
    const remainingSlots = maxImages - images.length
    if (remainingSlots <= 0) return
    const incoming = Array.from(files).slice(0, remainingSlots)
    const valid = incoming.filter((file) => file.type.startsWith('image/') && file.size <= 10 * 1024 * 1024)
    const newItems: ImageFileItem[] = valid.map((file) => ({ file, previewUrl: URL.createObjectURL(file) }))
    if (images.length === 0 && newItems.length > 0) setPreviewIndex(0)
    onChange([...images, ...newItems])
  }

  const onInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    handleSelectFiles(event.currentTarget.files)
    event.currentTarget.value = ''
  }

  const onDrop = (event: React.DragEvent<HTMLElement>) => {
    event.preventDefault()
    setIsDragging(false)
    if (!disabled) handleSelectFiles(event.dataTransfer.files)
  }

  const handleRemoveImage = (index: number) => {
    const target = images[index]
    if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl)
    setPreviewIndex((current) => current === index ? Math.max(0, index - 1) : current > index ? current - 1 : current)
    onChange(images.filter((_, idx) => idx !== index))
  }

  const coverLabel = isZh ? '主图' : 'Cover image'
  const addLabel = isZh ? '添加图片' : 'Add image'

  return (
    <div className="min-w-0 space-y-3">
      {activeImage ? (
        <div
          onDragEnter={(event) => { event.preventDefault(); if (!disabled) setIsDragging(true) }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={(event) => { const target = event.relatedTarget; if (!(target instanceof Node) || !event.currentTarget.contains(target)) setIsDragging(false) }}
          onDrop={onDrop}
          className={`group relative h-[clamp(18rem,54vh,32.5rem)] min-h-[280px] overflow-hidden rounded-[var(--radius-card)] border bg-[var(--surface-muted)] transition-colors ${isDragging ? 'border-[var(--brand-primary)]' : 'border-[var(--border-subtle)]'}`}
        >
          <Image
            src={activeImage.previewUrl}
            alt={activeImage.file.name || (isZh ? `商品图片 ${activeIndex + 1}` : `Product image ${activeIndex + 1}`)}
            fill
            className="object-contain"
            referrerPolicy="no-referrer"
            unoptimized
            priority
          />
          {!disabled && (
            <button
              type="button"
              onClick={() => handleRemoveImage(activeIndex)}
              className="ui-interactive absolute right-3 top-3 grid size-10 place-items-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface)]/90 text-[var(--text-secondary)] opacity-100 shadow-sm transition-opacity hover:text-[var(--text-primary)] focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
              title={isZh ? '移除图片' : 'Remove image'}
              aria-label={isZh ? `移除图片 ${activeIndex + 1}` : `Remove image ${activeIndex + 1}`}
            >
              <X size={17} aria-hidden="true" />
            </button>
          )}
        </div>
      ) : (
        <label
          onDragEnter={(event) => { event.preventDefault(); if (!disabled) setIsDragging(true) }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={(event) => { const target = event.relatedTarget; if (!(target instanceof Node) || !event.currentTarget.contains(target)) setIsDragging(false) }}
          onDrop={onDrop}
          className={`relative flex h-[clamp(18rem,54vh,32.5rem)] min-h-[280px] cursor-pointer items-center justify-center overflow-hidden rounded-[var(--radius-card)] border border-dashed bg-[var(--surface-muted)] transition-colors focus-within:ring-2 focus-within:ring-[var(--brand-primary)]/25 ${isDragging ? 'border-[var(--brand-primary)] bg-[var(--accent-primary-soft)]' : 'border-[var(--border-subtle)] hover:border-[var(--interactive-hover)]' } ${disabled ? 'pointer-events-none opacity-50' : ''}`}
        >
          <input type="file" accept={accept} multiple className="sr-only" aria-label={addLabel} disabled={disabled} onChange={onInputChange} />
          <UploadCloud size={32} strokeWidth={1.6} className="text-[var(--accent-primary)]" aria-hidden="true" />
        </label>
      )}

      {images.length > 0 && (
        <div className="flex min-w-0 items-center gap-2 overflow-x-auto pb-1" role="group" aria-label={isZh ? '商品图片' : 'Product images'}>
          {images.map((item, index) => (
            <div key={item.previewUrl} className="group/thumb relative size-[76px] shrink-0">
              <button
                type="button"
                onClick={() => setPreviewIndex(index)}
                aria-label={isZh ? `预览图片 ${index + 1}` : `Preview image ${index + 1}`}
                aria-pressed={activeIndex === index}
                className={`ui-interactive relative size-full overflow-hidden rounded-[var(--radius-card-nested)] border bg-[var(--surface-muted)] ${activeIndex === index ? 'border-[var(--brand-primary)] ring-2 ring-[var(--brand-primary)]/20' : 'border-[var(--border-subtle)]'}`}
              >
                <Image src={item.previewUrl} alt="" fill className="object-cover" referrerPolicy="no-referrer" unoptimized />
                {index === 0 && (
                  <span title={coverLabel} className="absolute left-1 top-1 grid size-5 place-items-center rounded-full bg-[var(--surface)]/95 text-[var(--accent-primary)] shadow-sm">
                    <Star size={11} fill="currentColor" aria-hidden="true" />
                  </span>
                )}
                {activeIndex === index && (
                  <span className="absolute bottom-1 right-1 grid size-5 place-items-center rounded-full bg-[var(--accent-secondary)] text-[var(--accent-secondary-foreground)]">
                    <Check size={12} aria-hidden="true" />
                  </span>
                )}
              </button>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => handleRemoveImage(index)}
                  aria-label={isZh ? `移除图片 ${index + 1}` : `Remove image ${index + 1}`}
                  className="ui-interactive absolute -right-1 -top-1 grid size-6 place-items-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-secondary)] shadow-sm opacity-100 transition-opacity focus-visible:opacity-100 sm:opacity-0 sm:group-hover/thumb:opacity-100"
                >
                  <X size={12} aria-hidden="true" />
                </button>
              )}
            </div>
          ))}

          {images.length < maxImages && (
            <label
              onDragOver={(event) => event.preventDefault()}
              onDrop={onDrop}
              className={`relative grid size-[76px] shrink-0 cursor-pointer place-items-center overflow-hidden rounded-[var(--radius-card-nested)] border border-dashed border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--accent-primary)] transition-colors hover:border-[var(--interactive-hover)] hover:bg-[var(--accent-primary-soft)] focus-within:ring-2 focus-within:ring-[var(--brand-primary)]/25 ${disabled ? 'pointer-events-none opacity-50' : ''}`}
            >
              <input type="file" accept={accept} multiple className="sr-only" aria-label={addLabel} disabled={disabled} onChange={onInputChange} />
              <Plus size={22} aria-hidden="true" />
            </label>
          )}
        </div>
      )}
    </div>
  )
}
