'use client'

import React, { useMemo, useState } from 'react'
import {
  Search,
  Package,
  Plus,
  LayoutGrid,
  List,
  Sparkles,
  CheckSquare,
  Square,
  Download,
  Edit2,
  Eye,
} from 'lucide-react'
import { EmptyState } from '@/components/dashboard/kit'
import { useLanguage } from '@/context/LanguageContext'
import Link from 'next/link'
import type { ListingType } from '@/lib/products/listing-type'

export type ProductRow = {
  listingType?: ListingType
  priceMode?: 'amount' | 'inquiry' | 'free'
  id: string
  name: string
  category?: string | null
  price?: number | string | null
  inventory?: number | null
  sku?: string | null
  status?: string | null
  image_url?: string | null
  semantic_data?: unknown
  sales_count?: number
  consumer_visible?: boolean
  channel_visibility_supported?: boolean
}

type FilterStatus = 'all' | 'active' | 'draft' | 'low_stock'

const STATUS_CONFIG: Record<
  string,
  { label: string; bg: string; text: string; border: string; dot: string }
> = {
  active: {
    label: '已发布',
    bg: 'bg-[var(--acid-sage)]',
    text: 'text-[var(--acid-sage)] font-bold',
    border: 'border-[var(--acid-sage)]',
    dot: 'bg-[var(--acid-sage)] ring-2 ring-[var(--acid-sage)]/50 animate-pulse',
  },
  draft: {
    label: '草稿',
    bg: 'bg-[var(--acid-sage)]',
    text: 'text-[var(--acid-sage)] font-bold',
    border: 'border-[var(--acid-sage)]',
    dot: 'bg-[var(--acid-sage)] ring-2 ring-[var(--acid-sage)]/50',
  },
  archived: {
    label: '已下架',
    bg: 'bg-[var(--surface-muted)]',
    text: 'text-[var(--lavender)] font-semibold',
    border: 'border-[var(--surface-muted)]',
    dot: 'bg-[var(--surface-muted)]',
  },
}

