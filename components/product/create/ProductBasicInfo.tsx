'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useLanguage } from '@/context/LanguageContext'
import { CategorySelector } from '@/components/product/CategorySelector'
import type { BasicProductFormData } from './types'
import { KNOWLEDGE_FILES_UPDATED_EVENT, readStoredKnowledgeFiles } from '@/lib/knowledge/local-files'

interface ProductBasicInfoProps {
  formData: BasicProductFormData
  onChange: (updates: Partial<BasicProductFormData>) => void
  onCategoryChange?: (category: string, categoryId: string | null) => void
  knowledgeProductId?: string
  disabled?: boolean
  isDigital?: boolean
  minimal?: boolean
  priceMode?: 'amount' | 'inquiry' | 'free'
  onPriceModeChange?: (mode: 'amount' | 'inquiry' | 'free') => void
  hideInventory?: boolean
  mediaRow?: boolean
  hideCategory?: boolean
  nameLabel?: string
}

const inputClass = 'h-11 w-full rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface)] px-3.5 text-sm text-[var(--text-primary)] shadow-sm transition-colors placeholder:text-[var(--text-muted)] focus-visible:border-[var(--brand-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)]/15 disabled:opacity-50'

export function ProductBasicInfo({ formData, onChange, onCategoryChange, onPriceModeChange, knowledgeProductId, disabled = false, isDigital = false, minimal = false, priceMode = 'amount', hideInventory = false, mediaRow = false, hideCategory = false, nameLabel }: ProductBasicInfoProps) {
  const { isZh } = useLanguage()
  const [knowledgeFiles, setKnowledgeFiles] = useState(() => readStoredKnowledgeFiles())

  useEffect(() => {
    const sync = () => setKnowledgeFiles(readStoredKnowledgeFiles())
    window.addEventListener(KNOWLEDGE_FILES_UPDATED_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(KNOWLEDGE_FILES_UPDATED_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  const originOptions = useMemo(() => {
    const source = knowledgeProductId
      ? knowledgeFiles.filter((file) => file.linkedProducts?.some((product) => product.id === knowledgeProductId))
      : knowledgeFiles
    const values = source.flatMap((file) => {
      const parsed = file.parsedJson as Record<string, unknown>
      const candidates = [parsed.origin, parsed.origin_country, parsed.country_of_origin, parsed['产地']]
      const markdownMatch = file.markdown.match(/(?:产地|原产地|country\s+of\s+origin)\s*[:：]\s*([^\n]+)/i)
      return [...candidates, markdownMatch?.[1]].filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    })
    return Array.from(new Set(values.map((value) => value.trim()))).slice(0, 12)
  }, [knowledgeFiles, knowledgeProductId])

  const filteredOrigins = originOptions.filter((value) => value.toLowerCase().includes(formData.origin.trim().toLowerCase()))

  if (minimal) {
    if (mediaRow) {
      return (
        <section className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <FieldLabel htmlFor="create-product-name" label={nameLabel || (isZh ? '商品名称' : 'Product name')} required minimal />
            <input id="create-product-name" type="text" value={formData.title} onChange={(e) => onChange({ title: e.target.value })} disabled={disabled} className={`${inputClass} font-medium`} />
          </div>
          {!hideCategory && <div className="space-y-1.5">
            <FieldLabel htmlFor="create-product-category" label={isZh ? '分类' : 'Category'} />
            <CategorySelector id="create-product-category" value={formData.categoryId || formData.category} onChange={(res) => { onChange({ category: res.categoryName, categoryId: res.categoryId || null }); onCategoryChange?.(res.categoryName, res.categoryId || null) }} onClear={() => { onChange({ category: '', categoryId: null }); onCategoryChange?.('', null) }} disabled={disabled} placeholder={isZh ? '选择' : 'Select'} />
          </div>}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2"><FieldLabel htmlFor="create-product-price" label={isZh ? '价格' : 'Price'} required={priceMode === 'amount'} minimal /><select aria-label={isZh ? '价格方式' : 'Price type'} value={priceMode} onChange={(event) => onPriceModeChange?.(event.target.value as 'amount' | 'inquiry' | 'free')} disabled={disabled} className="h-7 max-w-24 rounded-md border border-[var(--border)] bg-transparent px-1.5 text-[11px] text-[var(--text-secondary)] focus-visible:outline-2 focus-visible:outline-[var(--brand-primary)]"><option value="amount">价格</option><option value="inquiry">询价</option><option value="free">免费</option></select></div>
            <div className="relative"><span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-[var(--text-secondary)]">¥</span><input id="create-product-price" type="number" value={formData.price} onChange={(e) => onChange({ price: e.target.value, currency: 'CNY' })} min="0" step="0.01" disabled={disabled || priceMode !== 'amount'} required={priceMode === 'amount'} className={`${inputClass} pl-8 font-semibold tabular-nums`} /></div>
          </div>
          {!isDigital && <div className="space-y-1.5 sm:col-span-2"><FieldLabel htmlFor="create-product-origin" label={isZh ? '产地' : 'Origin'} optional /><input id="create-product-origin" name="origin" type="text" value={formData.origin} onChange={(e) => onChange({ origin: e.target.value })} disabled={disabled} className={inputClass} list="product-origin-options" autoComplete="country-name" /><datalist id="product-origin-options">{filteredOrigins.map((value) => <option key={value} value={value} />)}</datalist></div>}
        </section>
      )
    }
    return (
      <section className="space-y-3">
        <div className="space-y-1.5">
          <FieldLabel htmlFor="create-product-name" label={isZh ? '名称' : 'Name'} required minimal />
          <input id="create-product-name" type="text" value={formData.title} onChange={(e) => onChange({ title: e.target.value })} disabled={disabled} className={`${inputClass} font-medium`} />
        </div>

        {!hideCategory && <div className="space-y-1.5">
          <FieldLabel htmlFor="create-product-category" label={isZh ? '分类' : 'Category'} />
          <CategorySelector id="create-product-category" value={formData.categoryId || formData.category} onChange={(res) => { onChange({ category: res.categoryName, categoryId: res.categoryId || null }); onCategoryChange?.(res.categoryName, res.categoryId || null) }} onClear={() => { onChange({ category: '', categoryId: null }); onCategoryChange?.('', null) }} disabled={disabled} placeholder={isZh ? '选择' : 'Select'} />
        </div>}

        <div className="space-y-1.5">
          <FieldLabel htmlFor="create-product-price" label={isZh ? '展示价格' : 'Display price'} required={priceMode === 'amount'} minimal />
          <div className="relative"><span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-[var(--text-secondary)]">¥</span><input id="create-product-price" type="number" value={formData.price} onChange={(e) => onChange({ price: e.target.value, currency: 'CNY' })} min="0" step="0.01" disabled={disabled || priceMode !== 'amount'} required={priceMode === 'amount'} className={`${inputClass} pl-8 font-semibold tabular-nums`} /></div>
        </div>

        {!isDigital && !hideInventory && <div className="space-y-1.5">
          <FieldLabel htmlFor="create-product-inventory" label={isZh ? '库存' : 'Stock'} required minimal />
          <input id="create-product-inventory" type="number" value={formData.inventory} onChange={(e) => onChange({ inventory: e.target.value })} min="0" step="1" placeholder="0" required disabled={disabled} className={inputClass} />
        </div>}

        <details className="group rounded-[var(--radius-card-nested)] border border-[var(--border-subtle)] px-3.5">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-sm font-medium text-[var(--text-secondary)] [&::-webkit-details-marker]:hidden">
            <span>{isZh ? '更多' : 'More'}</span>
            <span aria-hidden="true" className="text-lg leading-none text-[var(--accent-primary)] transition-transform group-open:rotate-45">+</span>
          </summary>
          <div className="space-y-3 pb-3.5">
            {!isDigital && <div className="space-y-1.5"><FieldLabel htmlFor="create-product-origin" label={isZh ? '产地' : 'Origin'} optional /><input id="create-product-origin" name="origin" type="text" value={formData.origin} onChange={(e) => onChange({ origin: e.target.value })} disabled={disabled} className={inputClass} list="product-origin-options" autoComplete="country-name" /><datalist id="product-origin-options">{filteredOrigins.map((value) => <option key={value} value={value} />)}</datalist></div>}
            <div className="space-y-1.5"><FieldLabel htmlFor="create-product-description" label={isZh ? '描述' : 'Description'} optional /><textarea id="create-product-description" rows={3} value={formData.description} onChange={(e) => onChange({ description: e.target.value })} disabled={disabled} className={`${inputClass} h-auto resize-y py-3 leading-5`} /></div>
          </div>
        </details>
      </section>
    )
  }

  return (
    <section className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
      <div className="space-y-1.5 sm:col-span-2"><FieldLabel htmlFor="create-product-name" label={isZh ? '商品名称' : 'Product title'} required /><input id="create-product-name" type="text" value={formData.title} onChange={(e) => onChange({ title: e.target.value })} placeholder={isZh ? '例如：纯棉连帽卫衣' : 'e.g. Cotton Hoodie'} disabled={disabled} className={`${inputClass} font-medium`} /></div>

      <div className="space-y-1.5"><FieldLabel htmlFor="create-product-category" label={isZh ? '分类' : 'Category'} optional /><CategorySelector id="create-product-category" value={formData.categoryId || formData.category} onChange={(res) => { onChange({ category: res.categoryName, categoryId: res.categoryId || null }); onCategoryChange?.(res.categoryName, res.categoryId || null) }} onClear={() => { onChange({ category: '', categoryId: null }); onCategoryChange?.('', null) }} disabled={disabled} placeholder={isZh ? '选择分类' : 'Select category'} /></div>
      <div className="space-y-1.5"><FieldLabel htmlFor="create-product-price" label={isZh ? '展示价格（人民币）' : 'Display price (CNY)'} required={priceMode === 'amount'} /><div className="relative"><span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-[var(--text-secondary)]">¥</span><input id="create-product-price" type="number" value={formData.price} onChange={(e) => onChange({ price: e.target.value, currency: 'CNY' })} min="0" step="0.01" placeholder="0.00" disabled={disabled || priceMode === 'inquiry'} required={priceMode === 'amount'} className={`${inputClass} pl-8 font-semibold tabular-nums`} /></div></div>

      {!isDigital && !hideInventory && <div className="space-y-1.5"><FieldLabel htmlFor="create-product-inventory" label={isZh ? '库存' : 'Inventory'} required /><input id="create-product-inventory" type="number" value={formData.inventory} onChange={(e) => onChange({ inventory: e.target.value })} min="0" step="1" placeholder="0" required disabled={disabled} className={inputClass} /></div>}

      {!isDigital && <div className="space-y-1.5"><FieldLabel htmlFor="create-product-origin" label={isZh ? '产地' : 'Country of origin'} optional /><input id="create-product-origin" name="origin" type="text" value={formData.origin} onChange={(e) => onChange({ origin: e.target.value })} placeholder={originOptions[0] || (isZh ? '输入或选择产地' : 'Type or choose an origin')} disabled={disabled} className={inputClass} list="product-origin-options" autoComplete="country-name" /><datalist id="product-origin-options">{filteredOrigins.map((value) => <option key={value} value={value} />)}</datalist></div>}
      <div className="space-y-1.5 sm:col-span-2"><FieldLabel htmlFor="create-product-description" label={isZh ? '描述' : 'Description'} optional /><textarea id="create-product-description" rows={4} value={formData.description} onChange={(e) => onChange({ description: e.target.value })} placeholder={isZh ? '可稍后补充商品描述' : 'Add a description later if needed'} disabled={disabled} className={`${inputClass} h-auto resize-y py-3 leading-5`} /></div>
    </section>
  )
}

function FieldLabel({ htmlFor, label, required, optional, minimal }: { htmlFor: string; label: string; required?: boolean; optional?: boolean; minimal?: boolean }) {
  return <label htmlFor={htmlFor} className="block text-sm font-medium text-[var(--text-primary)]">{label}{required ? <span className={`ml-1 ${minimal ? 'text-[var(--accent-primary)]' : 'text-[var(--accent-primary)]'}`} aria-hidden="true">*</span> : ''}{optional ? <span className="ml-1 text-xs font-normal text-[var(--text-muted)]">{isOptionalLabelZh(label) ? '可选' : 'Optional'}</span> : null}</label>
}

function isOptionalLabelZh(label: string) {
  return /[\u4e00-\u9fff]/.test(label)
}
