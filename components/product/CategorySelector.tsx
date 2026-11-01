'use client'

import React, { useState, useMemo, useEffect, useRef } from 'react'
import {
  Search,
  Check,
  ChevronRight,
  Sparkles,
  X,
  Layers,
  Shirt,
  Smartphone,
  Compass,
  Glasses,
  Home,
  Coffee,
  Baby,
  Dog,
  Car,
  Tag,
} from 'lucide-react'
import { useLanguage } from '@/context/LanguageContext'
import {
  Category,
  getCategoryTree,
  searchCategories,
  getCategoryBreadcrumb,
  getCategoryById,
} from '@/lib/product/categories'

export interface SelectedCategoryResult {
  categoryId: string
  categoryName: string
  parentName?: string
  fullPath: string
  templateKey?: string | null
}

export interface CategorySelectorProps {
  value?: string // categoryId or categoryName
  onChange: (result: SelectedCategoryResult) => void
  onClear?: () => void
  disabled?: boolean
  className?: string
  placeholder?: string
  id?: string
}

// Icon mapping helper
const ICON_MAP: Record<string, React.ElementType> = {
  Shirt,
  Smartphone,
  Sparkles,
  Compass,
  Glasses,
  Home,
  Coffee,
  Baby,
  Dog,
  Car,
  Layers,
}

