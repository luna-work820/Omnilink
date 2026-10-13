'use client'

import React from 'react'
import { useLanguage } from '@/context/LanguageContext'

interface ProductCommercialSectionProps {
  price: string | number
  setPrice: (val: string | number) => void
  currency: string
  setCurrency: (val: string) => void
  inventory: string | number
  setInventory: (val: string | number) => void
  status?: 'active' | 'draft' | 'archived'
  setStatus?: (val: 'active' | 'draft' | 'archived') => void
  disabled?: boolean
}

export function ProductCommercialSection({
  price,
  setPrice,
  currency = 'CNY',
  inventory,
  setInventory,
  status = 'active',
  setStatus,
  disabled = false,
}: ProductCommercialSectionProps) {
  const { isZh } = useLanguage()
  const isUSD = currency === 'USD'
  const symbol = isUSD ? '$' : '¥'

  return (
    <div className="space-y-5 border-b border-[var(--border)] pb-8 pt-2">
      <div className="flex items-center justify-between pb-3 border-b border-[var(--surface-muted)]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8  bg-[var(--primary)] text-[var(--primary)] flex items-center justify-center font-mono font-bold text-xs">
            03
          </div>
          <div>
            <h2 className="text-sm font-bold text-[var(--lavender)]">
              {isZh ? '商业定价与库存' : 'Commercial'}
            </h2>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Price */}
        <div>
          <label htmlFor="workspace-price" className="block text-xs font-semibold text-[var(--lavender)] mb-1.5">
            {isZh ? '基础售价 *' : 'Price *'}
          </label>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--lavender)] font-bold text-xs">
              {symbol}
            </span>
            <input
              id="workspace-price"
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
              min="0"
              step="0.01"
              placeholder="0.00"
              disabled={disabled}
              className="w-full h-10 pl-8 pr-3.5 rounded-xl bg-[var(--surface-muted)] border border-[var(--surface-muted)] text-xs font-bold text-[var(--lavender)] focus:outline-none focus:ring-2 focus:ring-[var(--lavender)]/20 focus:border-[var(--lavender)] disabled:opacity-50 transition-all"
            />
          </div>
        </div>

        {/* Inventory */}
        <div>
          <label htmlFor="workspace-inventory" className="block text-xs font-semibold text-[var(--lavender)] mb-1.5">
            {isZh ? '库存' : 'Inventory'}
          </label>
          <input
            id="workspace-inventory"
            type="number"
            value={inventory}
            onChange={(e) => setInventory(e.target.value)}
            min="0"
            step="1"
            placeholder="100"
            disabled={disabled}
            className="w-full h-10 px-3.5 rounded-xl bg-[var(--surface-muted)] border border-[var(--surface-muted)] text-xs font-bold text-[var(--lavender)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] disabled:opacity-50 transition-all"
          />
        </div>

        {/* Product Sales Status */}
        <div>
          <label htmlFor="workspace-status" className="block text-xs font-semibold text-[var(--lavender)] mb-1.5">
            {isZh ? '商品状态' : 'Product Status'}
          </label>
          <select
            id="workspace-status"
            value={status}
            onChange={(e) => setStatus && setStatus(e.target.value as 'active' | 'draft' | 'archived')}
            disabled={disabled}
            className="w-full h-10 px-3 rounded-xl bg-[var(--surface-muted)] border border-[var(--surface-muted)] text-xs font-bold text-[var(--lavender)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] disabled:opacity-50 transition-all cursor-pointer"
          >
            <option value="active">{isZh ? '已上架' : 'Active'}</option>
            <option value="draft">{isZh ? '草稿箱' : 'Draft'}</option>
            <option value="archived">{isZh ? '已归档' : 'Archived'}</option>
          </select>
        </div>
      </div>
    </div>
  )
}
