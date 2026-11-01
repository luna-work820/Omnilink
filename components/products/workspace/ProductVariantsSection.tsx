'use client'

import React, { useRef, useState } from 'react'
import { Plus, Trash2, AlertCircle, Sparkles, SlidersHorizontal } from 'lucide-react'
import { useLanguage } from '@/context/LanguageContext'
import type { ProductOption, ProductVariant } from '@/lib/products/variants/types'
import type { VariantDraft } from '@/lib/products/domain-types'
import { reconcileVariantItems } from '@/lib/products/variants/reconcile'
import { generateVariantKey } from '@/lib/products/variants/identity'

interface ProductVariantsSectionProps {
  productId?: string
  options: ProductOption[]
  setOptions: React.Dispatch<React.SetStateAction<ProductOption[]>>
  variants: ProductVariant[]
  setVariants: React.Dispatch<React.SetStateAction<ProductVariant[]>>
  disabled?: boolean
}

const DIMENSION_PRESETS = [
  { nameZh: '颜色', nameEn: 'Color', code: 'color', defaultValues: ['黑色', '白色', '银色'] },
  { nameZh: '尺码', nameEn: 'Size', code: 'size', defaultValues: ['S', 'M', 'L', 'XL'] },
  { nameZh: '容量', nameEn: 'Capacity', code: 'capacity', defaultValues: ['128GB', '256GB', '512GB'] },
  { nameZh: '款式', nameEn: 'Style', code: 'style', defaultValues: ['标准款', '升级款'] },
  { nameZh: '版本', nameEn: 'Edition', code: 'edition', defaultValues: ['基础版', '专业版', '旗舰版'] },
]

/**
 * Stable combination key for a variant, matching the key algorithm used by
 * `generateVariantCombinations` so reconcile can preserve merchant edits
 * across re-generation. Falls back to JSON for malformed option_values.
 */
function comboKeyOf(optionValues: Record<string, string>): string {
  try {
    return generateVariantKey(optionValues)
  } catch {
    return JSON.stringify(optionValues)
  }
}

/**
 * Fully controlled sales-variant editor.
 *
 * Data flow (single direction, NO echo effects):
 *   parent state (options/variants) -> this component renders
 *   user action -> setOptions / setVariants -> parent re-renders
 *
 * The previous implementation kept a local `variantItems` mirror and synced
 * it both ways via useEffect, which could loop (each sync produced fresh
 * object identities + fresh timestamps). The mirror is gone: `variants` is
 * the single source of truth.
 *
 * ID conventions (consumed by the workspace save routine):
 *   - existing DB rows keep their uuid
 *   - newly created options/variants get a `temp-` prefixed id
 */