export function CategorySelector({
  value,
  onChange,
  onClear,
  disabled = false,
  className = '',
  placeholder,
  id = 'category-selector',
}: CategorySelectorProps) {
  const { isZh } = useLanguage()
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedL1Id, setSelectedL1Id] = useState<string>('cat-apparel')
  const [recentCategories, setRecentCategories] = useState<Category[]>([])

  const containerRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // 1. Category Tree
  const categoryTree = useMemo(() => getCategoryTree(), [])

  // 2. Load recent categories from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('omnilink_recent_categories')
      if (saved) {
        const ids: string[] = JSON.parse(saved)
        const matched = ids
          .map((id) => getCategoryById(id))
          .filter((c): c is Category => Boolean(c))
        setRecentCategories(matched.slice(0, 5))
      }
    } catch {
      // Ignore local storage error
    }
  }, [])

  const saveRecentCategory = (cat: Category) => {
    try {
      const current = recentCategories.filter((c) => c.id !== cat.id)
      const next = [cat, ...current].slice(0, 5)
      setRecentCategories(next)
      localStorage.setItem('omnilink_recent_categories', JSON.stringify(next.map((c) => c.id)))
    } catch {
      // Ignore
    }
  }

  // 3. Current selection resolution
  const currentBreadcrumb = useMemo(() => {
    return getCategoryBreadcrumb(value)
  }, [value])

  // Sync selected L1 when value or currentBreadcrumb changes
  useEffect(() => {
    if (currentBreadcrumb?.primary?.id) {
      setSelectedL1Id(currentBreadcrumb.primary.id)
    }
  }, [currentBreadcrumb])

  // 4. Search results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return []
    return searchCategories(searchQuery)
  }, [searchQuery])

  // 5. Active L1's children (L2)
  const activeL1 = useMemo(() => {
    return categoryTree.find((c) => c.id === selectedL1Id) || categoryTree[0]
  }, [categoryTree, selectedL1Id])

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Focus search input on open
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus()
      }, 100)
    }
  }, [isOpen])

  const handleSelectCategory = (child: Category, parent?: Category) => {
    const parentCat = parent || (child.parentId ? getCategoryById(child.parentId) : null) || activeL1
    const fullPath = parentCat && parentCat.id !== child.id ? `${parentCat.name} > ${child.name}` : child.name

    saveRecentCategory(child)
    onChange({
      categoryId: child.id,
      categoryName: child.name,
      parentName: parentCat?.name,
      fullPath,
      templateKey: child.templateKey || null,
    })

    setIsOpen(false)
    setSearchQuery('')
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onClear) {
      onClear()
    } else {
      onChange({
        categoryId: '',
        categoryName: '',
        fullPath: '',
        templateKey: null,
      })
    }
  }

  // Display text in trigger
  const displayValue = useMemo(() => {
    if (!currentBreadcrumb) {
      return value ? String(value) : ''
    }
    if (currentBreadcrumb.secondary) {
      return `${currentBreadcrumb.primary.name} > ${currentBreadcrumb.secondary.name}`
    }
    return currentBreadcrumb.primary.name
  }, [currentBreadcrumb, value])

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Trigger Button */}
      <div
        id={id}
        onClick={() => {
          if (!disabled) setIsOpen(!isOpen)
        }}
        className={`flex min-h-11 w-full cursor-pointer select-none items-center justify-between gap-2 rounded-[var(--radius-control)] border bg-[var(--surface)] px-3.5 py-2 transition-colors ${
          disabled
            ? 'cursor-not-allowed border-[var(--border-subtle)] opacity-60'
            : isOpen
            ? 'border-[var(--accent-secondary)] ring-2 ring-[var(--accent-secondary)]/15'
            : 'cursor-pointer border-[var(--border-subtle)] hover:border-[var(--accent-secondary)]'
        }`}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Tag size={16} className={displayValue ? 'shrink-0 text-[var(--accent-secondary)]' : 'shrink-0 text-[var(--text-muted)]'} />
          {displayValue ? (
            <div className="flex items-center gap-1.5 min-w-0">
              {currentBreadcrumb?.primary && currentBreadcrumb.secondary ? (
                <>
              <span className="truncate text-sm text-[var(--text-secondary)]">{currentBreadcrumb.primary.name}</span>
                  <span className="text-sm text-[var(--text-muted)]">/</span>
              <span className="truncate text-sm font-medium text-[var(--text-primary)]">
                    {currentBreadcrumb.secondary.name}
                  </span>
                  {currentBreadcrumb.secondary.templateKey && (
                    <span className="shrink-0 text-[10px] font-medium bg-[var(--primary)]/10 text-[var(--primary)] px-1.5 py-0.5 rounded-[3px] border border-[var(--primary)]/20 ml-1">
                      {isZh ? '规格模版' : 'Template'}
                    </span>
                  )}
                </>
              ) : (
              <span className="truncate text-sm font-medium text-[var(--text-primary)]">{displayValue}</span>
              )}
            </div>
          ) : (
            <span className="text-sm text-[var(--text-muted)]">
              {placeholder || (isZh ? '点击选择商品分类（两级体系 + 快速检索）' : 'Select product category...')}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {displayValue && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 text-[var(--lavender)] hover:text-[var(--lavender)] hover:bg-[var(--surface-muted)] rounded-md transition-colors"
              title={isZh ? '清除分类' : 'Clear'}
            >
              <X size={13} />
            </button>
          )}
          <ChevronRight
            size={15}
            className={`text-[var(--lavender)] transition-transform duration-200 ${isOpen ? 'rotate-90 text-[var(--primary)]' : ''}`}
          />
        </div>
      </div>

      {/* Compact admin taxonomy picker: search + two-level taxonomy, inspired by Medusa/Spree. */}
      {isOpen && (
        <div className="absolute z-50 left-0 w-[min(580px,calc(100vw-32px))] mt-2 bg-[var(--surface)] rounded-[12px] border border-[var(--surface-muted)] shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Header & Search Bar */}
          <div className="p-3 border-b border-[var(--surface-muted)] bg-[var(--surface-muted)]/70 space-y-2.5">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--lavender)]" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isZh ? '搜索分类关键词（如：连衣裙、耳机、太阳镜、猫粮、面部护肤）...' : 'Search category keywords...'}
                className="h-11 w-full rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface)] pl-9 pr-8 text-sm text-[var(--text-primary)] shadow-sm transition-colors focus-visible:border-[var(--accent-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-secondary)]/15"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--lavender)] hover:text-[var(--lavender)] p-1"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Quick Pills: Recent / Popular Categories */}
            {!searchQuery && (
              <div className="space-y-2">
                {recentCategories.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] font-semibold text-[var(--lavender)] shrink-0">
                      {isZh ? '最近常用:' : 'Recent:'}
                    </span>
                    {recentCategories.map((rc) => {
                      const isSelected = currentBreadcrumb?.secondary?.id === rc.id || value === rc.name
                      return (
                        <button
                          key={`recent-${rc.id}`}
                          type="button"
                          onClick={() => handleSelectCategory(rc)}
                            className={`text-[11px] px-2 py-1  border transition-all flex items-center gap-1 cursor-pointer ${
                            isSelected
                              ? 'bg-[var(--surface-muted)] text-[var(--primary)] border-[var(--primary)]/50 font-bold shadow-2xs'
                              : 'bg-[var(--surface)] text-[var(--lavender)] border-[var(--surface-muted)] hover:border-[var(--surface-muted)] hover:bg-[var(--surface-muted)]'
                          }`}
                        >
                          <span>{rc.name}</span>
                        </button>
                      )
                    })}
                  </div>
                )}

              </div>
            )}
          </div>

          {/* Search Result View vs 2-Level Cascade View */}
          {searchQuery ? (
            <div className="max-h-[320px] overflow-y-auto p-2 divide-y divide-[var(--surface-muted)]">
              {searchResults.length > 0 ? (
                searchResults.map((res) => {
                  const isSelected = currentBreadcrumb?.secondary?.id === res.category.id || value === res.category.name
                  return (
                    <div
                      key={`search-${res.category.id}`}
                      onClick={() => handleSelectCategory(res.category, res.parent || undefined)}
                      className={`flex cursor-pointer items-center justify-between rounded-[var(--radius-card-nested)] p-2.5 transition-colors ${
                        isSelected ? 'bg-[var(--primary)]/10 text-[var(--primary)]' : 'hover:bg-[var(--surface-muted)] text-[var(--lavender)]'
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold">{res.displayPath}</span>
                          {res.category.templateKey && (
                            <span className="text-[10px] font-medium bg-[var(--primary)]/10 text-[var(--primary)] px-1.5 py-0.5 ">
                              {isZh ? '属性模板' : 'Template'}
                            </span>
                          )}
                        </div>
                        {res.matchedKeyword && (
                          <div className="text-[11px] text-[var(--lavender)]">
                            {isZh ? '匹配标签: ' : 'Matched: '}
                            <span className="text-[var(--primary)] font-medium">{res.matchedKeyword}</span>
                          </div>
                        )}
                      </div>

                      {isSelected && <Check size={16} className="text-[var(--primary)] shrink-0" />}
                    </div>
                  )
                })
              ) : (
                <div className="py-12 text-center text-[var(--lavender)] text-xs space-y-1.5">
                  <p className="font-semibold text-[var(--lavender)]">{isZh ? '未找到相关分类' : 'No matching categories'}</p>
                  <p className="text-[11px] text-[var(--lavender)]">
                    {isZh ? '可尝试搜索其他词汇或浏览下方两级类目' : 'Try other keywords or browse 2-level taxonomy'}
                  </p>
                </div>
              )}
            </div>
          ) : (
            /* Two-level cascade: the same dense taxonomy pattern used by commerce admin panels. */
            <div className="grid grid-cols-12 h-[286px] divide-x divide-[var(--surface-muted)]">
              {/* Left Column: Level 1 Categories (一级分类) */}
              <div className="col-span-5 sm:col-span-4 bg-[var(--surface-muted)]/80 overflow-y-auto p-2 space-y-0.5">
                {categoryTree.map((l1) => {
                  const isCurrent = l1.id === selectedL1Id
                  const IconComp = (l1.icon && ICON_MAP[l1.icon]) || Layers

                  return (
                    <button
                      key={l1.id}
                      type="button"
                      onClick={() => setSelectedL1Id(l1.id)}
                      className={`w-full px-2.5 py-2 rounded-[5px] text-left text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                        isCurrent
                          ? 'bg-[var(--surface)] text-[var(--primary)] shadow-xs font-bold border-l-3 border-l-[var(--primary)]'
                          : 'text-[var(--lavender)] hover:bg-[var(--surface-muted)] hover:text-[var(--lavender)]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <IconComp size={15} className={isCurrent ? 'text-[var(--primary)]' : 'text-[var(--lavender)]'} />
                        <span className="truncate">{l1.name}</span>
                      </div>
                      <ChevronRight
                        size={13}
                        className={`transition-colors shrink-0 ${isCurrent ? 'text-[var(--primary)]' : 'text-[var(--lavender)]'}`}
                      />
                    </button>
                  )
                })}
              </div>

              {/* Right Column: Level 2 Categories (二级分类) */}
              <div className="col-span-7 sm:col-span-8 bg-[var(--surface)] overflow-y-auto p-2.5">
                <div className="pb-1.5 px-1 text-[11px] font-semibold text-[var(--lavender)]">
                  {activeL1?.name}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 pt-1">
                  {activeL1?.children.map((child) => {
                    const isSelected = currentBreadcrumb?.secondary?.id === child.id || value === child.name
                    return (
                      <button
                        key={child.id}
                        type="button"
                        onClick={() => handleSelectCategory(child, activeL1)}
                        className={`p-2 rounded-[5px] border text-left transition-all flex items-center justify-between gap-2 cursor-pointer ${
                          isSelected
                            ? 'bg-[var(--surface-muted)] border-[var(--primary)] text-[var(--primary)] shadow-xs font-bold'
                            : 'bg-[var(--surface)] border-[var(--surface-muted)] hover:border-[var(--surface-muted)] hover:bg-[var(--surface-muted)]/80 text-[var(--lavender)]'
                        }`}
                      >
                        <div className="min-w-0 text-[11px] font-semibold truncate">{child.name}</div>

                        {isSelected && <Check size={15} className="text-[var(--primary)] shrink-0" />}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  )
}
