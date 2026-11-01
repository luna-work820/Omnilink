'use client'

import React, { useRef, useState } from 'react'
import { Check, Plus, X } from 'lucide-react'
import { useLanguage } from '@/context/LanguageContext'

/**
 * A single attribute row carries ONE of two roles:
 *
 *  - `trait`   — a fact shared by the whole product (material, weight, ...).
 *                Holds a single `value` (+ optional `unit`). Rendered in the
 *                storefront "Specifications & Details" table.
 *  - `variant` — a purchasable axis the customer picks from (color, size, ...).
 *                Holds multiple `values`. Expanded into SKUs (cartesian product)
 *                and rendered as a variant selector that drives price/stock.
 *
 * The two roles MUST stay separate at the storage layer (flat key/value vs
 * a dimension matrix). The UI keeps them in two clearly-labeled sections so
 * a merchant never has to choose a role per row — the section does that.
 */
export type AttributeRole = 'trait' | 'variant'

export interface AttributeRow {
  id: string
  role: AttributeRole
  /** Stable slug: canonical field key for traits, option code for variants. */
  key: string
  /** Display name (merchant-facing + storefront-facing). */
  label: string
  /** Trait value (single). */
  value: string
  /** Variant option values (multiple). */
  values: string[]
  unit?: string
  /** Optional input hint, e.g. prefilled from a category template. */
  placeholder?: string
  /** Category-generated row, used to replace untouched presets when the category changes. */
  templateId?: string
  templateValues?: string[]
}

interface QuickDef {
  key: string
  labelZh: string
  labelEn: string
  role: AttributeRole
  defaultUnit?: string
  placeholderZh: string
  placeholderEn: string
}

const QUICK_DEFS: QuickDef[] = [
  {
    key: 'color',
    labelZh: '颜色',
    labelEn: 'Color',
    role: 'variant',
    placeholderZh: '输入选项值后回车，如：黑色',
    placeholderEn: 'Type a value, press Enter',
  },
  {
    key: 'size',
    labelZh: '尺码',
    labelEn: 'Size',
    role: 'variant',
    placeholderZh: '输入选项值后回车，如：M',
    placeholderEn: 'Type a value, press Enter',
  },
  {
    key: 'package',
    labelZh: '套餐',
    labelEn: 'Package',
    role: 'variant',
    placeholderZh: '输入选项值后回车，如：标准装',
    placeholderEn: 'Type a value, press Enter',
  },
  {
    key: 'material',
    labelZh: '核心材质',
    labelEn: 'Material',
    role: 'trait',
    placeholderZh: '如：925银、100%纯棉、铝合金',
    placeholderEn: 'e.g. 925 Silver, 100% Cotton',
  },
  {
    key: 'dimensions',
    labelZh: '包装尺寸',
    labelEn: 'Package Size',
    role: 'trait',
    defaultUnit: 'cm',
    placeholderZh: '如：15x10x5',
    placeholderEn: 'e.g. 15x10x5',
  },
  {
    key: 'weight',
    labelZh: '重量',
    labelEn: 'Weight',
    role: 'trait',
    defaultUnit: 'g',
    placeholderZh: '如：250',
    placeholderEn: 'e.g. 250',
  },
]

interface ProductAttributesPanelProps {
  rows: AttributeRow[]
  onChange: (rows: AttributeRow[]) => void
  disabled?: boolean
  showHeader?: boolean
}

