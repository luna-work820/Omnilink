'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useLanguage } from '@/context/LanguageContext'
import { CategorySelector } from '@/components/product/CategorySelector'
import type { BasicProductFormData } from './types'
import { KNOWLEDGE_FILES_UPDATED_EVENT, readStoredKnowledgeFiles } from '@/lib/knowledge/local-files'

interface ProductBasicInfoProps {
  formData: BasicProductFormData
  onChange: (updates: Partial<BasicProductFormData>) => void
  onCategoryChange?: (category: string) => void
  knowledgeProductId?: string
  disabled?: boolean
}

const inputClass = 'h-10 w-full  border border-[var(--surface-muted)] bg-[var(--surface-muted)] px-3 text-xs text-[var(--lavender)] transition-all focus:border-[var(--primary)] focus:bg-[var(--surface)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/15 disabled:opacity-50'

export function ProductBasicInfo({ formData, onChange, onCategoryChange, knowledgeProductId, disabled = false }: ProductBasicInfoProps) {
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

  return (
    <section className="space-y-4">
      <div className="space-y-1.5"><FieldLabel htmlFor="create-product-name" label={isZh ? '商品名称' : 'Product title'} required /><input id="create-product-name" type="text" value={formData.title} onChange={(e) => onChange({ title: e.target.value })} placeholder={isZh ? '例如：纯棉连帽卫衣' : 'e.g. Cotton Hoodie'} disabled={disabled} className={`${inputClass} font-semibold`} /></div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5"><FieldLabel htmlFor="create-product-category" label={isZh ? '分类' : 'Category'} optional /><CategorySelector id="create-product-category" value={formData.categoryId || formData.category} onChange={(res) => { onChange({ category: res.categoryName, categoryId: res.categoryId || null }); onCategoryChange?.(res.categoryName) }} onClear={() => onChange({ category: '', categoryId: null })} disabled={disabled} placeholder={isZh ? '选择分类' : 'Select category'} /></div>
        <div className="space-y-1.5"><FieldLabel htmlFor="create-product-price" label={isZh ? '售价（人民币）' : 'Price (CNY)'} required /><div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[var(--lavender)]">¥</span><input id="create-product-price" type="number" value={formData.price} onChange={(e) => onChange({ price: e.target.value, currency: 'CNY' })} min="0" step="0.01" placeholder="0.00" disabled={disabled} className={`${inputClass} pl-7 font-bold`} /></div></div>
      </div>

      <div className="space-y-1.5"><FieldLabel htmlFor="create-product-inventory" label={isZh ? '库存' : 'Inventory'} required /><input id="create-product-inventory" type="number" value={formData.inventory} onChange={(e) => onChange({ inventory: e.target.value })} min="0" step="1" placeholder="0" required disabled={disabled} className={inputClass} /></div>

      <div className="space-y-1.5"><FieldLabel htmlFor="create-product-origin" label={isZh ? '产地' : 'Country of origin'} optional /><input id="create-product-origin" name="origin" type="text" value={formData.origin} onChange={(e) => onChange({ origin: e.target.value })} placeholder={originOptions[0] || (isZh ? '输入或选择产地' : 'Type or choose an origin')} disabled={disabled} className={inputClass} list="product-origin-options" autoComplete="country-name" /><datalist id="product-origin-options">{filteredOrigins.map((value) => <option key={value} value={value} />)}</datalist></div>
      <div className="space-y-1.5"><FieldLabel htmlFor="create-product-description" label={isZh ? '描述' : 'Description'} optional /><textarea id="create-product-description" rows={5} value={formData.description} onChange={(e) => onChange({ description: e.target.value })} placeholder={isZh ? '可稍后补充商品描述' : 'Add a description later if needed'} disabled={disabled} className={`${inputClass} h-auto resize-none py-2 leading-5`} /></div>
    </section>
  )
}

function FieldLabel({ htmlFor, label, required, optional }: { htmlFor: string; label: string; required?: boolean; optional?: boolean }) {
  return <label htmlFor={htmlFor} className="block text-xs font-bold text-[var(--lavender)]">{label}{required ? ' *' : ''}{optional ? <span className="ml-1 text-[10px] font-normal">可选</span> : null}</label>
}