export function ProductTable({ products }: { products: ProductRow[] }) {
  const [query, setQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const { t } = useLanguage()

  // 过滤逻辑
  const filtered = useMemo(() => {
    let list = products

    // 状态过滤
    if (filterStatus === 'active') {
      list = list.filter((p) => (p.status || 'active') === 'active')
    } else if (filterStatus === 'draft') {
      list = list.filter((p) => p.status === 'draft')
    } else if (filterStatus === 'low_stock') {
      list = list.filter((p) => (Number(p.inventory) || 0) < 100)
    }

    // 搜索过滤
    const q = query.trim().toLowerCase()
    if (!q) return list
    return list.filter(
      (p) =>
        p.name?.toLowerCase().includes(q) ||
        (p.category ?? '').toLowerCase().includes(q) ||
        (p.sku ?? '').toLowerCase().includes(q)
    )
  }, [products, query, filterStatus])

  const toggleSelectAll = () => {
    if (selectedIds.length === filtered.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(filtered.map((p) => p.id))
    }
  }

  const toggleSelectOne = (id: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item) => item !== id))
    } else {
      setSelectedIds([...selectedIds, id])
    }
  }

  return (
    <div className="space-y-4">
      {/* 搜索栏、状态过滤器与视图切换 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* 状态分类药丸 */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          <FilterPill
            active={filterStatus === 'all'}
            onClick={() => setFilterStatus('all')}
            label="全部商品"
            count={products.length}
          />
          <FilterPill
            active={filterStatus === 'active'}
            onClick={() => setFilterStatus('active')}
            label="已发布"
            count={products.filter((p) => (p.status || 'active') === 'active').length}
          />
          <FilterPill
            active={filterStatus === 'draft'}
            onClick={() => setFilterStatus('draft')}
            label="草稿箱"
            count={products.filter((p) => p.status === 'draft').length}
          />
          <FilterPill
            active={filterStatus === 'low_stock'}
            onClick={() => setFilterStatus('low_stock')}
            label="库存预警"
            count={products.filter((p) => (Number(p.inventory) || 0) < 100).length}
          />
        </div>

        {/* 搜索与视图切换 */}
        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-64">
            <Search
              size={14}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--lavender)] pointer-events-none"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索商品名称、编号或分类..."
              aria-label="搜索商品"
              className="w-full h-9 pl-9 pr-4 rounded-full bg-[var(--surface-muted)]/80 border border-[var(--surface-muted)] text-xs text-[var(--lavender)] placeholder:text-[var(--lavender)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)] focus:border-[var(--primary)] transition-all"
            />
          </div>

          <div className="flex items-center p-0.5 rounded-full bg-[var(--surface-muted)] border border-[var(--surface-muted)] shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-full transition-all cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-[var(--surface)] text-[var(--primary)] shadow-xs font-semibold'
                  : 'text-[var(--lavender)] hover:text-[var(--lavender)]'
              }`}
              title="表格视图"
            >
              <List size={14} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-full transition-all cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-[var(--surface)] text-[var(--primary)] shadow-xs font-semibold'
                  : 'text-[var(--lavender)] hover:text-[var(--lavender)]'
              }`}
              title="网格视图"
            >
              <LayoutGrid size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* 批量操作工具条 (当有选择时浮现) */}
      {selectedIds.length > 0 && (
        <div className="p-3 rounded-xl bg-[var(--surface-muted)] text-[var(--surface)] flex items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2 duration-200 shadow-md">
          <div className="flex items-center gap-2 text-xs font-semibold pl-2">
            <CheckSquare size={16} className="text-[var(--acid-sage)]" />
            <span>已选择 {selectedIds.length} 项商品</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                alert(`已启动 ${selectedIds.length} 个商品的语义重构任务`)
              }
              className="px-3 py-1.5 rounded-full bg-[var(--surface)]/10 hover:bg-[var(--surface)]/20 text-[var(--surface)] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Sparkles size={13} className="text-[var(--acid-sage)]" />
              <span>批量处理</span>
            </button>
            <button
              type="button"
              onClick={() => alert(`正在导出 ${selectedIds.length} 项商品`)}
              className="px-3 py-1.5 rounded-full bg-[var(--surface)]/10 hover:bg-[var(--surface)]/20 text-[var(--surface)] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download size={13} />
              <span>导出数据</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="px-3 py-1.5 rounded-full bg-[var(--surface)] text-[var(--lavender)] hover:bg-[var(--surface-muted)] text-xs font-bold transition-colors cursor-pointer"
            >
              取消选择
            </button>
          </div>
        </div>
      )}

      {/* 内容区域: 表格视图 vs 网格视图 */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Package}
          title={query ? '未找到匹配商品' : t.products.noProducts}
          description={
            query ? '请尝试调整搜索关键词或清除筛选。' : t.products.noProductsDesc
          }
          action={
            !query ? (
              <Link
                href="/dashboard/products/new"
                className="px-5 py-2.5  bg-[var(--primary)] hover:bg-[var(--primary)] text-[var(--surface)] text-xs font-semibold shadow-xs transition-all inline-flex items-center gap-1.5"
              >
                <Plus size={14} />
                <span>{t.products.addProduct}</span>
              </Link>
            ) : undefined
          }
        />
      ) : viewMode === 'table' ? (
        /* 表格视图：无详细描述列，整洁利落的精炼布局 */
        <div className="overflow-x-auto rounded-xl border border-[var(--surface-muted)] bg-[var(--surface)] shadow-2xs">
          <table className="w-full text-left text-xs bg-[var(--surface)]">
            <thead>
              <tr className="border-b border-[var(--surface-muted)] bg-[var(--surface-muted)]/80 text-[var(--lavender)] font-semibold select-none">
                <th className="py-3.5 px-4 w-10 text-center">
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className="text-[var(--lavender)] hover:text-[var(--lavender)] inline-flex items-center justify-center cursor-pointer"
                    title="全选"
                  >
                    {selectedIds.length === filtered.length && filtered.length > 0 ? (
                      <CheckSquare size={16} className="text-[var(--primary)]" />
                    ) : (
                      <Square size={16} />
                    )}
                  </button>
                </th>
                <th className="py-3.5 px-4 font-semibold text-[var(--lavender)] min-w-[220px]">
                  商品名称
                </th>
                <th className="py-3.5 px-4 font-semibold text-[var(--lavender)] min-w-[120px]">
                  商品编号
                </th>
                <th className="py-3.5 px-4 font-semibold text-[var(--lavender)] min-w-[100px]">
                  商品分类
                </th>
                <th className="py-3.5 px-4 font-semibold text-[var(--lavender)] min-w-[90px]">
                  售价
                </th>
                <th className="py-3.5 px-4 font-semibold text-[var(--lavender)] min-w-[90px]">
                  库存
                </th>
                <th className="py-3.5 px-4 font-semibold text-[var(--lavender)] min-w-[100px]">
                  状态
                </th>
                <th className="py-3.5 px-4 font-semibold text-[var(--lavender)] text-right min-w-[110px]">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--surface-muted)]">
              {filtered.map((p) => {
                const isSelected = selectedIds.includes(p.id)
                const statusKey = p.status || 'active'
                const statusInfo = STATUS_CONFIG[statusKey] || {
                  label: statusKey === 'draft' ? '草稿' : '已发布',
                  bg: 'bg-[var(--surface-muted)]',
                  text: 'text-[var(--lavender)]',
                  border: 'border-[var(--surface-muted)]',
                  dot: 'bg-[var(--surface-muted)]',
                }

                return (
                  <tr
                    key={p.id}
                    className={`hover:bg-[var(--surface-muted)]/90 transition-colors ${
                      isSelected ? 'bg-[var(--primary)]/40' : ''
                    }`}
                  >
                    {/* 选择框 */}
                    <td className="py-3.5 px-4 text-center">
                      <button
                        type="button"
                        onClick={(e) => toggleSelectOne(p.id, e)}
                        className="text-[var(--lavender)] hover:text-[var(--lavender)] inline-flex items-center justify-center cursor-pointer"
                      >
                        {isSelected ? (
                          <CheckSquare size={16} className="text-[var(--primary)]" />
                        ) : (
                          <Square size={16} />
                        )}
                      </button>
                    </td>

                    {/* 商品主图 + 名称 (含 Hover 放大预览效果) */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="group/img relative w-10 h-10 rounded-lg bg-[var(--surface-muted)] border border-[var(--surface-muted)] shrink-0 flex items-center justify-center transition-all duration-300 hover:border-[var(--primary)] hover:shadow-md cursor-pointer">
                          {p.image_url ? (
                            <>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={p.image_url}
                                alt={p.name}
                                className="w-full h-full object-cover rounded-md transition-transform duration-300 ease-out group-hover/img:scale-125"
                              />
                              {/* 悬浮弹出高分辨率大图预览框 */}
                              <div className="absolute left-12 top-1/2 -translate-y-1/2 z-50 pointer-events-none opacity-0 invisible group-hover/img:opacity-100 group-hover/img:visible transition-all duration-200 ease-out scale-95 group-hover/img:scale-100">
                                <div className="p-1.5 bg-[var(--surface)] rounded-xl shadow-2xl border border-[var(--surface-muted)] ring-1 ring-[var(--lavender)]/10 backdrop-blur-md">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={p.image_url}
                                    alt={p.name}
                                    className="w-36 h-36 object-cover rounded-lg bg-[var(--surface-muted)] shadow-inner"
                                  />
                                  <div className="mt-1.5 px-1 max-w-[144px]">
                                    <p className="text-[11px] font-bold text-[var(--lavender)] truncate">
                                      {p.name}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </>
                          ) : (
                            <Package size={18} className="text-[var(--lavender)]" />
                          )}
                        </div>

                        <div className="min-w-0 max-w-sm">
                          <Link
                            href={`/dashboard/products/${p.id}/edit`}
                            prefetch={true}
                            className="font-bold text-[var(--lavender)] hover:text-[var(--primary)] transition-colors truncate block"
                            title={p.name}
                          >
                            {p.name}
                          </Link>
                        </div>
                      </div>
                    </td>

                    {/* 商品编号 */}
                    <td className="py-3.5 px-4 font-mono text-[var(--lavender)] font-medium">
                      {p.sku || <span className="text-[var(--lavender)] font-normal">未设置</span>}
                    </td>

                    {/* 商品分类 */}
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-[var(--surface-muted)] text-[11px] font-medium text-[var(--lavender)] border border-[var(--surface-muted)]/60">
                        {p.category || '通用'}
                      </span>
                    </td>

                    {/* 售价 */}
                    <td className="py-3.5 px-4 font-bold text-[var(--lavender)] text-sm">
                      {p.priceMode === 'inquiry' ? '询价' : p.priceMode === 'free' ? '免费' : p.price != null && p.price !== '' ? `¥${Number(p.price).toFixed(2)}` : '—'}
                    </td>

                    {/* 库存 */}
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
                          (Number(p.inventory) || 0) < 100
                            ? 'bg-[var(--acid-sage)] text-[var(--acid-sage)] border border-[var(--acid-sage)]'
                            : 'bg-[var(--acid-sage)] text-[var(--acid-sage)] border border-[var(--acid-sage)]'
                        }`}
                      >
                        {p.inventory ?? 0} 件
                      </span>
                    </td>

                    {/* 状态徽章（视觉高对比区分） */}
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border shadow-2xs ${statusInfo.bg} ${statusInfo.text} ${statusInfo.border}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dot}`} />
                        {statusInfo.label}
                      </span>
                    </td>

                    {/* 操作列 */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/dashboard/products/${p.id}/edit`}
                          prefetch={true}
                          className="p-1.5 text-[var(--lavender)] hover:text-[var(--primary-foreground)] hover:bg-[var(--primary)]  transition-colors"
                          title="编辑商品"
                        >
                          <Edit2 size={14} />
                        </Link>
                        <Link
                          href={`/dashboard/products/${p.id}`}
                          prefetch={true}
                          className="p-1.5 text-[var(--lavender)] hover:text-[var(--lavender)] hover:bg-[var(--surface-muted)]  transition-colors"
                          title="查看"
                        >
                          <Eye size={14} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* 网格卡片视图 */
        <div className="grid gap-3.5 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5">
          {filtered.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              selected={selectedIds.includes(p.id)}
              onToggleSelect={(e) => toggleSelectOne(p.id, e)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function FilterPill({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean
  onClick: () => void
  label: string
  count?: number
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
        active
          ? 'bg-[var(--primary)] text-[var(--surface)] shadow-xs'
          : 'bg-[var(--surface-muted)] text-[var(--lavender)] hover:text-[var(--lavender)] hover:bg-[var(--surface-muted)]'
      }`}
    >
      <span>{label}</span>
      {count != null && (
        <span
          className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
            active ? 'bg-[var(--surface)]/20 text-[var(--surface)]' : 'bg-[var(--surface)] text-[var(--lavender)]'
          }`}
        >
          {count}
        </span>
      )}
    </button>
  )
}

function ProductCard({
  product: p,
  selected,
  onToggleSelect,
}: {
  product: ProductRow
  selected: boolean
  onToggleSelect: (e: React.MouseEvent) => void
}) {
  return (
    <Link
      href={`/dashboard/products/${p.id}/edit`}
      prefetch={true}
      className={`group relative bg-[var(--surface)] border rounded-[8px] p-3 flex flex-col justify-between transition-all duration-200 hover:shadow-md hover:border-[var(--primary)] cursor-pointer ${
        selected
          ? 'border-[var(--primary)] ring-2 ring-[var(--primary)] shadow-xs'
          : 'border-[var(--surface-muted)]'
      }`}
    >
      {/* 顶部多选复选框 */}
      <button
        type="button"
        onClick={onToggleSelect}
        className="absolute top-2.5 left-2.5 z-10 p-1  bg-[var(--surface)]/90 backdrop-blur-xs text-[var(--lavender)] shadow-2xs hover:bg-[var(--surface)] transition-all cursor-pointer"
        title="选择商品"
      >
        {selected ? (
          <CheckSquare size={14} className="text-[var(--primary)]" />
        ) : (
          <Square size={14} className="text-[var(--lavender)]" />
        )}
      </button>

      <div>
        {/* 商品图：方形圆角 + Hover 放大 */}
        <div className="w-full aspect-square rounded-[6px] overflow-hidden bg-[var(--surface-muted)] border border-[var(--surface-muted)] flex items-center justify-center relative">
          {p.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={p.image_url}
              alt={p.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <Package size={24} strokeWidth={1.5} className="text-[var(--lavender)]" />
          )}
        </div>

        <div className="min-w-0 mt-2.5 space-y-1">
          <div className="flex items-center justify-between gap-1 text-[10px]">
            <span className="font-mono text-[var(--lavender)] truncate">
              {p.sku || '未设置'}
            </span>
            <span className="font-semibold text-[var(--lavender)] truncate">
              {p.category || '通用'}
            </span>
          </div>

          <h4
            className="text-xs font-bold text-[var(--lavender)] truncate group-hover:text-[var(--primary)] transition-colors"
            title={p.name}
          >
            {p.name}
          </h4>

          <div className="flex items-center justify-between pt-1">
            <span className="text-xs font-extrabold text-[var(--primary)]">
              {p.priceMode === 'inquiry' ? '询价' : p.priceMode === 'free' ? '免费' : p.price != null && p.price !== '' ? `¥${Number(p.price).toFixed(2)}` : '未定价'}
            </span>
            <span className="text-[10px] text-[var(--lavender)] font-medium">
              库存: {p.inventory ?? 0}
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}
