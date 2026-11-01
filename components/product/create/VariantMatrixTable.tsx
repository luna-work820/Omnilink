'use client'

import React, { useEffect, useRef } from 'react'
import { Layers } from 'lucide-react'
import { useLanguage } from '@/context/LanguageContext'

/**
 * A single purchasable combination row in the variant matrix.
 * All editable fields are strings so partially-typed input is never coerced.
 */
export interface VariantMatrixRow {
  /** Stable combination identity: sorted "code=value" pairs joined by "|". */
  key: string
  optionValues: Record<string, string>
  sku: string
  price: string
  priceCustomized?: boolean
  inventory: string
}

export interface VariantMatrixAxis {
  code: string
  name: string
  values: string[]
}

interface VariantMatrixTableProps {
  /** Purchasable axes (code/name/values). The cartesian product drives rows. */
  axes: VariantMatrixAxis[]
  rows: VariantMatrixRow[]
  onChange: (rows: VariantMatrixRow[]) => void
  onUserEdit?: () => void
  /** Defaults applied to newly generated combinations. */
  basePrice: string
  baseInventory: string
  baseSku: string
  currency?: string
  disabled?: boolean
}

/** Stable identity for a combination, independent of axis ordering. */
export function variantCombinationKey(optionValues: Record<string, string>): string {
  return Object.entries(optionValues)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('|')
}

function cartesian(axes: VariantMatrixAxis[]): Array<Record<string, string>> {
  return axes.reduce<Array<Record<string, string>>>(
    (acc, axis) => {
      const next: Array<Record<string, string>> = []
      for (const combo of acc) {
        for (const value of axis.values) {
          next.push({ ...combo, [axis.code]: value })
        }
      }
      return next
    },
    [{}],
  )
}

function generateSku(baseSku: string, optionValues: Record<string, string>): string {
  const base = (baseSku || 'SKU').trim() || 'SKU'
  const suffix = Object.keys(optionValues)
    .sort()
    .map((k) => optionValues[k].toUpperCase().replace(/\s+/g, ''))
    .join('-')
  const combined = `${base}-${suffix}`
  return combined.length > 100 ? combined.substring(0, 100) : combined
}

/**
 * Shopify-style variant matrix: the cartesian product of the configured
 * axes rendered as one row per SKU, each with editable price / inventory /
 * SKU. Fully controlled — the parent owns `rows`; when the axes change we
 * reconcile (preserving edits on surviving combinations, dropping removed
 * ones, appending new ones with base defaults) exactly once per axes change.
 */
