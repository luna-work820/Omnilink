'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, CheckCircle2, AlertCircle, Loader2, ChevronDown } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useLanguage } from '@/context/LanguageContext'
import { UiverseButton } from '@/components/ui/UiverseButton'

import { ProductMediaSection } from './ProductMediaSection'
import type { ProductAttributeValue } from './ProductAttributesSection'
import { ProductBasicInfo } from '@/components/product/create/ProductBasicInfo'
import type { BasicProductFormData } from '@/components/product/create/types'
import { ProductAttributesPanel, type AttributeRow } from '@/components/product/create/ProductAttributesPanel'
import { VariantMatrixTable, type VariantMatrixRow } from '@/components/product/create/VariantMatrixTable'

import { ProductMediaUploaderRef, ExistingAsset } from '@/components/products/ProductMediaUploader'
import type { ProductOption, ProductVariant } from '@/lib/products/variants/types'
import type { ProductRelation } from '@/lib/products/product-relations'
import { createProductSaveController, type ProductSaveSnapshot } from '@/lib/products/product-save-state'
import { getProductSaveMessage } from '@/lib/products/product-save-errors'
import { saveProductManagement } from '@/lib/products/product-management-save'
import type { ProductManagementModel } from '@/lib/products/product-management-model'
import { DEMO_PRODUCTS } from '@/lib/products/demo-data'
import { MilkdownDetailEditor } from './MilkdownDetailEditor'
import { ProductDocumentsSection } from '@/components/products/ProductDocumentsSection'

const MemoProductMediaSection = React.memo(ProductMediaSection)
const MemoProductAttributesPanel = React.memo(ProductAttributesPanel)

function parseDetailMarkdown(value: string): string {
  if (!value.trim()) return ''
  try {
    const parsed = JSON.parse(value) as { format?: string; source?: unknown; blocks?: unknown }
    if (parsed && parsed.format === 'markdown' && typeof parsed.source === 'string') return parsed.source
    if (parsed && Array.isArray(parsed.blocks)) {
      return parsed.blocks
        .filter((block): block is { type: 'text'; content: string } => Boolean(block && typeof block === 'object' && (block as Record<string, unknown>).type === 'text' && typeof (block as Record<string, unknown>).content === 'string'))
        .map((block) => block.content.replace(/<br\s*\/?>(\n)?/gi, '\n').replace(/<[^>]+>/g, ''))
        .join('\n\n')
    }
  } catch {
    return value
  }
  return value
}

interface ProductWorkspaceProps {
  productId?: string
  initialData?: {
    name: string
    description?: string
    price: number
    currency: string
    inventory: number
    sku?: string
    category?: string
    categoryId?: string | null
    status?: 'active' | 'draft' | 'archived'
    options?: ProductOption[]
    variants?: ProductVariant[]
    existingAssets?: ExistingAsset[]
    detailContent?: string
  }
}

