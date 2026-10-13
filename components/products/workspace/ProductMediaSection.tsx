'use client'

import React, { RefObject } from 'react'
import { useLanguage } from '@/context/LanguageContext'
import {
  ProductMediaUploader,
  ProductMediaUploaderRef,
  ExistingAsset,
} from '@/components/products/ProductMediaUploader'

interface ProductMediaSectionProps {
  productId?: string
  existingAssets?: ExistingAsset[]
  mediaUploaderRef: RefObject<ProductMediaUploaderRef | null>
  onFilesChange?: (files: File[]) => void
  onUploadSuccess?: () => void
}

export function ProductMediaSection({
  productId,
  existingAssets = [],
  mediaUploaderRef,
  onFilesChange,
  onUploadSuccess,
}: ProductMediaSectionProps) {
  const { isZh } = useLanguage()

  return (
    <div className="space-y-4 border-b border-[var(--border)] pb-8 pt-2">
      <ProductMediaUploader
        ref={mediaUploaderRef}
        productId={productId}
        existingAssets={existingAssets}
        onFilesChange={onFilesChange}
        onUploadSuccess={onUploadSuccess}
        isZh={isZh}
      />
    </div>
  )
}
