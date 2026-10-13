'use client'

import React from 'react'
import { Loader2 } from 'lucide-react'
import { useLanguage } from '@/context/LanguageContext'
import { UiverseButton } from '@/components/ui/UiverseButton'

interface ProductCreateFooterProps {
  onSaveDraft: () => void
  onSaveAndPublish: () => void
  isSubmitting: boolean
  submitMode: 'draft' | 'active' | null
  disabled?: boolean
}

export function ProductCreateFooter({
  onSaveDraft,
  onSaveAndPublish,
  isSubmitting,
  submitMode,
  disabled = false,
}: ProductCreateFooterProps) {
  const { isZh } = useLanguage()

  return (
    <div className="pointer-events-auto flex justify-end">
      <div className="flex items-center gap-3 rounded-full bg-[var(--surface)]/90 p-1.5 shadow-xl ring-1 ring-[var(--surface-muted)] backdrop-blur-sm">
        <button
          type="button"
          onClick={onSaveDraft}
          disabled={disabled || isSubmitting}
          className="ui-secondary flex h-11 flex-1 items-center justify-center gap-1.5 px-5 text-xs font-bold sm:flex-none"
        >
          {isSubmitting && submitMode === 'draft' && (
            <Loader2 size={13} className="animate-spin text-[var(--ink)]" />
          )}
          <span>{isSubmitting && submitMode === 'draft' ? (isZh ? '保存中...' : 'Saving...') : (isZh ? '保存草稿' : 'Save Draft')}</span>
        </button>

        <UiverseButton
          type="button"
          onClick={onSaveAndPublish}
          disabled={disabled || isSubmitting}
          className="h-11 flex-1 text-xs sm:flex-none"
        >
          {isSubmitting && submitMode === 'active' && (
            <Loader2 size={13} className="animate-spin text-[var(--surface)]" />
          )}
          <span>{isSubmitting && submitMode === 'active' ? (isZh ? '上架中...' : 'Publishing...') : (isZh ? '保存并上架' : 'Save & Publish')}</span>
        </UiverseButton>
      </div>
    </div>
  )
}
