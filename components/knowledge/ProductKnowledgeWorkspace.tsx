'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  ArrowLeft,
  Search,
  Plus,
  X,
  ChevronDown,
  Edit2,
  Download,
  Link2,
} from 'lucide-react'
import { DEMO_PRODUCTS } from '@/lib/products/demo-data'
import type { KnowledgeFileSource, KnowledgeProductBinding } from './types'

interface ProductKnowledgeWorkspaceProps {
  onBack: () => void
  folderTitle?: string
  onRenameFolder?: (newTitle: string) => void
  sources: KnowledgeFileSource[]
  bindings: KnowledgeProductBinding[]
  onRemoveBinding: (sourceId: string, productId: string) => void
  onAddBinding: (sourceId: string, productId: string) => void
  onUploadFile: (fileName: string, productId?: string) => void
  isZh: boolean
}

export function ProductKnowledgeWorkspace({
  onBack,
  folderTitle = '产品知识与 SKU 绑定',
  onRenameFolder,
  sources,
  bindings,
  onRemoveBinding,
  onAddBinding,
  onUploadFile,
}: ProductKnowledgeWorkspaceProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<'bound' | 'general'>('bound')

  // Title linkage state
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [localTitle, setLocalTitle] = useState(folderTitle)

  // Expanded file dropdowns for bound product files
  const [expandedFileIds, setExpandedFileIds] = useState<Set<string>>(new Set(['src-prod-101', 'src-prod-102']))

  // Upload state
  const [uploadTargetProductId, setUploadTargetProductId] = useState<string | null>(null)
  const [isProductModalOpen, setIsProductModalOpen] = useState(false)
  const [productSearchQuery, setProductSearchQuery] = useState('')

  // Drag & Drop + Click Upload
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  // Sync state with product page
  const [syncedDocs, setSyncedDocs] = useState<any[]>([])

  useEffect(() => {
    try {
      const stored = localStorage.getItem('omnilink_synced_product_docs')
      if (stored) {
        setSyncedDocs(JSON.parse(stored))
      }
    } catch (e) {
      console.error(e)
    }

    const handleSync = (event: StorageEvent) => {
      if (event.key !== 'omnilink_synced_product_docs') return
      try {
        const stored = localStorage.getItem('omnilink_synced_product_docs')
        setSyncedDocs(stored ? JSON.parse(stored) : [])
      } catch (e) {
        console.error(e)
      }
    }
    window.addEventListener('storage', handleSync)
    return () => {
      window.removeEventListener('storage', handleSync)
    }
  }, [])

  const processUploadedFiles = (files: FileList | File[]) => {
    const fileArray = Array.from(files)
    if (fileArray.length === 0) return

    fileArray.forEach((file) => {
      onUploadFile(file.name, uploadTargetProductId || undefined)

      try {
        const stored = localStorage.getItem('omnilink_synced_product_docs')
        const currentDocs = stored ? JSON.parse(stored) : []
        const newDoc = {
          id: `doc-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          name: file.name,
          size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
          uploadedAt: '刚刚',
          visibility: 'public',
          type: file.name.toLowerCase().endsWith('.pdf') ? 'pdf' : 'doc',
          productId: uploadTargetProductId || undefined,
        }
        currentDocs.push(newDoc)
        localStorage.setItem('omnilink_synced_product_docs', JSON.stringify(currentDocs))
        setSyncedDocs(currentDocs)
      } catch (e) {
        console.error(e)
      }
    })
    setUploadTargetProductId(null)
  }

  const handleRemoveBinding = (sourceId: string, productId: string) => {
    try {
      const stored = localStorage.getItem('omnilink_synced_product_docs')
      if (stored) {
        const docs = JSON.parse(stored)
        const updatedDocs = docs
          .map((d: any) => {
            if (d.id === sourceId && d.productId === productId) {
              return { ...d, productId: undefined }
            }
            return d
          })
          .filter((d: any) => d.productId !== undefined || d.id.startsWith('src-prod-'))
        localStorage.setItem('omnilink_synced_product_docs', JSON.stringify(updatedDocs))
        setSyncedDocs(updatedDocs)
      }
    } catch (e) {
      console.error(e)
    }
    onRemoveBinding(sourceId, productId)
  }

  const handleAddBinding = (sourceId: string, productId: string) => {
    try {
      const stored = localStorage.getItem('omnilink_synced_product_docs')
      if (stored) {
        const docs = JSON.parse(stored)
        const existing = docs.find((d: any) => d.id === sourceId)
        if (existing) {
          existing.productId = productId
        } else {
          const fileSource = sources.find((s) => s.id === sourceId)
          if (fileSource) {
            docs.push({
              id: fileSource.id,
              name: fileSource.name,
              size: fileSource.size,
              uploadedAt: fileSource.updatedAt,
              visibility: 'public',
              type: fileSource.type,
              productId: productId,
            })
          }
        }
        localStorage.setItem('omnilink_synced_product_docs', JSON.stringify(docs))
        setSyncedDocs(docs)
      }
    } catch (e) {
      console.error(e)
    }
    onAddBinding(sourceId, productId)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processUploadedFiles(e.dataTransfer.files)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processUploadedFiles(e.target.files)
    }
  }

  const handleSaveTitle = () => {
    if (!localTitle.trim()) {
      setIsEditingTitle(false)
      return
    }
    if (onRenameFolder) {
      onRenameFolder(localTitle.trim())
    }
    setIsEditingTitle(false)
  }

  const toggleFileDropdown = (fileId: string) => {
    const next = new Set(expandedFileIds)
    if (next.has(fileId)) {
      next.delete(fileId)
    } else {
      next.add(fileId)
    }
    setExpandedFileIds(next)
  }

  // Combine prop sources and bindings with local syncedDocs
  const mergedSources = [...sources]
  const mergedBindings = [...bindings]

  syncedDocs.forEach((doc) => {
    if (!mergedSources.some((s) => s.id === doc.id)) {
      mergedSources.push({
        id: doc.id,
        name: doc.name,
        type: doc.type || 'pdf',
        size: doc.size || '1.5 MB',
        updatedAt: doc.uploadedAt || '刚刚',
        visibility: doc.visibility === 'public' ? 'customer-facing' : 'internal-private',
        status: 'ready',
        summary: '来自商品管理库上传的规格文件',
      })
    }
    if (
      doc.productId &&
      !mergedBindings.some((b) => b.sourceId === doc.id && b.productId === doc.productId)
    ) {
      mergedBindings.push({
        id: `bind-sync-${doc.id}-${doc.productId}`,
        sourceId: doc.id,
        productId: doc.productId,
        boundAt: doc.uploadedAt || '刚刚',
        matchType: 'manual',
      })
    }
  })

  // Filter sources based on search
  const filteredSources = mergedSources.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Get bound products for a file source
  const getProductsForSource = (sourceId: string) => {
    const productIds = mergedBindings
      .filter((b) => b.sourceId === sourceId)
      .map((b) => b.productId)
    return DEMO_PRODUCTS.filter((p) => productIds.includes(p.id))
  }

  // Categorize files into Bound Files vs General Files
  const boundFileSources = filteredSources.filter((file) => {
    const boundProds = getProductsForSource(file.id)
    return boundProds.length > 0
  })

  const generalFileSources = filteredSources.filter((file) => {
    const boundProds = getProductsForSource(file.id)
    return boundProds.length === 0
  })

  const handleDownloadFile = (file: KnowledgeFileSource, e: React.MouseEvent) => {
    e.stopPropagation()
    const content = `# ${file.name}\n\n${file.summary || '产品知识已完成向量化索引。'}`
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = file.name
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-[var(--surface)] text-[var(--ink)] justify-between overflow-hidden relative">
      {/* 
        TOP HEADER: NotebookLM-style Breadcrumb / Title Bar
        Pure white background, clean border divider
      */}
      <div className="p-3 border-b border-[var(--border)] bg-[var(--surface)] space-y-2 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <button
              type="button"
              id="back-to-sources-btn"
              onClick={onBack}
              className="p-1  bg-[var(--surface-muted)] hover:bg-[var(--border)] text-[var(--ink)] hover:text-[var(--ink)] transition-colors cursor-pointer shrink-0"
              title="返回知识库列表"
            >
              <ArrowLeft size={14} />
            </button>

            {isEditingTitle ? (
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                <input
                  type="text"
                  value={localTitle}
                  onChange={(e) => setLocalTitle(e.target.value)}
                  onBlur={handleSaveTitle}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveTitle()}
                  autoFocus
                  className="h-6 px-2 text-xs font-bold  bg-[var(--surface)] border border-[var(--primary)] text-[var(--ink)] focus:outline-none flex-1 min-w-0"
                />
                <button
                  type="button"
                  onClick={handleSaveTitle}
                  className="px-2 py-0.5  bg-[var(--primary)] hover:bg-[var(--primary)] text-[var(--surface)] text-[10px] font-bold cursor-pointer transition-colors shrink-0"
                >
                  保存
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <h3
                  onClick={() => setIsEditingTitle(true)}
                  className="text-xs font-extrabold text-[var(--ink)] truncate tracking-tight hover:text-[var(--primary)] cursor-pointer transition-colors"
                  title={localTitle}
                >
                  {localTitle}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsEditingTitle(true)}
                  className="p-0.5 text-[var(--lavender)] hover:text-[var(--primary)] transition-colors cursor-pointer shrink-0"
                  title="重命名"
                >
                  <Edit2 size={11} />
                </button>
                <span className="px-1.5 py-0.2 rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] border border-[var(--primary)] text-[10px] font-bold shrink-0">
                  {mergedSources.length} 篇
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Search input */}
        <div className="relative w-full">
          <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--lavender)]" />
          <input
            type="text"
            placeholder="搜索文件或绑定商品..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-6.5 pl-6 pr-2  bg-[var(--surface-muted)] border border-[var(--border)] text-[11px] text-[var(--ink)] placeholder:text-[var(--lavender)] focus:outline-none focus:bg-[var(--surface)] focus:border-[var(--primary)] transition-all"
          />
        </div>

        {/* Tab switcher: 商品关联 vs 全局通用 */}
        <div className="flex items-center gap-1.5 pt-0.5">
          <button
            type="button"
            onClick={() => setActiveTab('bound')}
            className={`px-2 py-1  text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
              activeTab === 'bound'
                ? 'bg-[var(--primary)] text-[var(--surface)] shadow-2xs'
                : 'bg-[var(--surface-muted)] text-[var(--ink)] hover:bg-[var(--border)] hover:text-[var(--ink)]'
            }`}
          >
            <span>商品关联 ({boundFileSources.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={`px-2 py-1  text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
              activeTab === 'general'
                ? 'bg-[var(--primary)] text-[var(--surface)] shadow-2xs'
                : 'bg-[var(--surface-muted)] text-[var(--ink)] hover:bg-[var(--border)] hover:text-[var(--ink)]'
            }`}
          >
            <span>全局通用 ({generalFileSources.length})</span>
          </button>
        </div>
      </div>

      {/* 
        MAIN CONTENT: NotebookLM-style Minimalist Card Rows (NO ICONS)
      */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scroll bg-[var(--surface)]">
        {activeTab === 'bound' ? (
          boundFileSources.length === 0 ? (
            <div className="py-10 text-center text-xs text-[var(--lavender)]">
              暂无关联商品的文件，可通过下方按钮上传并绑定
            </div>
          ) : (
            boundFileSources.map((file) => {
              const boundProducts = getProductsForSource(file.id)
              const isDropdownOpen = expandedFileIds.has(file.id)
              const fileExt = file.name.split('.').pop()?.toUpperCase() || 'FILE'

              return (
                <div
                  key={file.id}
                  className="group relative p-2.5 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-muted)] border border-[var(--border)] hover:border-[var(--primary)] transition-all select-none shadow-2xs space-y-2"
                >
                  {/* Top Row: File Name + Meta + Bound Products trigger */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h4
                        className="text-xs font-bold text-[var(--ink)] group-hover:text-[var(--primary)] transition-colors leading-snug line-clamp-2"
                        title={file.name}
                      >
                        {file.name}
                      </h4>

                      <div className="flex items-center gap-1.5 mt-1 text-[10px] text-[var(--lavender)] flex-wrap">
                        <span className="px-1.5 py-0.2 rounded bg-[var(--surface-muted)] text-[var(--ink)] font-bold text-[9px] uppercase tracking-wide">
                          {fileExt}
                        </span>
                        <span>{file.size}</span>
                        <span>·</span>
                        <span>{file.updatedAt}</span>
                      </div>
                    </div>

                    {/* Bound Products Accordion Trigger Button */}
                    <div
                      onClick={() => toggleFileDropdown(file.id)}
                      className="flex items-center gap-1 px-2 py-1  bg-[var(--primary)] hover:bg-[var(--primary)]/80 border border-[var(--primary)] text-[var(--primary-foreground)] text-[10px] font-bold cursor-pointer transition-colors shrink-0"
                      title="点击展开绑定商品详情"
                    >
                      <Link2 size={11} />
                      <span>{boundProducts.length} 款商品</span>
                      <ChevronDown
                        size={11}
                        className={`transition-transform duration-200 ${
                          isDropdownOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </div>
                  </div>

                  {/* Accordion: Disconnect / Connect SKU Products */}
                  <AnimatePresence>
                    {isDropdownOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="overflow-hidden pt-2 border-t border-[var(--border)] space-y-2"
                      >
                        {/* 1. Bound Products */}
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-[var(--ink)] block">
                            已绑定商品:
                          </span>
                          <div className="space-y-1 max-h-36 overflow-y-auto custom-scroll pr-0.5">
                            {boundProducts.map((p) => (
                              <div
                                key={p.id}
                                className="p-1.5 rounded-[6px] bg-[var(--surface-muted)] border border-[var(--border)] flex items-center justify-between gap-1.5"
                              >
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <img
                                    src={p.image_url}
                                    alt={p.name}
                                    className="w-6 h-6  object-cover border border-[var(--border)] shrink-0"
                                  />
                                  <div className="min-w-0">
                                    <div className="text-[11px] font-semibold text-[var(--ink)] truncate">
                                      {p.name}
                                    </div>
                                    <div className="text-[9px] font-mono text-[var(--lavender)]">
                                      {p.sku}
                                    </div>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveBinding(file.id, p.id)}
                                  className="p-1 rounded-[3px] text-[var(--lavender)] hover:text-[var(--plum)] hover:bg-[var(--plum)] transition-colors cursor-pointer shrink-0"
                                  title="解除绑定"
                                >
                                  <X size={11} strokeWidth={2.5} />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* 2. Add other products */}
                        <div className="space-y-1 pt-1 border-t border-[var(--border)]">
                          <span className="text-[10px] font-bold text-[var(--ink)] block">
                            追加关联商品:
                          </span>
                          <div className="space-y-1 max-h-32 overflow-y-auto custom-scroll pr-0.5">
                            {DEMO_PRODUCTS.filter(
                              (p) => !boundProducts.some((bp) => bp.id === p.id)
                            ).map((p) => (
                              <div
                                key={p.id}
                                className="p-1.5 rounded-[6px] bg-[var(--surface)] hover:bg-[var(--primary)]/40 border border-[var(--border)] flex items-center justify-between gap-1.5 transition-colors"
                              >
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <img
                                    src={p.image_url}
                                    alt={p.name}
                                    className="w-6 h-6  object-cover border border-[var(--border)] shrink-0"
                                  />
                                  <div className="min-w-0">
                                    <div className="text-[11px] text-[var(--ink)] truncate font-medium">
                                      {p.name}
                                    </div>
                                    <div className="text-[9px] font-mono text-[var(--lavender)]">
                                      {p.sku}
                                    </div>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleAddBinding(file.id, p.id)}
                                  className="px-1.5 py-0.5 rounded-[3px] bg-[var(--primary)] hover:bg-[var(--primary)] text-[var(--primary-foreground)] hover:text-[var(--surface)] text-[10px] font-bold cursor-pointer transition-colors shrink-0"
                                >
                                  + 关联
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )
            })
          )
        ) : (
          generalFileSources.length === 0 ? (
            <div className="py-10 text-center text-xs text-[var(--lavender)]">
              暂无全局通用文件，通用文件将自动共享给所有产品的 AI 研报推理。
            </div>
          ) : (
            generalFileSources.map((file) => {
              const fileExt = file.name.split('.').pop()?.toUpperCase() || 'FILE'
              return (
                <div
                  key={file.id}
                  className="group relative p-2.5 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-muted)] border border-[var(--border)] hover:border-[var(--primary)] transition-all select-none shadow-2xs flex items-center justify-between gap-2"
                >
                  <div className="min-w-0 flex-1">
                    <h4
                      className="text-xs font-bold text-[var(--ink)] group-hover:text-[var(--primary)] transition-colors leading-snug line-clamp-2"
                      title={file.name}
                    >
                      {file.name}
                    </h4>

                    <div className="flex items-center gap-1.5 mt-1 text-[10px] text-[var(--lavender)] flex-wrap">
                      <span className="px-1.5 py-0.2 rounded bg-[var(--primary)] text-[var(--primary-foreground)] font-bold text-[9px] uppercase tracking-wide border border-[var(--primary)]">
                        全系通用
                      </span>
                      <span className="px-1.5 py-0.2 rounded bg-[var(--surface-muted)] text-[var(--ink)] font-bold text-[9px] uppercase tracking-wide">
                        {fileExt}
                      </span>
                      <span>{file.size}</span>
                      <span>·</span>
                      <span>{file.updatedAt}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => handleDownloadFile(file, e)}
                    className="p-1 rounded-[3px] text-[var(--lavender)] hover:text-[var(--ink)] hover:bg-[var(--surface-muted)] transition-colors cursor-pointer shrink-0"
                    title="下载/预览文档"
                  >
                    <Download size={12} />
                  </button>
                </div>
              )
            })
          )
        )}
      </div>

      {/* 
        BOTTOM UPLOAD AREA: NotebookLM-style Pure White Upload Card
      */}
      <div className="p-2.5 border-t border-[var(--border)] bg-[var(--surface)] shrink-0">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileChange}
          className="hidden"
        />
        <div
          onClick={() => {
            if (activeTab === 'bound') {
              setProductSearchQuery('')
              setIsProductModalOpen(true)
            } else {
              setUploadTargetProductId(null)
              setTimeout(() => {
                fileInputRef.current?.click()
              }, 50)
            }
          }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`w-full py-2.5 px-2 rounded-xl border border-dashed transition-all flex items-center justify-center gap-1.5 cursor-pointer select-none text-center ${
            isDragging
              ? 'border-[var(--primary)] bg-[var(--primary)]/50 scale-[1.01]'
              : 'border-[var(--border)] hover:border-[var(--primary)] bg-[var(--surface)] hover:bg-[var(--primary)]/20'
          }`}
          title="点击或拖拽上传产品资料"
        >
          <div className="w-5 h-5  bg-[var(--primary)] text-[var(--primary-foreground)] flex items-center justify-center shrink-0">
            <Plus size={13} strokeWidth={2.5} />
          </div>
          <span className="text-[11px] font-bold text-[var(--ink)] group-hover:text-[var(--primary)]">
            {activeTab === 'bound' ? '上传并绑定商品资料' : '上传全系通用产品文档'}
          </span>
        </div>
      </div>

      {/* PRODUCT SELECTION MODAL */}
      <AnimatePresence>
        {isProductModalOpen && (
          <div className="absolute inset-0 z-50 flex flex-col bg-[var(--ink)]/30 backdrop-blur-xs p-3 justify-between">
            <div className="flex-1 flex flex-col min-h-0 bg-[var(--surface)] rounded-xl p-3.5 border border-[var(--border)] shadow-2xl">
              {/* Header */}
              <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
                <span className="text-xs font-extrabold text-[var(--ink)]">
                  选择要绑定的商品
                </span>
                <button
                  type="button"
                  onClick={() => setIsProductModalOpen(false)}
                  className="p-1  hover:bg-[var(--surface-muted)] text-[var(--lavender)] hover:text-[var(--ink)] transition-colors cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative mt-2 mb-2">
                <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--lavender)]" />
                <input
                  type="text"
                  value={productSearchQuery}
                  onChange={(e) => setProductSearchQuery(e.target.value)}
                  placeholder="搜索商品名或 SKU 编号..."
                  className="w-full h-7 pl-7 pr-2  bg-[var(--surface-muted)] border border-[var(--border)] text-xs text-[var(--ink)] placeholder:text-[var(--lavender)] focus:outline-none focus:bg-[var(--surface)] focus:border-[var(--primary)]"
                  autoFocus
                />
              </div>

              {/* Product List */}
              <div className="flex-1 overflow-y-auto custom-scroll space-y-1 pr-0.5">
                {DEMO_PRODUCTS.filter((p) => {
                  const query = productSearchQuery.toLowerCase()
                  return (
                    p.name.toLowerCase().includes(query) ||
                    p.sku.toLowerCase().includes(query)
                  )
                }).length === 0 ? (
                  <div className="py-8 text-center text-xs text-[var(--lavender)]">
                    未找到相匹配的商品
                  </div>
                ) : (
                  DEMO_PRODUCTS.filter((p) => {
                    const query = productSearchQuery.toLowerCase()
                    return (
                      p.name.toLowerCase().includes(query) ||
                      p.sku.toLowerCase().includes(query)
                    )
                  }).map((p) => (
                    <div
                      key={p.id}
                      onClick={() => {
                        setUploadTargetProductId(p.id)
                        setIsProductModalOpen(false)
                        setTimeout(() => {
                          fileInputRef.current?.click()
                        }, 120)
                      }}
                      className="p-2 rounded-[8px] hover:bg-[var(--primary)]/50 border border-transparent hover:border-[var(--primary)] flex items-center justify-between gap-2 cursor-pointer transition-all"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <img
                          src={p.image_url}
                          alt={p.name}
                          className="w-8 h-8  object-cover border border-[var(--border)] shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold text-[var(--ink)] truncate">
                            {p.name}
                          </div>
                          <div className="text-[10px] font-mono text-[var(--lavender)]">
                            {p.sku}
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] text-[var(--primary-foreground)] font-bold bg-[var(--primary)] px-2 py-0.5  shrink-0 border border-[var(--primary)]">
                        选择并上传
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
