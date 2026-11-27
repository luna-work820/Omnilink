'use client'

import React from 'react'
import { Loader2, LockKeyhole } from 'lucide-react'
import { useLanguage } from '@/context/LanguageContext'

interface ProductCreateFooterProps {
  onSaveDraft: () => void
  onSaveAndPublish: () => void
  isSubmitting: boolean
  submitMode: 'draft' | 'active' | null
  disabled?: boolean
  publishDisabled?: boolean
  publishDisabledReason?: string
}

export function ProductCreateFooter({
  onSaveDraft,
  onSaveAndPublish,
  isSubmitting,
  submitMode,
  disabled = false,
  publishDisabled = false,
  publishDisabledReason,
}: ProductCreateFooterProps) {
  const { isZh } = useLanguage()
  const draftSaving = isSubmitting && submitMode === 'draft'
  const publishing = isSubmitting && submitMode === 'active'
  const publishUnavailableLabel = publishDisabledReason || (isZh ? '虚拟商品交付未接入，暂不能上架' : 'Virtual product delivery is not connected, so publishing is unavailable')

  return (
    <div className="grid grid-cols-2 gap-3">
      <button
        type="button"
        onClick={onSaveDraft}
        disabled={disabled || isSubmitting}
        aria-label={draftSaving ? (isZh ? '正在保存草稿' : 'Saving draft') : (isZh ? '保存草稿' : 'Save draft')}
        className="ui-interactive flex h-12 items-center justify-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface)] px-4 text-sm font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-muted)] disabled:opacity-50"
      >
        {draftSaving && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
        <span>{isZh ? '存稿' : 'Draft'}</span>
      </button>

      <button
        type="button"
        onClick={onSaveAndPublish}
        disabled={disabled || isSubmitting || publishDisabled}
        title={publishDisabled ? publishUnavailableLabel : undefined}
        aria-label={publishDisabled ? publishUnavailableLabel : publishing ? (isZh ? '正在上架' : 'Publishing') : (isZh ? '保存并上架' : 'Save and publish')}
        className="ui-interactive flex h-12 items-center justify-center gap-2 rounded-full bg-[var(--accent-primary)] px-4 text-sm font-semibold text-[var(--accent-primary-foreground)] transition-colors hover:bg-[var(--interactive-hover)] hover:text-[var(--neutral-ink)] disabled:bg-[var(--surface-muted)] disabled:text-[var(--text-muted)]"
      >
        {publishDisabled ? <LockKeyhole size={15} aria-hidden="true" /> : publishing ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : null}
        <span>{isZh ? '上架' : 'Publish'}</span>
      </button>
    </div>
  )
}