export function VariantMatrixTable({
  axes,
  rows,
  onChange,
  onUserEdit,
  basePrice,
  baseInventory,
  baseSku,
  currency = 'CNY',
  disabled = false,
}: VariantMatrixTableProps) {
  const { isZh } = useLanguage()

  // Refs let the reconcile effect read the latest rows/onChange without
  // listing them as deps (which would retrigger the effect after its own
  // onChange call and risk a loop). Refs may only be written inside an
  // effect (React Compiler rule) — this sync effect is declared BEFORE the
  // reconcile effect so it always runs first in the same commit.
  const rowsRef = useRef(rows)
  const onChangeRef = useRef(onChange)
  const defaultsRef = useRef({ basePrice, baseInventory, baseSku })
  useEffect(() => {
    rowsRef.current = rows
    onChangeRef.current = onChange
    defaultsRef.current = { basePrice, baseInventory, baseSku }
  })

  const filledAxes = axes.filter((a) => a.code && a.values.length > 0)
  const axesSig = JSON.stringify(filledAxes.map((a) => [a.code, a.values]))

  useEffect(() => {
    const parsed = JSON.parse(axesSig) as Array<[string, string[]]>
    const nextAxes: VariantMatrixAxis[] = parsed.map(([code, values]) => ({
      code,
      name: code,
      values,
    }))

    const previousByKey = new Map(rowsRef.current.map((r) => [r.key, r]))
    const combos = cartesian(nextAxes)
    const defaults = defaultsRef.current

    const reconciled: VariantMatrixRow[] = combos.map((optionValues) => {
      const key = variantCombinationKey(optionValues)
      const existing = previousByKey.get(key)
      if (existing) {
        return { ...existing, optionValues: { ...optionValues }, price: existing.priceCustomized ? existing.price : defaults.basePrice }
      }
      return {
        key,
        optionValues: { ...optionValues },
        sku: generateSku(defaults.baseSku, optionValues),
        price: defaults.basePrice,
        priceCustomized: false,
        inventory: defaults.baseInventory,
      }
    })

    // Only notify the parent when the shape actually changed, so typing in a
    // cell (which changes rows but not axes) never triggers a rewrite.
    const prev = rowsRef.current
    const unchanged =
      prev.length === reconciled.length &&
      prev.every((r, i) => r.key === reconciled[i].key && r.price === reconciled[i].price)
    if (!unchanged) {
      onChangeRef.current(reconciled)
    }
  }, [axesSig, basePrice])

  const updateRow = (key: string, field: 'sku' | 'price' | 'inventory', value: string) => {
    onUserEdit?.()
    onChange(rows.map((r) => (r.key === key ? { ...r, [field]: value, ...(field === 'price' ? { priceCustomized: true } : {}) } : r)))
  }

  const currencySymbol = currency === 'USD' ? '$' : '¥'

  if (filledAxes.length === 0) return null

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
        <Layers size={14} className="shrink-0 text-[var(--accent-secondary)]" />
        <span>
          {isZh
            ? `按 ${filledAxes.map((a) => a.name).join(' × ')} 生成 ${rows.length} 个 SKU，可逐个调整价格 / 库存 / SKU`
            : `${rows.length} SKUs from ${filledAxes.map((a) => a.name).join(' × ')} — adjust price / stock / SKU per row`}
        </span>
      </div>

      <div className="overflow-x-auto rounded-[var(--radius-card-nested)] border border-[var(--border-subtle)]">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-[var(--border-subtle)] bg-[var(--surface-muted)] font-semibold text-[var(--text-secondary)]">
              <th className="py-2 px-3">{isZh ? '规格组合' : 'Combination'}</th>
              <th className="py-2 px-3">{isZh ? 'SKU 编码' : 'SKU'}</th>
              <th className="py-2 px-3">{isZh ? `售价 (${currencySymbol})` : 'Price'}</th>
              <th className="py-2 px-3">{isZh ? '库存' : 'Stock'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {rows.map((row) => (
              <tr key={row.key} className="transition-colors hover:bg-[var(--surface-muted)]">
                <td className="whitespace-nowrap px-3 py-2 font-medium text-[var(--text-primary)]">
                  {filledAxes.map((a) => row.optionValues[a.code]).filter(Boolean).join(' / ')}
                </td>
                <td className="py-2 px-3">
                  <input
                    type="text"
                    value={row.sku}
                    onChange={(e) => updateRow(row.key, 'sku', e.target.value)}
                    disabled={disabled}
                    className="h-10 w-36 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface)] px-2.5 font-mono text-xs text-[var(--text-primary)] focus-visible:border-[var(--accent-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-secondary)]/15"
                  />
                </td>
                <td className="py-2 px-3">
                  <input
                    type="number"
                    value={row.price}
                    onChange={(e) => updateRow(row.key, 'price', e.target.value)}
                    min="0"
                    step="0.01"
                    placeholder={basePrice || '0.00'}
                    disabled={disabled}
                    className="h-10 w-24 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface)] px-2.5 text-xs font-semibold tabular-nums text-[var(--text-primary)] focus-visible:border-[var(--accent-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-secondary)]/15"
                  />
                </td>
                <td className="py-2 px-3">
                  <input
                    type="number"
                    value={row.inventory}
                    onChange={(e) => updateRow(row.key, 'inventory', e.target.value)}
                    min="0"
                    step="1"
                    placeholder={baseInventory || '0'}
                    disabled={disabled}
                    className="h-10 w-20 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface)] px-2.5 text-xs tabular-nums text-[var(--text-primary)] focus-visible:border-[var(--accent-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-secondary)]/15"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