export function ProductAttributesPanel({
  rows,
  onChange,
  disabled = false,
  showHeader = true,
}: ProductAttributesPanelProps) {
  const { isZh } = useLanguage()
  // NOTE: a ref counter (instead of Date.now()/Math.random()) keeps id
  // generation out of render and avoids React-Compiler "impure function"
  // lint errors that the previous implementation tripped.
  const idSeq = useRef(0)

  const nextId = () => {
    idSeq.current += 1
    return `attr_${idSeq.current}`
  }

  const handleAddQuick = (def: QuickDef) => {
    if (rows.some((r) => r.key === def.key)) return
    onChange([
      ...rows,
      {
        id: nextId(),
        role: def.role,
        key: def.key,
        label: isZh ? def.labelZh : def.labelEn,
        value: '',
        values: [],
        unit: def.defaultUnit,
      },
    ])
  }

  const handleRemove = (id: string) => {
    onChange(rows.filter((r) => r.id !== id))
  }

  const handleTraitValueChange = (id: string, value: string) => {
    onChange(rows.map((r) => (r.id === id ? { ...r, value } : r)))
  }

  const handleUnitChange = (id: string, unit: string) => {
    onChange(rows.map((r) => (r.id === id ? { ...r, unit } : r)))
  }

  const handleAddVariantValue = (id: string, raw: string, clear: () => void) => {
    const val = raw.trim()
    if (!val) return
    onChange(
      rows.map((r) =>
        r.id === id && !r.values.includes(val) ? { ...r, values: [...r.values, val] } : r,
      ),
    )
    clear()
  }

  const handleRemoveVariantValue = (id: string, index: number) => {
    onChange(
      rows.map((r) =>
        r.id === id ? { ...r, values: r.values.filter((_, i) => i !== index) } : r,
      ),
    )
  }

  const handleAddCustom = (
    role: AttributeRole,
    name: string,
    clear: () => void,
  ) => {
    const trimmed = name.trim()
    if (!trimmed) return
    onChange([
      ...rows,
      {
        id: nextId(),
        role,
        key:
          role === 'variant'
            ? trimmed.toLowerCase().replace(/\s+/g, '_')
            : `attr_${idSeq.current}_${trimmed.toLowerCase().replace(/\s+/g, '_')}`,
        label: trimmed,
        value: '',
        values: [],
        unit: undefined,
      },
    ])
    clear()
  }

  const variantRows = rows.filter((r) => r.role === 'variant')
  const traitRows = rows.filter((r) => r.role === 'trait')

  const placeholderFor = (row: AttributeRow): string => {
    if (row.placeholder) return row.placeholder
    const def = QUICK_DEFS.find((q) => q.key === row.key)
    if (!def) return isZh ? '请输入属性值' : 'Enter value'
    return isZh ? def.placeholderZh : def.placeholderEn
  }

  return (
    <div className="space-y-3.5">
      {showHeader && (
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2.5">
          <div className="flex items-center gap-2">
            <div className="grid h-7 min-w-7 place-items-center rounded-[var(--radius-control)] bg-[var(--surface-muted)] px-1.5 text-xs font-semibold tabular-nums text-[var(--text-secondary)]">
              02
            </div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
              {isZh ? '商品规格' : 'Product Specifications'}
            </h3>
          </div>
        </div>
      )}

      {/* ───── 子区域 1：商品特征（单值 + 单位） ───── */}
      <AttributeSection
        isZh={isZh}
        badge="A"
        titleZh="商品特征"
        titleEn="Product Traits"
        accentClass="bg-[var(--surface-muted)] text-[var(--primary)] border-[var(--primary)]/20"
        rows={traitRows}
        disabled={disabled}
        renderRow={(row) => (
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <input
                type="text"
                value={row.value}
                onChange={(e) => handleTraitValueChange(row.id, e.target.value)}
                placeholder={placeholderFor(row)}
                disabled={disabled}
                className="h-10 w-full rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface)] px-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus-visible:border-[var(--accent-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-secondary)]/15"
              />
            </div>
            <div className="w-16 sm:w-20 shrink-0">
              <input
                type="text"
                value={row.unit ?? ''}
                onChange={(e) => handleUnitChange(row.id, e.target.value)}
                placeholder={isZh ? '单位' : 'Unit'}
                disabled={disabled}
                className="h-10 w-full rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface)] px-2 text-center text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus-visible:border-[var(--accent-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-secondary)]/15"
              />
            </div>
            <button
              type="button"
              onClick={() => handleRemove(row.id)}
              disabled={disabled}
              className="ui-interactive grid h-10 w-10 shrink-0 place-items-center rounded-[var(--radius-control)] text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--plum)]"
              title={isZh ? '删除' : 'Remove'}
            >
              <X size={14} />
            </button>
          </div>
        )}
        quickDefs={QUICK_DEFS.filter((d) => d.role === 'trait')}
        onQuickAdd={(def) => handleAddQuick(def)}
        isQuickAdded={(def) => rows.some((r) => r.key === def.key)}
        onAddCustom={(name, clear) => handleAddCustom('trait', name, clear)}
      />

      {/* ───── 子区域 2：销售规格（多值 + SKU 矩阵） ───── */}
      <AttributeSection
        isZh={isZh}
        badge="B"
        titleZh="销售规格"
        titleEn="Purchase Variants"
        accentClass="bg-[var(--accent-secondary-soft)] text-[var(--accent-secondary)] border-[var(--accent-secondary)]/20"
        rows={variantRows}
        disabled={disabled}
        renderRow={(row) => (
          <VariantRowEditor
            isZh={isZh}
            row={row}
            disabled={disabled}
            placeholder={placeholderFor(row)}
            onAddValue={(raw, clear) => handleAddVariantValue(row.id, raw, clear)}
            onRemoveValue={(idx) => handleRemoveVariantValue(row.id, idx)}
            onRemoveRow={() => handleRemove(row.id)}
          />
        )}
        quickDefs={QUICK_DEFS.filter((d) => d.role === 'variant')}
        onQuickAdd={(def) => handleAddQuick(def)}
        isQuickAdded={(def) => rows.some((r) => r.key === def.key)}
        onAddCustom={(name, clear) => handleAddCustom('variant', name, clear)}
      />

    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// 内部组件：单一区域（特征或规格共用）
// ─────────────────────────────────────────────────────────────────────────

interface AttributeSectionProps {
  isZh: boolean
  badge: string
  titleZh: string
  titleEn: string
  accentClass: string
  rows: AttributeRow[]
  disabled: boolean
  renderRow: (row: AttributeRow) => React.ReactNode
  quickDefs: QuickDef[]
  onQuickAdd: (def: QuickDef) => void
  isQuickAdded: (def: QuickDef) => boolean
  onAddCustom: (name: string, clear: () => void) => void
}

function AttributeSection({
  isZh,
  badge,
  titleZh,
  titleEn,
  accentClass,
  rows,
  disabled,
  renderRow,
  quickDefs,
  onQuickAdd,
  isQuickAdded,
  onAddCustom,
}: AttributeSectionProps) {
  const [showCustom, setShowCustom] = useState(false)
  const [customName, setCustomName] = useState('')

  const confirm = () => {
    onAddCustom(customName, () => {
      setCustomName('')
      setShowCustom(false)
    })
  }

  return (
    <div className="ui-card--nested overflow-hidden border border-[var(--border-subtle)]">
      {/* 区域头 */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--surface-muted)]">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={`w-5 h-5 rounded-md border flex items-center justify-center text-[10px] font-bold shrink-0 ${accentClass}`}
            aria-hidden="true"
          >
            {badge}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-medium text-[var(--text-primary)]">
                {isZh ? titleZh : titleEn}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 行列表 */}
      <div className="px-3 py-2 space-y-1.5">
        {rows.length === 0 ? (
          <div className="h-1" aria-hidden="true" />
        ) : (
          rows.map((row) => (
            <div
              key={row.id}
              className="flex items-center gap-2 py-1 px-2 -mx-2  hover:bg-[var(--surface-muted)] transition-colors group"
            >
              <span
                className="w-16 sm:w-20 shrink-0 text-[11px] font-semibold text-[var(--lavender)] truncate"
                title={row.label}
              >
                {row.label}
              </span>
              <div className="flex-1 min-w-0">{renderRow(row)}</div>
            </div>
          ))
        )}
      </div>

      {/* 快捷 + 自定义添加 */}
      <div className="px-3 py-2 border-t border-[var(--surface-muted)] bg-[var(--surface-muted)]/50 space-y-1.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          {quickDefs.map((def) => {
            const added = isQuickAdded(def)
            return (
              <button
                key={def.key}
                type="button"
                onClick={() => onQuickAdd(def)}
                disabled={disabled || added}
              className={`ui-interactive flex h-8 items-center gap-1.5 rounded-[var(--radius-control)] border px-3 text-xs transition-colors ${
                  added
                    ? 'cursor-default border-[var(--accent-secondary)] bg-[var(--accent-secondary-soft)] text-[var(--accent-secondary)]'
                    : 'border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-secondary)] hover:border-[var(--accent-secondary)] hover:text-[var(--accent-secondary)]'
                }`}
              >
                {added && <Check size={13} aria-hidden="true" />}
                <span>{isZh ? def.labelZh : def.labelEn}</span>
              </button>
            )
          })}
          {!showCustom && (
            <button
              type="button"
              onClick={() => setShowCustom(true)}
              disabled={disabled}
              aria-label={isZh ? `添加${titleZh.replace('商品', '').replace('销售', '')}` : `Add ${titleEn}`}
              title={isZh ? `添加${titleZh.replace('商品', '').replace('销售', '')}` : `Add ${titleEn}`}
              className="ui-interactive grid h-8 w-8 place-items-center rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-secondary)] hover:border-[var(--accent-secondary)] hover:text-[var(--accent-secondary)]"
            >
              <Plus size={13} />
            </button>
          )}
        </div>

        {showCustom ? (
          <div className="flex items-center gap-1.5 pt-1">
            <input
              type="text"
              autoFocus
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  confirm()
                } else if (e.key === 'Escape') {
                  setCustomName('')
                  setShowCustom(false)
                }
              }}
              placeholder={
                isZh
                  ? `自定义${titleZh.replace('商品', '').replace('销售', '')}名称，回车添加`
                  : `Custom ${titleEn.toLowerCase()}, press Enter`
              }
              className="h-9 min-w-0 flex-1 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface)] px-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus-visible:border-[var(--accent-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-secondary)]/15"
            />
            <button
              type="button"
              onClick={confirm}
              disabled={!customName.trim()}
              className="h-9 rounded-[var(--radius-control)] bg-[var(--accent-primary)] px-3 text-xs font-semibold text-[var(--accent-primary-foreground)] transition-colors hover:bg-[var(--accent-primary-hover)] disabled:opacity-40"
            >
              {isZh ? '添加' : 'Add'}
            </button>
            <button
              type="button"
              onClick={() => {
                setCustomName('')
                setShowCustom(false)
              }}
              className="ui-secondary h-9 rounded-[var(--radius-control)] px-3 text-xs"
            >
              {isZh ? '取消' : 'Cancel'}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// 内部组件：销售规格行的多值编辑器（chip + 输入 + 添加）