export function ProductWorkspace({ productId, initialData }: ProductWorkspaceProps) {
  const router = useRouter()
  const { isZh } = useLanguage()

  // Match demo product for instant zero-lag rendering
  const demoFallback = React.useMemo(() => {
    if (!productId) return undefined
    return DEMO_PRODUCTS.find(
      (p) => p.id === productId || p.sku.toLowerCase() === productId.toLowerCase()
    )
  }, [productId])

  // Primary form fields
  const [name, setName] = useState(initialData?.name || demoFallback?.name || '')
  const [sku, setSku] = useState(initialData?.sku || demoFallback?.sku || '')
  const [category, setCategory] = useState(initialData?.category || demoFallback?.category || '')
  const [categoryId, setCategoryId] = useState<string | null>(initialData?.categoryId || null)
  const [origin, setOrigin] = useState('')
  const [price, setPrice] = useState<string | number>(initialData?.price ?? demoFallback?.price ?? '')
  const [currency, setCurrency] = useState(initialData?.currency || demoFallback?.currency || 'CNY')
  const [inventory, setInventory] = useState<string | number>(initialData?.inventory ?? demoFallback?.inventory ?? 100)
  const [description, setDescription] = useState(initialData?.description || '')
  const [detailMarkdown, setDetailMarkdown] = useState(() => parseDetailMarkdown(initialData?.detailContent || ''))
  const detailContent = detailMarkdown
  const [status, setStatus] = useState<'active' | 'draft' | 'archived'>(initialData?.status || demoFallback?.status || 'active')

  // Options & Variants
  const [options, setOptions] = useState<ProductOption[]>(() => {
    if (initialData?.options && initialData.options.length > 0) {
      return initialData.options
    }
    return []
  })
  const [variants, setVariants] = useState<ProductVariant[]>(() => {
    if (initialData?.variants && initialData.variants.length > 0) {
      return initialData.variants
    }
    return []
  })

  // Canonical attributes (category-template driven spec editing)
  const [attributeValues, setAttributeValues] = useState<ProductAttributeValue[]>([])
  const [editorRows, setEditorRows] = useState<AttributeRow[]>([])
  const [variantMatrixRows, setVariantMatrixRows] = useState<VariantMatrixRow[]>([])
  // Keys as last loaded from the server — the save routine diffs against
  // these to build the `deletions` list and to detect removed variants.
  const loadedAttributeKeysRef = useRef<string[]>([])
  const loadedVariantIdsRef = useRef<string[]>([])

  // Product Relations
  const [relations, setRelations] = useState<ProductRelation[]>([])

  // SEO State
  const [seoTitle, setSeoTitle] = useState(initialData?.name || demoFallback?.name || '')
  const [seoDescription, setSeoDescription] = useState(initialData?.description || demoFallback?.description || '')

  // Media state & Ref
  const mediaUploaderRef = useRef<ProductMediaUploaderRef>(null)
  const [existingAssets, setExistingAssets] = useState<ExistingAsset[]>(() => {
    if (initialData?.existingAssets && initialData.existingAssets.length > 0) {
      return initialData.existingAssets
    }
    if (demoFallback?.image_url) {
      return [{
        id: 'media-main',
        url: demoFallback.image_url,
        asset_type: 'image',
      }]
    }
    return []
  })

  // Future Preview Modal State
  const [previewMode, setPreviewMode] = useState<'page' | 'info'>('info')

  // Save State Controller
  const saveControllerRef = useRef<ReturnType<typeof createProductSaveController> | null>(null)
  const getSaveController = useCallback(() => {
    if (!saveControllerRef.current) {
      saveControllerRef.current = createProductSaveController(productId ? 'ready' : 'dirty')
    }
    return saveControllerRef.current
  }, [productId])

  const [saveSnapshot, setSaveSnapshot] = useState<ProductSaveSnapshot>(() =>
    createProductSaveController(productId ? 'ready' : 'dirty').reset()
  )

  // Status flags
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Fetch product model and details via canonical loader endpoint
  const loadProductDetails = useCallback(async () => {
    if (!productId) return

    // If it's a demo product, initial states are already set without needing any network calls
    if (demoFallback) {
      setIsLoading(false)
      return
    }

    // Progressive non-blocking background fetch for full management details
    if (!initialData) {
      setIsLoading(true)
    }
    try {
      const [mgmtSettled, assetsSettled, optionsSettled, variantsSettled, relationsSettled, attributesSettled] = await Promise.allSettled([
        fetch(`/api/merchant/products/${productId}/management`),
        fetch(`/api/assets?product_id=${productId}`),
        fetch(`/api/products/${productId}/options`),
        fetch(`/api/products/${productId}/variants`),
        fetch(`/api/merchant/products/${productId}/relations`),
        fetch(`/api/merchant/products/${productId}/canonical-attributes`),
      ])

      if (mgmtSettled.status === 'fulfilled' && mgmtSettled.value.ok) {
        const { model } = (await mgmtSettled.value.json()) as { model: ProductManagementModel }
        if (model) {
          setName(model.name)
          setSku(model.sku || '')
          setDescription(model.description || '')
          setPrice(model.price)
          setCurrency(model.currency)
          setInventory(model.inventory)
          setStatus(model.status)
          setCategory(model.category || '')
          setCategoryId(model.categoryId || null)
          if (model.seo) {
            setSeoTitle(model.seo.title || '')
            setSeoDescription(model.seo.description || '')
          }
          setSaveSnapshot(getSaveController().reset())
        }
      }

      if (assetsSettled.status === 'fulfilled' && assetsSettled.value.ok) {
        const assetsData = await assetsSettled.value.json()
        if (Array.isArray(assetsData)) {
          setExistingAssets(
            assetsData.map((a: any) => ({
              id: a.id,
              url: a.url,
              asset_type: a.asset_type,
            }))
          )
        }
      }

      if (optionsSettled.status === 'fulfilled' && optionsSettled.value.ok) {
        const optionsData = await optionsSettled.value.json()
        if (Array.isArray(optionsData.options)) {
          const nextOptions = optionsData.options as ProductOption[]
          setOptions(nextOptions)
          setEditorRows((current) => [
            ...current.filter((row) => row.role === 'trait'),
            ...nextOptions.map((option) => ({
              id: option.id,
              role: 'variant' as const,
              key: option.code,
              label: option.name,
              value: '',
              values: option.values,
            })),
          ])
        }
      }

      if (variantsSettled.status === 'fulfilled' && variantsSettled.value.ok) {
        const variantsData = await variantsSettled.value.json()
        if (Array.isArray(variantsData.variants)) {
          const nextVariants = variantsData.variants as ProductVariant[]
          setVariants(nextVariants)
          setVariantMatrixRows(nextVariants.map((variant) => ({
            key: Object.entries(variant.option_values).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join('|'),
            optionValues: variant.option_values,
            sku: variant.sku || '',
            price: variant.price == null ? '' : String(variant.price),
            inventory: variant.inventory == null ? '' : String(variant.inventory),
          })))
          loadedVariantIdsRef.current = nextVariants.map((v) => v.id)
        }
      }

      if (attributesSettled.status === 'fulfilled') {
        if (attributesSettled.value.ok) {
          const canonical = await attributesSettled.value.json()
          if (Array.isArray(canonical?.attributes)) {
            const nextAttributes = canonical.attributes as ProductAttributeValue[]
            setAttributeValues(nextAttributes)
            setEditorRows((current) => [
              ...nextAttributes.map((attribute) => ({
                id: `trait-${attribute.fieldKey}`,
                role: 'trait' as const,
                key: attribute.fieldKey,
                label: attribute.label || attribute.fieldKey,
                value: attribute.value,
                values: [],
                unit: attribute.unit || undefined,
              })),
              ...current.filter((row) => row.role === 'variant'),
            ])
            loadedAttributeKeysRef.current = canonical.attributes.map(
              (a: ProductAttributeValue) => a.fieldKey,
            )
          }
        }
      }

      if (relationsSettled.status === 'fulfilled' && relationsSettled.value.ok) {
        const relData = await relationsSettled.value.json()
        if (Array.isArray(relData.relations)) {
          setRelations(relData.relations)
        }
      }
    } catch (err) {
      console.error('Failed to load product details in background:', err)
    } finally {
      setIsLoading(false)
    }
  }, [productId, demoFallback, initialData, getSaveController, isZh])

  useEffect(() => {
    if (productId) {
      loadProductDetails()
    }
  }, [productId, loadProductDetails])

  // Save / Create handler via saveProductManagement
  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setError('')
    setSuccess('')

    if (!name.trim()) {
      const msg = isZh ? '请填写商品名称' : 'Product name is required'
      setError(msg)
      setSaveSnapshot(getSaveController().markFailed(msg))
      return
    }

    if (price === '' || price == null || isNaN(Number(price))) {
      const msg = isZh ? '请填写有效的基础售价' : 'Valid price is required'
      setError(msg)
      setSaveSnapshot(getSaveController().markFailed(msg))
      return
    }

    setIsSaving(true)
    setSaveSnapshot(getSaveController().startSaving())

    try {
      let targetProductId = productId

      if (!targetProductId) {
        // Create Product Shell
        const createRes = await fetch('/api/merchant/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim(),
            sku: sku.trim() || null,
            description: description.trim() || null,
            price: Number(price || 0),
            currency: currency || 'CNY',
            inventory: Number(inventory || 0),
            status,
            category: category || null,
            category_id: categoryId || null,
            raw_data: {
              category,
              category_id: categoryId || null,
              origin,
              detail_content: detailContent,
              detail_content_blocks: { version: 2, format: 'markdown', source: detailMarkdown },
              seo: { title: seoTitle, description: seoDescription },
            },
          }),
        })

        if (!createRes.ok) {
          const body = await createRes.json().catch(() => ({}))
          throw new Error(body?.error || (isZh ? '创建商品失败' : 'Failed to create product'))
        }

        const createData = await createRes.json()
        targetProductId = createData.product?.id || createData.id
      }

      if (!targetProductId) {
        throw new Error(isZh ? '无法获取目标商品ID' : 'Target product ID is missing')
      }

      // Save Product Management (Basic Fields + SEO)
      await saveProductManagement({
        productId: targetProductId,
          basic: {
          name: name.trim(),
          sku: sku.trim() || null,
          description: description.trim() || null,
          price: Number(price || 0),
          currency: currency || 'CNY',
          inventory: Number(inventory || 0),
            status,
            raw_data: {
              category,
              category_id: categoryId || null,
              origin,
              detail_content: detailContent,
              detail_content_blocks: { version: 2, format: 'markdown', source: detailMarkdown },
              seo: { title: seoTitle, description: seoDescription },
            },
          },
        category: category || null,
        categoryId: categoryId || null,
        seo: { title: seoTitle, description: seoDescription },
      })

      // Handle media file upload if there are pending files
      let mediaNotice = ''
      if (targetProductId && mediaUploaderRef.current?.hasPendingFiles()) {
        const uploadRes = await mediaUploaderRef.current.uploadPendingFiles(targetProductId)
        if (uploadRes.failedCount > 0) {
          mediaNotice = isZh
            ? ` (其中 ${uploadRes.failedCount} 张图片上传未成功)`
            : ` (${uploadRes.failedCount} images failed to upload)`
        }
      }

      // Handle Options & Variants persistence:
      //   - options/variants with a `temp-` id are NEW → POST
      //   - variants with a DB id are EXISTING → PATCH (price/stock/SKU edits)
      //   - variants present at load time but now missing → DELETE
      // (Options have no PATCH/DELETE endpoint yet; their edits are
      // intentionally out of scope here. The block also runs when options
      // were CLEARED — the deletion diff below then removes stale variants.)
      if (targetProductId && (options.length > 0 || loadedVariantIdsRef.current.length > 0)) {
        try {
          for (const option of options) {
            if (option.id.startsWith('temp-')) {
              await fetch(`/api/products/${targetProductId}/options`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  name: option.name,
                  code: option.code,
                  position: option.position,
                  values: option.values,
                }),
              })
            }
          }

          for (const variant of variants) {
            if (variant.id.startsWith('temp-')) {
              await fetch(`/api/products/${targetProductId}/variants`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  sku: variant.sku || null,
                  price: variant.price || null,
                  currency: variant.currency,
                  inventory: variant.inventory || null,
                  status: variant.status,
                  option_values: variant.option_values,
                }),
              })
            } else {
              await fetch(`/api/products/${targetProductId}/variants/${variant.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  sku: variant.sku || null,
                  price: variant.price || null,
                  currency: variant.currency,
                  inventory: variant.inventory ?? null,
                  status: variant.status,
                  option_values: variant.option_values,
                }),
              })
            }
          }

          const currentVariantIds = new Set(variants.map((v) => v.id))
          const removedVariantIds = loadedVariantIdsRef.current.filter(
            (id) => !currentVariantIds.has(id),
          )
          for (const removedId of removedVariantIds) {
            await fetch(`/api/products/${targetProductId}/variants/${removedId}`, {
              method: 'DELETE',
            })
          }
          loadedVariantIdsRef.current = variants
            .filter((v) => !v.id.startsWith('temp-'))
            .map((v) => v.id)
        } catch (vErr) {
          console.error('Error saving variants matrix:', vErr)
        }
      }

      // Persist canonical attributes (category-template spec fields) with an
      // explicit deletions diff so removed fields are actually dropped.
      if (targetProductId) {
        try {
          const currentKeys = attributeValues.map((a) => a.fieldKey)
          const deletions = loadedAttributeKeysRef.current.filter(
            (k) => !currentKeys.includes(k),
          )
          const putRes = await fetch(
            `/api/merchant/products/${targetProductId}/canonical-attributes`,
            {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                category: category || undefined,
                category_id: categoryId || undefined,
                attributes: attributeValues,
                deletions: deletions.length > 0 ? deletions : undefined,
              }),
            },
          )
          if (putRes.ok) {
            loadedAttributeKeysRef.current = currentKeys
          } else {
            console.error('Error saving canonical attributes:', await putRes.text())
          }
        } catch (aErr) {
          console.error('Error saving canonical attributes:', aErr)
        }
      }

      // Handle Relations persistence
      if (targetProductId) {
        try {
          await fetch(`/api/merchant/products/${targetProductId}/relations`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ relations }),
          })
        } catch (rErr) {
          console.error('Error saving product relations:', rErr)
        }
      }

      setSaveSnapshot(getSaveController().markSaved())
      setSuccess(
        (productId
          ? isZh
            ? '商品信息已成功更新！'
            : 'Product updated successfully!'
          : isZh
          ? '商品创建成功！已进入编辑模式'
          : 'Product created successfully! Entering edit mode...') + mediaNotice
      )

      router.refresh()
      if (!productId && targetProductId) {
        setTimeout(() => {
          router.push(`/dashboard/products/${targetProductId}/edit`)
        }, 800)
      }
    } catch (err) {
      console.error('Failed saving product:', err)
      const errorMsg = getProductSaveMessage(err)
      setError(errorMsg)
      setSaveSnapshot(getSaveController().markFailed(errorMsg))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form onSubmit={handleSave} className="mx-auto max-w-[1440px] space-y-5 pb-12">
      {/* Top Fixed Header Bar */}
      <div className="sticky top-0 z-20 bg-[var(--surface)]/95 backdrop-blur-md border-b border-[var(--surface-muted)]/90 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-3.5 mb-6 flex items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/products"
            className="w-8 h-8  bg-[var(--surface-muted)] hover:bg-[var(--surface-muted)] border border-[var(--surface-muted)] flex items-center justify-center text-[var(--lavender)] transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--primary)] focus-visible:outline-offset-2"
          >
            <ArrowLeft size={16} />
          </Link>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-base font-bold text-[var(--lavender)] leading-none">
              {productId
                ? name || (isZh ? '未命名商品' : 'Untitled Product')
                : isZh
                ? '新建商品'
                : 'New Product'}
            </h1>
            {/* SKU Badge */}
            <span className="px-2 py-0.5  bg-[var(--surface-muted)] text-[var(--lavender)] border border-[var(--surface-muted)] text-[11px] font-mono">
              {isZh ? '编号' : 'SKU'}: {sku || '—'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Save Status Indicator */}
          {isSaving || saveSnapshot.state === 'saving' ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1  bg-[var(--primary)] text-[var(--primary)] text-xs font-semibold border border-[var(--primary)]">
              <Loader2 size={12} className="animate-spin" />
              <span>{isZh ? '正在保存...' : 'Saving...'}</span>
            </span>
          ) : saveSnapshot.state === 'failed' || error ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1  bg-[var(--plum)] text-[var(--plum)] text-xs font-semibold border border-[var(--plum)]">
              <AlertCircle size={12} />
              <span>{isZh ? '保存失败' : 'Save Failed'}</span>
            </span>
          ) : saveSnapshot.state === 'saved' || success ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1  bg-[var(--acid-sage)] text-[var(--acid-sage)] text-xs font-semibold border border-[var(--acid-sage)]">
              <CheckCircle2 size={12} />
              <span>{isZh ? '已保存' : 'Saved'}</span>
            </span>
          ) : saveSnapshot.dirty ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1  bg-[var(--acid-sage)] text-[var(--acid-sage)] text-xs font-medium border border-[var(--acid-sage)]">
              <span>{isZh ? '有未保存更改' : 'Unsaved Changes'}</span>
            </span>
          ) : null}

          {/* Cancel Button (HP Secondary) */}
          <Link
            href="/dashboard/products"
            className="ui-secondary hidden h-11 items-center justify-center px-4 text-xs font-medium sm:inline-flex"
          >
            {isZh ? '取消' : 'Cancel'}
          </Link>

          {/* Save Button (HP Primary Blue) */}
          <UiverseButton
            type="submit"
            disabled={isSaving || isLoading}
            className="h-11 text-xs"
          >
            {isSaving ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Save size={13} />
            )}
            <span>
              {isSaving
                ? isZh
                  ? '正在保存...'
                  : 'Saving...'
                : productId
                ? isZh
                  ? '保存'
                  : 'Save'
                : isZh
                ? '立即创建商品'
                : 'Create Product'}
            </span>
          </UiverseButton>
        </div>
      </div>

      {/* Non-blocking Banners */}
      {error && (
        <div className="p-4 rounded-xl bg-[var(--plum)] border border-[var(--plum)] text-[var(--plum)] text-xs flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            <span className="font-semibold">{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError('')}
            className="text-[11px] font-semibold text-[var(--plum)] hover:text-[var(--plum)] cursor-pointer"
          >
            {isZh ? '忽略' : 'Dismiss'}
          </button>
        </div>
      )}

      {success && (
        <div className="p-4 rounded-xl bg-[var(--acid-sage)] border border-[var(--acid-sage)] text-[var(--acid-sage)] text-xs flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="shrink-0 text-[var(--acid-sage)]" />
            <span className="font-semibold">{success}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccess('')}
            className="text-[11px] font-semibold text-[var(--acid-sage)] hover:text-[var(--acid-sage)] cursor-pointer"
          >
            {isZh ? '关闭' : 'Close'}
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="min-w-0 space-y-5">
          <ProductBasicInfo
            formData={{
              title: name,
              sku,
              category,
              categoryId,
              price: String(price ?? ''),
              currency: 'CNY',
              origin,
              inventory: String(inventory ?? ''),
              description,
            }}
            knowledgeProductId={productId}
            onChange={(updates: Partial<BasicProductFormData>) => {
              if (updates.title !== undefined) setName(updates.title)
              if (updates.category !== undefined) setCategory(updates.category)
              if (updates.categoryId !== undefined) setCategoryId(updates.categoryId)
              if (updates.price !== undefined) {
                setPrice(updates.price)
                setCurrency('CNY')
              }
              if (updates.inventory !== undefined) setInventory(updates.inventory)
              if (updates.origin !== undefined) setOrigin(updates.origin)
              if (updates.description !== undefined) setDescription(updates.description)
            }}
            disabled={isSaving}
          />

          <div className="space-y-4 rounded-[12px] border border-[var(--border)] bg-[var(--surface)]/40 p-3">
            <MemoProductAttributesPanel
              rows={editorRows}
              onChange={(nextRows) => {
                setEditorRows(nextRows)
                setAttributeValues(
                  nextRows
                    .filter((row) => row.role === 'trait' && row.value.trim())
                    .map((row) => ({
                      fieldKey: row.key,
                      label: row.label,
                      value: row.value,
                      type: row.unit ? 'number' : 'text',
                      unit: row.unit || null,
                      source: 'manual' as const,
                      confidence: 1,
                      isStandard: false,
                    })),
                )
                setOptions(
                  nextRows
                    .filter((row) => row.role === 'variant')
                    .map((row, position) => ({
                      id: options.some((option) => option.id === row.id) ? row.id : `temp-option-${position}`,
                      product_id: productId || '',
                      name: row.label,
                      code: row.key,
                      position,
                      values: row.values,
                      created_at: new Date().toISOString(),
                    })),
                )
              }}
              disabled={isSaving}
            />

            <VariantMatrixTable
              axes={editorRows
                .filter((row) => row.role === 'variant' && row.values.length > 0)
                .map((row) => ({ code: row.key, name: row.label, values: row.values }))}
              rows={variantMatrixRows}
              onChange={(nextRows) => {
                setVariantMatrixRows(nextRows)
                const previousByKey = new Map(
                  variants.map((variant) => [
                    Object.entries(variant.option_values).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join('|'),
                    variant,
                  ]),
                )
                const now = new Date().toISOString()
                setVariants(nextRows.map((row) => {
                  const existing = previousByKey.get(row.key)
                  return {
                    id: existing?.id || `temp-${row.key}`,
                    product_id: productId || '',
                    sku: row.sku || null,
                    price: row.price ? Number(row.price) : null,
                    currency: existing?.currency || 'CNY',
                    inventory: row.inventory ? Number(row.inventory) : null,
                    status: existing?.status || 'draft',
                    option_values: row.optionValues,
                    raw_data: existing?.raw_data || null,
                    semantic_data: existing?.semantic_data || null,
                    created_at: existing?.created_at || now,
                    updated_at: now,
                  }
                }))
              }}
              basePrice={String(price || '')}
              baseInventory={String(inventory || '')}
              baseSku={sku || 'SKU-ITEM'}
              currency="CNY"
              disabled={isSaving}
            />
          </div>

          <section className="space-y-4 pb-8">
            <div className="pb-3">
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">{isZh ? '商品详情' : 'Product description'}</h2>
            </div>
            <MilkdownDetailEditor
              value={detailMarkdown}
              onChange={(value) => {
                setPreviewMode('info')
                setDetailMarkdown(value)
              }}
              onFocus={() => setPreviewMode('info')}
              readOnly={isSaving}
              placeholder={isZh ? '输入商品详情…' : 'Write product details…'}
            />
            <ProductDocumentsSection
              productId={productId}
              productName={name}
              productImageUrl={existingAssets.find((asset) => asset.asset_type === 'image')?.url}
            />
          </section>

        </div>

        <ProductLivePreview
          mode={previewMode}
          onModeChange={setPreviewMode}
          productId={productId}
          mediaUploaderRef={mediaUploaderRef}
          name={name}
          category={category}
          price={price}
          currency={currency}
          inventory={inventory}
          existingAssets={existingAssets}
          attributes={attributeValues}
          detailMarkdown={detailMarkdown}
        />
      </div>

    </form>
  )
}

interface ProductLivePreviewProps {
  mode: 'page' | 'info'
  onModeChange: (mode: 'page' | 'info') => void
  productId?: string
  mediaUploaderRef: React.RefObject<ProductMediaUploaderRef | null>
  name: string
  category: string
  price: string | number
  currency: string
  inventory: string | number
  existingAssets: ExistingAsset[]
  attributes: ProductAttributeValue[]
  detailMarkdown: string
}

const ProductLivePreview = React.memo(function ProductLivePreview({
  mode,
  onModeChange,
  productId,
  mediaUploaderRef,
  name,
  category,
  price,
  currency,
  inventory,
  existingAssets,
  attributes,
  detailMarkdown,
}: ProductLivePreviewProps) {
  const { isZh } = useLanguage()
  const [isPreviewOpen, setIsPreviewOpen] = useState(true)
  const cover = existingAssets.find((asset) => asset.asset_type === 'image')
  const formatPrice = `${currency === 'USD' ? '$' : '¥'}${Number(price || 0).toFixed(2)}`
  const visibleAttributes = attributes.filter((attribute) => attribute.value.trim()).slice(0, 6)

  return (
    <aside className="min-w-0 lg:sticky lg:top-24">
      <div className="overflow-hidden bg-transparent">
        <div className="flex items-center justify-end gap-2 px-4 py-3">
          <div className="flex items-center gap-1 rounded-full bg-[var(--surface-muted)] p-1" role="tablist" aria-label={isZh ? '预览类型' : 'Preview type'}>
            <button type="button" role="tab" aria-selected={mode === 'page'} onClick={() => onModeChange('page')} className={`min-h-8 rounded-full px-3 text-[11px] font-semibold transition-colors ${mode === 'page' ? 'bg-[var(--surface)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}>
              {isZh ? '商品页' : 'Page'}
            </button>
            <button type="button" role="tab" aria-selected={mode === 'info'} onClick={() => onModeChange('info')} className={`min-h-8 rounded-full px-3 text-[11px] font-semibold transition-colors ${mode === 'info' ? 'bg-[var(--surface)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}>
              {isZh ? '商品页信息图' : 'Info graphic'}
            </button>
          </div>
          <button type="button" onClick={() => setIsPreviewOpen((open) => !open)} className="grid h-8 w-8 place-items-center rounded-full text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-[var(--primary)]" aria-expanded={isPreviewOpen} aria-label={isPreviewOpen ? (isZh ? '收起预览' : 'Collapse preview') : (isZh ? '展开预览' : 'Expand preview')} title={isPreviewOpen ? (isZh ? '收起预览' : 'Collapse preview') : (isZh ? '展开预览' : 'Expand preview')}>
            <ChevronDown size={16} className={`transition-transform ${isPreviewOpen ? '' : '-rotate-90'}`} aria-hidden="true" />
          </button>
        </div>

        {isPreviewOpen && (mode === 'page' ? (
          <div className="space-y-3 p-4">
            <MemoProductMediaSection
              productId={productId}
              existingAssets={existingAssets}
              mediaUploaderRef={mediaUploaderRef}
            />
          </div>
        ) : (
          <div className="bg-transparent p-4">
            <div className="mx-auto max-w-[340px] space-y-5">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">{category || (isZh ? '商品信息' : 'Product')}</p>
                <h3 className="mt-2 text-2xl font-semibold leading-tight text-[var(--text-primary)]">{name || (isZh ? '未命名商品' : 'Untitled product')}</h3>
                <div className="mt-5 aspect-[5/3] overflow-hidden rounded-[14px] bg-[var(--surface-muted)]">{cover ? <img src={cover.url} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-xs text-[var(--text-muted)]">{isZh ? '商品媒体' : 'Product media'}</div>}</div>
                <div className="mt-4 flex items-end justify-between"><span className="text-xs text-[var(--text-secondary)]">{isZh ? `库存 ${inventory || 0}` : `${inventory || 0} in stock`}</span><strong className="text-xl text-[var(--text-primary)]">{formatPrice}</strong></div>
                <div className="mt-5 grid grid-cols-2 gap-2">{visibleAttributes.slice(0, 4).map((attribute) => <div key={attribute.fieldKey} className="rounded-[12px] bg-[var(--surface-muted)] p-3"><p className="text-[10px] text-[var(--text-muted)]">{attribute.label || attribute.fieldKey}</p><p className="mt-1 truncate text-xs font-semibold text-[var(--text-primary)]">{attribute.value}{attribute.unit ? ` ${attribute.unit}` : ''}</p></div>)}</div>
              </div>
              {detailMarkdown.trim() && (
                <div className="product-detail-preview pt-2 text-sm leading-7 text-[var(--text-secondary)]">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{detailMarkdown.replace(/<br\s*\/?>(\n)?/gi, '\n')}</ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </aside>
  )
})
