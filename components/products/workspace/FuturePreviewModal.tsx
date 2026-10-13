'use client'

import React from 'react'
import { Sparkles, X } from 'lucide-react'
import { useLanguage } from '@/context/LanguageContext'

interface FuturePreviewModalProps {
  isOpen: boolean
  title?: string
  onClose: () => void
}

export function FuturePreviewModal({ isOpen, title, onClose }: FuturePreviewModalProps) {
  const { isZh } = useLanguage()

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--surface-muted)]/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-[var(--surface)] rounded-2xl border border-[var(--surface-muted)] shadow-xl max-w-md w-full p-6 space-y-4 relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1 text-[var(--lavender)] hover:text-[var(--lavender)]  transition-colors cursor-pointer"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 border border-[var(--primary)] flex items-center justify-center text-[var(--primary)]">
            <Sparkles size={20} className="text-[var(--primary)]" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[var(--lavender)]">
              {title || (isZh ? '功能预览 (Feature Preview)' : 'Feature Preview')}
            </h3>
            <span className="inline-block px-2 py-0.5  bg-[var(--primary)] text-[var(--primary)] text-[10px] font-bold border border-[var(--primary)] mt-0.5">
              {isZh ? '即将支持' : 'Coming Soon'}
            </span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-[var(--surface-muted)] border border-[var(--surface-muted)] text-xs text-[var(--lavender)] space-y-1">
          <p className="font-semibold text-[var(--lavender)]">
            {isZh ? '该能力将在后续版本开放' : 'This feature will be available in a future version.'}
          </p>
          <p className="text-[11px] text-[var(--lavender)]">
            {isZh
              ? 'OmniLink 智能架构正持续迭代，AI 商品智能与全域检索分析功能正在就绪中。敬请期待！'
              : 'OmniLink intelligence features are currently being rolled out. Stay tuned for full release!'}
          </p>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5  bg-[var(--surface)] border border-[var(--border)] text-[var(--ink)] text-xs font-medium hover:bg-[var(--surface-muted)] hover:border-[var(--border)] transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--primary)] focus-visible:outline-offset-2"
          >
            {isZh ? '我知道了' : 'Got it'}
          </button>
        </div>
      </div>
    </div>
  )
}
