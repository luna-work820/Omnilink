'use client'

import React, { useState, useRef } from 'react'
import { Upload, X, Image as ImageIcon } from 'lucide-react'

interface StoreAvatarUploadProps {
  value: string
  onChange: (url: string) => void
}

export function StoreAvatarUpload({ value, onChange }: StoreAvatarUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('请上传图片格式文件 (PNG, JPG, SVG, WEBP)')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('图片大小不能超过 5MB')
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      const result = e.target?.result as string
      onChange(result)
    }
    reader.readAsDataURL(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0])
    }
  }

  return (
    <div className="space-y-3.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-[var(--ink)] flex items-center gap-1.5">
          <span>店铺头像 / 品牌 Logo</span>
        </label>
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="text-[11px] text-[var(--plum)] hover:underline flex items-center gap-0.5 cursor-pointer"
          >
            <X size={12} />
            <span>重置头像</span>
          </button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row items-stretch gap-4">
        {/* 上传区域 */}
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`flex-1 border-2 border-dashed rounded-2xl p-4 flex items-center gap-4 transition-all cursor-pointer select-none ${
            isDragging
              ? 'border-[var(--plum)] bg-[var(--plum)]/50 scale-[1.01]'
              : 'border-[var(--surface-muted)] hover:border-[var(--plum)] hover:bg-[var(--surface-muted)]/60 bg-[var(--surface)]'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/svg+xml,image/webp"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.[0]) handleFile(e.target.files[0])
            }}
          />

          {/* 头像预览框 */}
          <div className="relative w-16 h-16 rounded-2xl overflow-hidden bg-[var(--surface-muted)] border border-[var(--surface-muted)] flex-shrink-0 flex items-center justify-center shadow-xs">
            {value ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={value} alt="Store Avatar Preview" className="w-full h-full object-cover" />
            ) : (
              <ImageIcon className="text-[var(--lavender)]" size={24} />
            )}
          </div>

          {/* 上传文字提示 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--ink)]">
              <Upload size={14} className="text-[var(--plum)]" />
              <span>{value ? '点击更换头像图片' : '拖拽图片或点击上传'}</span>
            </div>
            <p className="text-[11px] text-[var(--lavender)] mt-0.5 leading-tight">
              支持 PNG、JPG、SVG、WEBP，建议尺寸 500x500 像素以上
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