export function ProductVariantsSection({
  productId,
  options,
  setOptions,
  variants,
  setVariants,
  disabled = false,
}: ProductVariantsSectionProps) {
  const { isZh } = useLanguage()

  const [error, setError] = useState('')
  const [batchPrice, setBatchPrice] = useState<string>('')
  const [batchInventory, setBatchInventory] = useState<string>('')
  const [showBatchToolbar, setShowBatchToolbar] = useState(false)

  // Ref counter for temp ids (avoids Date.now()/Math.random() in handlers).
  const tempSeq = useRef(0)
  const nextTempId = (prefix: string) => {
    tempSeq.current += 1
    return `temp-${prefix}-${tempSeq.current}`
  }

  const addOption = (preset?: (typeof DIMENSION_PRESETS)[0]) => {
    const name = preset ? (isZh ? preset.nameZh : preset.nameEn) : ''
    const code = preset ? preset.code : `dimension_${options.length + 1}`
    const values = preset ? preset.defaultValues : ['']

    const newOption: ProductOption = {
      id: nextTempId('opt'),
      product_id: productId || '',
      name,
      code,
      position: options.length,
      values,
      created_at: new Date().toISOString(),
    }
    setOptions((prev) => [...prev, newOption])
    setError('')
  }

  const updateOption = (index: number, field: keyof ProductOption, value: unknown) => {
    setOptions((prev) => prev.map((o, i) => (i === index ? { ...o, [field]: value } : o)))
  }

  const removeOption = (index: number) => {
    setOptions((prev) => prev.filter((_, i) => i !== index))
  }

  const addOptionValue = (optionIndex: number) => {
    setOptions((prev) =>
      prev.map((o, i) => (i === optionIndex ? { ...o, values: [...o.values, ''] } : o)),
    )
  }

  const updateOptionValue = (optionIndex: number, valueIndex: number, value: string) => {
    setOptions((prev) =>
      prev.map((o, i) =>
        i === optionIndex
          ? { ...o, values: o.values.map((v, vi) => (vi === valueIndex ? value : v)) }
          : o,
      ),
    )
  }

  const removeOptionValue = (optionIndex: number, valueIndex: number) => {
    setOptions((prev) =>
      prev.map((o, i) =>
        i === optionIndex ? { ...o, values: o.values.filter((_, vi) => vi !== valueIndex) } : o,
      ),
    )
  }

  // Calculate Cartesian Product combination stats
  const validOptions = options
    .filter((opt) => opt.name.trim() && opt.code.trim() && opt.values.some((v) => v.trim()))
    .map((opt) => ({
      code: opt.code.trim(),
      name: opt.name.trim(),
      values: opt.values.filter((v) => v.trim()),
    }))

  const totalPossibleCombinations = validOptions.reduce(
    (acc, opt) => acc * (opt.values.length || 1),
    validOptions.length > 0 ? 1 : 0,
  )

  /** Map current DB/local variants to reconcile drafts keyed by COMBINATION key. */
  const toDrafts = (source: ProductVariant[]): VariantDraft[] =>
    source.map((v) => ({
      key: comboKeyOf(v.option_values as Record<string, string>),
      optionValues: v.option_values as Record<string, string>,
      sku: v.sku || undefined,
      price: v.price ?? undefined,
      inventory: v.inventory ?? undefined,
      skuSource: v.sku ? 'manual' : undefined,
    }))

  /**
   * Map reconcile drafts back to ProductVariant rows, preserving the DB id
   * of surviving combinations (matched by combination key) so the save
   * routine PATCHes them instead of re-creating; brand-new combinations get
   * a `temp-` id and will be POSTed.
   */
  const toVariants = (drafts: VariantDraft[], previous: ProductVariant[]): ProductVariant[] => {
    const idByComboKey = new Map(
      previous.map((v) => [comboKeyOf(v.option_values as Record<string, string>), v.id]),
    )
    const now = new Date().toISOString()
    return drafts.map((d) => ({
      id: idByComboKey.get(d.key) ?? `temp-${d.key}`,
      product_id: productId || '',
      sku: d.sku || null,
      price: d.price ?? null,
      currency: previous[0]?.currency || 'CNY',
      inventory: d.inventory ?? null,
      status: 'active',
      option_values: d.optionValues,
      raw_data: null,
      semantic_data: null,
      created_at: now,
      updated_at: now,
    }))
  }

  const handleGenerateVariants = () => {
    if (validOptions.length === 0) {
      setError(
        isZh
          ? '请至少设置一个销售维度并填写有效的选项值 (例如: 颜色 ➔ 黑色, 白色)'
          : 'Please add at least one sales dimension with valid option values',
      )
      return
    }

    let drafts: VariantDraft[]
    try {
      drafts = reconcileVariantItems(
        validOptions.map((o) => ({ name: o.name, values: o.values })),
        toDrafts(variants),
        {
          generateSku: (combo) => {
            const vals = Object.values(combo.optionValues).join('-')
            return `SKU-${vals.toUpperCase().replace(/\s+/g, '')}`
          },
        },
      )
    } catch (genErr) {
      setError(genErr instanceof Error ? genErr.message : String(genErr))
      return
    }

    setVariants((prev) => toVariants(drafts, prev))
    setError('')
  }

  const updateVariant = (id: string, field: 'sku' | 'price' | 'inventory' | 'status', value: string) => {
    setVariants((prev) =>
      prev.map((v) => {
        if (v.id !== id) return v
        if (field === 'sku') return { ...v, sku: value || null }
        if (field === 'price') {
          const num = parseFloat(value)
          return { ...v, price: value === '' || isNaN(num) ? null : num }
        }
        if (field === 'status') {
          return { ...v, status: value as ProductVariant['status'] }
        }
        const num = parseInt(value, 10)
        return { ...v, inventory: value === '' || isNaN(num) ? null : num }
      }),
    )
  }

  const removeVariant = (id: string) => {
    setVariants((prev) => prev.filter((v) => v.id !== id))
  }

  const handleBatchApplyPrice = () => {
    const priceNum = parseFloat(batchPrice)
    if (isNaN(priceNum) || priceNum < 0) return
    setVariants((prev) => prev.map((v) => ({ ...v, price: priceNum })))
  }

  const handleBatchApplyInventory = () => {
    const invNum = parseInt(batchInventory, 10)
    if (isNaN(invNum) || invNum < 0) return
    setVariants((prev) => prev.map((v) => ({ ...v, inventory: invNum })))
  }

  const handleAutoGenerateSkus = () => {
    setVariants((prev) =>
      prev.map((v) => {
        if (v.sku && v.sku.trim()) return v
        const vals = Object.values(v.option_values as Record<string, string>).join('-')
        return { ...v, sku: `SKU-${vals.toUpperCase().replace(/\s+/g, '')}` }
      }),
    )
  }

  return (
    <div className="space-y-5 border-b border-[var(--border)] pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[var(--surface-muted)] gap-3">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-base font-extrabold text-[var(--lavender)]">
              {isZh ? '销售规格' : 'Sales Options'}
            </h2>
          </div>
        </div>
      </div>

      <div className="space-y-6">
          {/* Preset quick buttons */}
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {DIMENSION_PRESETS.map((preset) => {
                const isAdded = options.some(
                  (o) =>
                    o.code.toLowerCase() === preset.code ||
                    o.name.toLowerCase() === preset.nameZh.toLowerCase(),
                )
                return (
                  <button
                    key={preset.code}
                    type="button"
                    disabled={disabled || isAdded}
                    onClick={() => addOption(preset)}
                    className={`px-2.5 py-1  text-xs font-medium border transition-all cursor-pointer flex items-center gap-1 ${
                      isAdded
                        ? 'bg-[var(--surface-muted)] border-[var(--surface-muted)] text-[var(--lavender)] cursor-not-allowed'
                        : 'bg-[var(--surface)] border-[var(--border)] text-[var(--ink)] hover:bg-[var(--surface-muted)] hover:border-[var(--border)]'
                    }`}
                  >
                    <Plus size={12} />
                    <span>{isZh ? preset.nameZh : preset.nameEn}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Option Items List (销售维度) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-[var(--lavender)]">
                {isZh ? '销售维度定义 (Sales Dimensions)' : 'Sales Dimension Definitions'}
              </h3>
              <button
                type="button"
                onClick={() => addOption()}
                disabled={disabled}
                className="px-3 py-1.5  bg-[var(--primary)] hover:bg-[var(--primary)] active:bg-[var(--primary)] text-[var(--surface)] text-xs font-medium flex items-center gap-1 cursor-pointer transition-all focus-visible:outline-2 focus-visible:outline-[var(--primary)]"
              >
                <Plus size={13} />
                <span>{isZh ? '＋ 添加销售维度' : 'Add Sales Dimension'}</span>
              </button>
            </div>

            {options.map((option, optionIndex) => (
              <div
                key={option.id}
                className="p-4 rounded-xl bg-[var(--surface-muted)]/80 border border-[var(--surface-muted)] space-y-3.5"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-[var(--lavender)] mb-1">
                      {isZh ? '销售维度名称 (如: 颜色, 尺码, 容量)' : 'Dimension Name'}
                    </label>
                    <input
                      type="text"
                      value={option.name}
                      onChange={(e) => updateOption(optionIndex, 'name', e.target.value)}
                      placeholder={isZh ? '例如: 颜色' : 'e.g. Color'}
                      disabled={disabled}
                      className="w-full h-8 px-2.5  bg-[var(--surface)] border border-[var(--surface-muted)] text-xs font-medium text-[var(--lavender)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[var(--lavender)] mb-1">
                      {isZh ? '销售维度编码 (如: color, size)' : 'Dimension Code'}
                    </label>
                    <input
                      type="text"
                      value={option.code}
                      onChange={(e) => updateOption(optionIndex, 'code', e.target.value)}
                      placeholder={isZh ? '例如: color' : 'e.g. color'}
                      disabled={disabled}
                      className="w-full h-8 px-2.5  bg-[var(--surface)] border border-[var(--surface-muted)] text-xs font-mono text-[var(--lavender)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                    />
                  </div>
                </div>

                {/* Option Values */}
                <div className="space-y-2">
                  <label className="block text-[11px] font-bold text-[var(--lavender)]">
                    {isZh ? '选项值列表' : 'Option Values'}
                  </label>
                  <div className="flex flex-wrap gap-2 items-center">
                    {option.values.map((value, valueIndex) => (
                      <div
                        key={valueIndex}
                        className="inline-flex items-center gap-1.5 px-2 py-1  bg-[var(--surface)] border border-[var(--surface-muted)] shadow-2xs"
                      >
                        <input
                          type="text"
                          value={value}
                          onChange={(e) =>
                            updateOptionValue(optionIndex, valueIndex, e.target.value)
                          }
                          placeholder={isZh ? '如: 黑色' : 'e.g. Black'}
                          disabled={disabled}
                          className="h-6 w-24 text-xs font-medium text-[var(--lavender)] bg-transparent focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => removeOptionValue(optionIndex, valueIndex)}
                          className="text-[var(--lavender)] hover:text-[var(--plum)] font-bold text-xs px-0.5 cursor-pointer"
                          title={isZh ? '删除选项值' : 'Remove value'}
                        >
                          ✕
                        </button>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={() => addOptionValue(optionIndex)}
                      className="px-2.5 py-1  bg-[var(--primary)] hover:bg-[var(--primary)] text-[var(--primary-foreground)] text-xs font-bold transition-all cursor-pointer border border-[var(--primary)] flex items-center gap-1"
                    >
                      <Plus size={11} />
                      <span>{isZh ? '添加选项值' : 'Add Value'}</span>
                    </button>
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => removeOption(optionIndex)}
                      className="text-xs text-[var(--plum)] hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <Trash2 size={12} />
                      <span>{isZh ? '删除此销售维度' : 'Remove Dimension'}</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Combination Preview & Generate Action Box */}
          {validOptions.length > 0 && (
            <div className="p-4 rounded-xl bg-gradient-to-r from-blue-50/80 to-slate-50 border border-[var(--primary)] space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[var(--lavender)]">
                      {isZh ? '维度组合预览:' : 'Dimension Combination:'}
                    </span>
                    <span className="text-xs font-bold text-[var(--primary)]">
                      {validOptions.map((o) => o.name).join(' × ')}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--lavender)]">
                    {isZh
                      ? `已设置 ${validOptions.length} 个销售维度，可产生 ${validOptions.map((o) => `${o.name}(${o.values.length})`).join(' × ')} = ${totalPossibleCombinations} 种销售版本`
                      : `${validOptions.length} dimensions configured resulting in ${totalPossibleCombinations} possible combinations`}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleGenerateVariants}
                  disabled={disabled}
                  className="px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary)] active:bg-[var(--primary)] text-[var(--surface)] text-xs font-bold  transition-all flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--primary)]"
                >
                  <Sparkles size={14} />
                  <span>{isZh ? '生成销售版本矩阵' : 'Generate Sales Variants Matrix'}</span>
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-[var(--plum)] border border-[var(--plum)] text-[var(--plum)] text-xs flex items-center gap-2">
              <AlertCircle size={14} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Variants Matrix Table — reads directly from the controlled prop */}
          {variants.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1 border-b border-[var(--surface-muted)]">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold text-[var(--lavender)]">
                    {isZh
                      ? `已生成销售版本矩阵 (${variants.length} SKU)`
                      : `Generated Sales Variants (${variants.length} SKUs)`}
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={() => setShowBatchToolbar((prev) => !prev)}
                  className="text-xs text-[var(--primary)] font-bold hover:underline cursor-pointer flex items-center gap-1"
                >
                  <SlidersHorizontal size={13} />
                  <span>
                    {showBatchToolbar
                      ? isZh
                        ? '隐藏批量工具'
                        : 'Hide Batch Tools'
                      : isZh
                        ? '显示批量改价/改库存/生成 SKU'
                        : 'Batch Operations'}
                  </span>
                </button>
              </div>

              {/* Batch Operations Bar */}
              {showBatchToolbar && (
                <div className="p-3 rounded-xl bg-[var(--surface-muted)] border border-[var(--surface-muted)] grid grid-cols-1 sm:grid-cols-3 gap-3 animate-in fade-in">
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={batchPrice}
                      onChange={(e) => setBatchPrice(e.target.value)}
                      placeholder={isZh ? '统一价格 (¥)' : 'Uniform Price'}
                      className="h-8 px-2.5  bg-[var(--surface)] border border-[var(--surface-muted)] text-xs w-28"
                    />
                    <button
                      type="button"
                      onClick={handleBatchApplyPrice}
                      className="h-8 px-2.5  bg-[var(--primary)] text-[var(--surface)] text-xs font-medium hover:bg-[var(--primary)]"
                    >
                      {isZh ? '套用价格' : 'Apply'}
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={batchInventory}
                      onChange={(e) => setBatchInventory(e.target.value)}
                      placeholder={isZh ? '统一库存' : 'Uniform Inventory'}
                      className="h-8 px-2.5  bg-[var(--surface)] border border-[var(--surface-muted)] text-xs w-24"
                    />
                    <button
                      type="button"
                      onClick={handleBatchApplyInventory}
                      className="h-8 px-2.5  bg-[var(--primary)] text-[var(--surface)] text-xs font-medium hover:bg-[var(--primary)]"
                    >
                      {isZh ? '套用库存' : 'Apply'}
                    </button>
                  </div>

                  <div className="flex items-center justify-end">
                    <button
                      type="button"
                      onClick={handleAutoGenerateSkus}
                      className="h-8 px-3  bg-[var(--surface)] border border-[var(--border)] text-[var(--ink)] text-xs font-medium hover:bg-[var(--surface-muted)]"
                    >
                      {isZh ? '⚡ 自动生成所有空 SKU' : 'Auto Generate SKUs'}
                    </button>
                  </div>
                </div>
              )}

              {/* Matrix Table */}
              <div className="overflow-x-auto border border-[var(--surface-muted)] rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-[var(--surface-muted)] border-b border-[var(--surface-muted)] text-[var(--lavender)] font-bold">
                      <th className="py-2.5 px-3.5">
                        {isZh ? '销售版本 (维度组合)' : 'Sales Variant Combination'}
                      </th>
                      <th className="py-2.5 px-3.5">{isZh ? 'SKU 编码' : 'SKU Code'}</th>
                      <th className="py-2.5 px-3.5">{isZh ? '售价 (¥)' : 'Price'}</th>
                      <th className="py-2.5 px-3.5">{isZh ? '库存' : 'Inventory'}</th>
                      <th className="py-2.5 px-3.5">{isZh ? '状态' : 'Status'}</th>
                      <th className="py-2.5 px-3.5 text-right">{isZh ? '操作' : 'Action'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--surface-muted)]">
                    {variants.map((variant) => (
                      <tr key={variant.id} className="hover:bg-[var(--surface-muted)]/60">
                        <td className="py-2.5 px-3.5 font-bold text-[var(--lavender)]">
                          {Object.values(variant.option_values as Record<string, string>).join(' / ')}
                        </td>
                        <td className="py-2.5 px-3.5">
                          <input
                            type="text"
                            value={variant.sku || ''}
                            onChange={(e) => updateVariant(variant.id, 'sku', e.target.value)}
                            placeholder="SKU-001"
                            disabled={disabled}
                            className="h-8 px-2.5  bg-[var(--surface)] border border-[var(--surface-muted)] text-xs font-mono text-[var(--lavender)] w-36 focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                          />
                        </td>
                        <td className="py-2.5 px-3.5">
                          <input
                            type="number"
                            value={variant.price ?? ''}
                            onChange={(e) => updateVariant(variant.id, 'price', e.target.value)}
                            placeholder="0.00"
                            disabled={disabled}
                            className="h-8 px-2.5  bg-[var(--surface)] border border-[var(--surface-muted)] text-xs font-bold text-[var(--lavender)] w-24 focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                          />
                        </td>
                        <td className="py-2.5 px-3.5">
                          <input
                            type="number"
                            value={variant.inventory ?? ''}
                            onChange={(e) => updateVariant(variant.id, 'inventory', e.target.value)}
                            placeholder="100"
                            disabled={disabled}
                            className="h-8 px-2.5  bg-[var(--surface)] border border-[var(--surface-muted)] text-xs font-bold text-[var(--lavender)] w-20 focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                          />
                        </td>
                        <td className="py-2.5 px-3.5">
                          <select
                            value={variant.status}
                            onChange={(e) => updateVariant(variant.id, 'status', e.target.value)}
                            disabled={disabled}
                            className="h-8 px-2  bg-[var(--surface)] border border-[var(--surface-muted)] text-xs font-medium text-[var(--lavender)]"
                          >
                            <option value="active">{isZh ? '在售' : 'Active'}</option>
                          </select>
                        </td>
                        <td className="py-2.5 px-3.5 text-right">
                          <button
                            type="button"
                            onClick={() => removeVariant(variant.id)}
                            className="p-1 text-[var(--lavender)] hover:text-[var(--plum)]  cursor-pointer transition-colors"
                            title={isZh ? '删除此不售版本' : 'Remove variant'}
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
  )
}
