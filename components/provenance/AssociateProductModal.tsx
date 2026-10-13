'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import { X, PackagePlus, Check } from 'lucide-react'
import { AssociatedProduct } from './types'
import { AVAILABLE_CATALOG_PRODUCTS } from './mockData'

interface AssociateProductModalProps {
  isOpen: boolean
  onClose: () => void
  alreadyAssociatedIds: string[]
  onAssociate: (product: AssociatedProduct) => void
}

export function AssociateProductModal({
  isOpen,
  onClose,
  alreadyAssociatedIds,
  onAssociate,
}: AssociateProductModalProps) {
  const [selectedProd, setSelectedProd] = useState<AssociatedProduct | null>(null)

  if (!isOpen) return null

  const availableProducts = AVAILABLE_CATALOG_PRODUCTS.filter(
    (p) => !alreadyAssociatedIds.includes(p.id)
  )

  const handleConfirm = () => {
    if (selectedProd) {
      onAssociate(selectedProd)
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--surface-muted)]/60 backdrop-blur-xs transition-opacity">
      <div
        className="w-full max-w-lg bg-[var(--surface)] dark:bg-[var(--surface-muted)] rounded-[8px] shadow-2xl border border-[var(--surface-muted)] dark:border-[var(--surface-muted)] overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-[var(--surface-muted)] dark:border-[var(--surface-muted)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PackagePlus size={16} className="text-[var(--primary)]" />
            <h3 className="text-sm font-bold text-[var(--lavender)] dark:text-[var(--surface)]">
              关联已有商品
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-6 h-6 rounded-[3px] flex items-center justify-center text-[var(--lavender)] hover:text-[var(--lavender)] hover:bg-[var(--surface-muted)] dark:hover:bg-[var(--surface-muted)] transition-colors cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-3 flex-1 text-xs">
          <p className="text-[var(--lavender)]">
            选择店铺中已有商品建立出处映射关系：
          </p>

          {availableProducts.length === 0 ? (
            <div className="text-center py-8 text-[var(--lavender)]">
              店铺中的全部可用商品均已建立关联。
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {availableProducts.map((p) => {
                const isSelected = selectedProd?.id === p.id
                return (
                  <div
                    key={p.id}
                    onClick={() => setSelectedProd(p)}
                    className={`p-3  border flex items-center justify-between cursor-pointer transition-all ${
                      isSelected
                        ? 'border-[var(--primary)] bg-[var(--primary)]/40 dark:bg-[var(--primary)]/30 ring-1 ring-[var(--primary)]'
                        : 'border-[var(--surface-muted)] dark:border-[var(--surface-muted)] hover:bg-[var(--surface-muted)] dark:hover:bg-[var(--surface-muted)]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-[3px] overflow-hidden relative shrink-0 border border-[var(--surface-muted)] dark:border-[var(--surface-muted)]">
                        <Image
                          src={p.image}
                          alt={p.name}
                          fill
                          className="object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div>
                        <div className="font-semibold text-[var(--lavender)] dark:text-[var(--surface)]">
                          {p.name}
                        </div>
                        <div className="text-[10px] text-[var(--lavender)] font-mono">
                          SKU: {p.sku} · ¥{p.price}
                        </div>
                      </div>
                    </div>

                    {isSelected && (
                      <div className="w-5 h-5 rounded-full bg-[var(--primary)] text-[var(--surface)] flex items-center justify-center">
                        <Check size={12} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-[var(--surface-muted)] dark:border-[var(--surface-muted)] flex justify-end gap-2 bg-[var(--surface-muted)]/50 dark:bg-[var(--surface-muted)]/50">
          <button
            type="button"
            onClick={onClose}
            className="h-8 px-3  bg-[var(--surface)] dark:bg-[var(--surface-muted)] border border-[var(--surface-muted)] dark:border-[var(--surface-muted)] text-xs text-[var(--lavender)] dark:text-[var(--lavender)] hover:bg-[var(--surface-muted)] cursor-pointer"
          >
            取消
          </button>
          <button
            type="button"
            disabled={!selectedProd}
            onClick={handleConfirm}
            className="h-8 px-4  bg-[var(--primary)] hover:bg-[var(--primary)] active:bg-[var(--primary)] disabled:bg-[var(--surface-muted)] disabled:text-[var(--lavender)] disabled:cursor-not-allowed text-[var(--surface)] text-xs font-semibold transition-all cursor-pointer"
          >
            建立关联
          </button>
        </div>
      </div>
    </div>
  )
}