// ─────────────────────────────────────────────────────────────────────────

interface VariantRowEditorProps {
  isZh: boolean
  row: AttributeRow
  disabled: boolean
  placeholder: string
  onAddValue: (raw: string, clear: () => void) => void
  onRemoveValue: (idx: number) => void
  onRemoveRow: () => void
}

function VariantRowEditor({
  isZh,
  row,
  disabled,
  placeholder,
  onAddValue,
  onRemoveValue,
  onRemoveRow,
}: VariantRowEditorProps) {
  const [draft, setDraft] = useState('')

  const clear = () => setDraft('')

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {row.values.map((v, vIdx) => (
        <span
          key={`${row.id}-val-${vIdx}`}
          className="inline-flex items-center gap-1 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--text-secondary)]"
        >
          <span>{v}</span>
          <button
            type="button"
            onClick={() => onRemoveValue(vIdx)}
            disabled={disabled}
            className="text-[var(--lavender)] hover:text-[var(--plum)] cursor-pointer"
          >
            <X size={10} />
          </button>
        </span>
      ))}

      <div className="inline-flex items-center gap-1">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              onAddValue(draft, clear)
            }
          }}
          placeholder={placeholder}
          disabled={disabled}
          className="h-9 w-32 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface)] px-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus-visible:border-[var(--accent-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-secondary)]/15"
        />
      </div>

      <button
        type="button"
        onClick={onRemoveRow}
        disabled={disabled}
        className="ui-interactive ml-auto grid h-8 w-8 shrink-0 place-items-center rounded-[var(--radius-control)] text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--plum)]"
        title={isZh ? '删除该规格' : 'Remove variant'}
      >
        <X size={12} />
      </button>
    </div>
  )
}
