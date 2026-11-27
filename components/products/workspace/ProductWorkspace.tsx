'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, CheckCircle2, AlertCircle, Loader2, Plus, X } from 'lucide-react'
import { useLanguage } from '@/context/LanguageContext'
import { UiverseButton } from '@/components/ui/UiverseButton'

import { ProductMediaSection } from './ProductMediaSection'
import type { ProductAttributeValue } from './ProductAttributesSection'
import { ProductBasicInfo } from '@/components/product/create/ProductBasicInfo'
import { ProductListingTypeSelector } from '@/components/product/create/ProductListingTypeSelector'
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
import { buildProductDetailsPayload } from '@/lib/products/product-details-payload'
import { applyCategoryAttributePreset } from '@/lib/products/category-attribute-presets'
import { productTypeFromCategory, virtualCategoryFromKind } from '@/lib/products/virtual-product-category'
import { validOutboundUrl } from '@/lib/products/outbound-links'
import { listingTypeFromCatalog, type ListingType } from '@/lib/products/listing-type'

const MemoProductAttributesPanel = React.memo(ProductAttributesPanel)
const MemoProductMediaSection = React.memo(ProductMediaSection)

function PlatformPicker({ value, disabledPlatform, disabled, onChange }: { value: OutboundPlatform; disabledPlatform?: OutboundPlatform; disabled?: boolean; onChange: (platform: OutboundPlatform) => void }) {
  const [isOpen, setIsOpen] = useState(false)
  const platformLabel = value === 'xiaohongshu' ? '小红书' : '抖音'
  return <div className="relative">
    <button type="button" aria-haspopup="listbox" aria-expanded={isOpen} aria-label={`平台：${platformLabel}`} onClick={() => setIsOpen((open) => !open)} disabled={disabled} className="flex h-11 w-full items-center justify-between gap-2 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-white px-3 text-sm text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-[var(--brand-primary)] disabled:opacity-50">
      <span className="flex items-center gap-2"><PlatformMark platform={value} /><span>{platformLabel}</span></span><span aria-hidden="true" className="text-xs text-[var(--text-muted)]">⌄</span>
    </button>
    {isOpen && <div role="listbox" aria-label="选择平台" className="absolute left-0 top-full z-20 mt-1 w-full border border-[var(--border)] bg-white p-1 shadow-md">
      {(['xiaohongshu', 'douyin'] as const).map((platform) => <button key={platform} type="button" role="option" aria-selected={value === platform} disabled={platform === disabledPlatform} onClick={() => { onChange(platform); setIsOpen(false) }} className="flex min-h-9 w-full items-center gap-2 px-2 text-left text-sm hover:bg-[var(--surface-muted)] disabled:cursor-not-allowed disabled:opacity-40"><PlatformMark platform={platform} />{platform === 'xiaohongshu' ? '小红书' : '抖音'}</button>)}
    </div>}
  </div>
}

function PlatformMark({ platform }: { platform: OutboundPlatform }) {
  return platform === 'xiaohongshu'
    ? <span aria-hidden="true" className="grid size-5 place-items-center rounded-sm bg-[#ff2442] text-[10px] font-bold leading-none text-white">书</span>
    : <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5"><path fill="#25F4EE" d="M13.2 2v12.1a3.2 3.2 0 1 1-2.4-3.1V8.5a7 7 0 1 0 5.7 6.9V8.2a9.6 9.6 0 0 0 4.2 1.1V5.8A5.7 5.7 0 0 1 16.5 2h-3.3Z"/><path fill="#FE2C55" d="M15.2 2v12.1a3.2 3.2 0 1 1-2.4-3.1V8.5a7 7 0 1 0 5.7 6.9V8.2a9.6 9.6 0 0 0 4.2 1.1V5.8A5.7 5.7 0 0 1 18.5 2h-3.3Z"/><path fill="#111" d="M14.2 2v12.1a3.2 3.2 0 1 1-2.4-3.1V8.5a7 7 0 1 0 5.7 6.9V8.2a9.6 9.6 0 0 0 4.2 1.1V5.8A5.7 5.7 0 0 1 17.5 2h-3.3Z"/></svg>
}

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
    origin?: string
    status?: 'active' | 'draft' | 'archived'
    itemType?: 'product' | 'service'
    deliveryType?: 'physical' | 'digital' | 'ai_capability'
    capabilityKind?: 'question_set' | 'skill' | 'plugin'
    options?: ProductOption[]
    variants?: ProductVariant[]
    existingAssets?: ExistingAsset[]
    detailContent?: string
    priceMode?: 'amount' | 'inquiry' | 'free'
    outboundLinks?: Record<string, string>
  }
}

type OutboundPlatform = 'xiaohongshu' | 'douyin'
type ProductChannelLink = { platform: OutboundPlatform; url: string }

function readChannelLinks(value?: Record<string, string>): ProductChannelLink[] {
  const links = (['xiaohongshu', 'douyin'] as const)
    .map((platform) => ({ platform, url: value?.[platform]?.trim() ?? '' }))
    .filter((link) => link.url)
  return links.length ? links : [{ platform: 'xiaohongshu', url: '' }]
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
  const initialVirtualCategory = initialData?.deliveryType === 'ai_capability' ? virtualCategoryFromKind(initialData.capabilityKind || 'skill') : null
  const [category, setCategory] = useState(initialVirtualCategory?.name || initialData?.category || demoFallback?.category || '')
  const [categoryId, setCategoryId] = useState<string | null>(initialVirtualCategory?.id || initialData?.categoryId || null)
  const [origin, setOrigin] = useState(initialData?.origin || '')
  const [price, setPrice] = useState<string | number>(initialData?.price ?? demoFallback?.price ?? '')
  const [priceMode, setPriceMode] = useState<'amount' | 'inquiry' | 'free'>(initialData?.priceMode ?? 'amount')
  const [channelLinks, setChannelLinks] = useState<ProductChannelLink[]>(() => readChannelLinks(initialData?.outboundLinks))
  const [currency, setCurrency] = useState(initialData?.currency || demoFallback?.currency || 'CNY')
  const [inventory, setInventory] = useState<string | number>(initialData?.inventory ?? demoFallback?.inventory ?? 0)
  const [description, setDescription] = useState(initialData?.description || '')
  const [detailMarkdown] = useState(() => parseDetailMarkdown(initialData?.detailContent || ''))
  const [status, setStatus] = useState<'active' | 'draft' | 'archived'>(initialData?.status || demoFallback?.status || 'draft')
  const [deliveryType, setDeliveryType] = useState<'physical' | 'digital' | 'ai_capability'>(initialData?.deliveryType || 'physical')
  const [itemType, setItemType] = useState<'product' | 'service'>(initialData?.itemType || 'product')
  const [capabilityKind, setCapabilityKind] = useState<'question_set' | 'skill' | 'plugin'>(initialData?.capabilityKind || 'skill')
  const listingType = listingTypeFromCatalog(itemType, deliveryType)

  const selectListingType = (next: ListingType) => {
    if (next === listingType) return
    markEdited()
    setItemType(next === 'service' ? 'service' : 'product')
    setDeliveryType(next === 'digital' ? 'digital' : 'physical')
    setCategory('')
    setCategoryId(null)
    setOrigin('')
    updateAttributeRows([])
    setVariantMatrixRows([])
  }

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
  const loadRequestRef = useRef(0)

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
  const [saveIntent, setSaveIntent] = useState<'draft' | 'publish' | null>(null)
  const [recoverableProductId, setRecoverableProductId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(Boolean(productId && !demoFallback))
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const markEdited = useCallback(() => {
    setSaveSnapshot(getSaveController().markDirty())
  }, [getSaveController])

  const handleDelete = async () => {
    if (!productId || isSaving) return
    const confirmed = window.confirm(isZh ? '确定删除这个商品吗？删除后无法恢复。' : 'Delete this product? This cannot be undone.')
    if (!confirmed) return
    setIsSaving(true)
    setError('')
    try {
      const response = await fetch(`/api/merchant/products/${productId}`, {
        method: 'DELETE',
      })
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || '删除失败')
      router.push('/dashboard/products')
      router.refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '删除失败')
    } finally {
      setIsSaving(false)
    }
  }

  // Fetch product model and details via canonical loader endpoint
  const loadProductDetails = useCallback(async () => {
    if (!productId || demoFallback) return
    const requestId = ++loadRequestRef.current

    try {
      const [mgmtSettled, assetsSettled, optionsSettled, variantsSettled, relationsSettled, attributesSettled] = await Promise.allSettled([
        fetch(`/api/merchant/products/${productId}/management`),
        fetch(`/api/assets?product_id=${productId}`),
        fetch(`/api/products/${productId}/options`),
        fetch(`/api/products/${productId}/variants`),
        fetch(`/api/merchant/products/${productId}/relations`),
        fetch(`/api/merchant/products/${productId}/canonical-attributes`),
      ])
      if (requestId !== loadRequestRef.current) return

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
          const loadedKind = model.metadata.capabilityKind === 'question_set' || model.metadata.capabilityKind === 'skill' || model.metadata.capabilityKind === 'plugin'
            ? model.metadata.capabilityKind
            : 'skill'
          const virtualFallback = model.metadata.deliveryType === 'ai_capability' ? virtualCategoryFromKind(loadedKind) : null
          setCategory(virtualFallback?.name || model.category || '')
          setCategoryId(virtualFallback?.id || model.categoryId || null)
          setOrigin(typeof model.metadata.origin === 'string' ? model.metadata.origin : '')
          setPriceMode(model.metadata.priceMode === 'inquiry' ? 'inquiry' : model.metadata.priceMode === 'free' ? 'free' : 'amount')
          const links = model.metadata.outboundLinks && typeof model.metadata.outboundLinks === 'object'
            ? model.metadata.outboundLinks as Record<string, string> : {}
          setChannelLinks(readChannelLinks(links))
          setDeliveryType(model.metadata.deliveryType === 'ai_capability' ? 'ai_capability' : model.metadata.deliveryType === 'digital' ? 'digital' : productTypeFromCategory(model.categoryId).deliveryType)
          setItemType(model.metadata.itemType === 'service' ? 'service' : 'product')
          if (model.metadata.capabilityKind === 'question_set' || model.metadata.capabilityKind === 'skill' || model.metadata.capabilityKind === 'plugin') {
            setCapabilityKind(model.metadata.capabilityKind)
          }
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
            priceCustomized: true,
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
      if (requestId === loadRequestRef.current) setIsLoading(false)
    }
  }, [productId, demoFallback, getSaveController])

  useEffect(() => {
    if (productId) {
      void loadProductDetails()
    }
    return () => { loadRequestRef.current += 1 }
  }, [productId, loadProductDetails])

  // Save / Create handler via saveProductManagement
  const handleSave = async (e?: React.FormEvent, intent: 'draft' | 'publish' = 'draft') => {
    if (e) e.preventDefault()
    setError('')
    setSuccess('')

    if (intent === 'publish' && deliveryType === 'ai_capability') {
      setError(isZh ? '虚拟产品尚未接通交付，暂不能上架' : 'Virtual product delivery is not available yet')
      return
    }

    if (!name.trim()) {
      const msg = isZh ? '请填写商品名称' : 'Product name is required'
      setError(msg)
      setSaveSnapshot(getSaveController().markFailed(msg))
      return
    }

    if (priceMode === 'amount' && (price === '' || price == null || !Number.isFinite(Number(price)) || Number(price) < 0)) {
      const msg = isZh ? '请填写有效的基础售价' : 'Valid price is required'
      setError(msg)
      setSaveSnapshot(getSaveController().markFailed(msg))
      return
    }
    if (intent === 'publish' && !channelLinks.some((link) => link.url.trim())) {
      setError('请填写至少一个渠道跳转链接')
      return
    }
    if (channelLinks.some((link) => link.url.trim() && !validOutboundUrl(link.platform, link.url.trim()))) {
      setError('请填写对应平台的 HTTPS 链接')
      return
    }

    const outboundLinks = { xiaohongshu: '', douyin: '' }
    channelLinks.forEach(({ platform, url }) => { outboundLinks[platform] = url.trim() })

    setIsSaving(true)
    setSaveIntent(intent)
    setSaveSnapshot(getSaveController().startSaving())
    let targetProductId = productId || recoverableProductId

    try {
      const productDetails = buildProductDetailsPayload({
        category,
        categoryId,
        deliveryType,
        capabilityKind,
        origin,
        detailMarkdown,
        seoTitle,
        seoDescription,
      })
      Object.assign(productDetails, {
        price_mode: priceMode,
        outbound_links: outboundLinks,
      })

      if (!targetProductId) {
        // Create Product Shell
        const createRes = await fetch('/api/merchant/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim(),
            sku: sku.trim() || null,
            description: description.trim() || null,
            price: priceMode === 'amount' ? Number(price) : 0,
            currency: currency || 'CNY',
            inventory: Number(inventory || 0),
            status: 'draft',
            item_type: itemType,
            delivery_type: deliveryType,
            capability_kind: deliveryType === 'ai_capability' ? capabilityKind : null,
            category: category || null,
            category_id: categoryId || null,
            raw_data: productDetails,
          }),
        })

        if (!createRes.ok) {
          const body = await createRes.json().catch(() => ({}))
          throw new Error(body?.error || (isZh ? '创建商品失败' : 'Failed to create product'))
        }

        const createData = await createRes.json()
        targetProductId = createData.product?.id || createData.id
        if (targetProductId) setRecoverableProductId(targetProductId)
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
          price: priceMode === 'amount' ? Number(price) : 0,
          currency: currency || 'CNY',
          inventory: Number(inventory || 0),
          status: deliveryType === 'ai_capability' || intent === 'draft' || (intent === 'publish' && status !== 'active') || !productId ? 'draft' : status,
          item_type: itemType,
          raw_data: productDetails,
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
          if (intent === 'publish') {
            throw new Error(isZh ? `${uploadRes.failedCount} 张图片上传失败，商品仍为草稿` : `${uploadRes.failedCount} image uploads failed; product remains a draft`)
          }
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
      if (listingType === 'product' && deliveryType === 'physical' && targetProductId && (options.length > 0 || loadedVariantIdsRef.current.length > 0)) {
          for (const option of options) {
            if (option.id.startsWith('temp-')) {
              const response = await fetch(`/api/products/${targetProductId}/options`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  name: option.name,
                  code: option.code,
                  position: option.position,
                  values: option.values,
                }),
              })
              if (!response.ok) throw new Error(isZh ? `保存规格「${option.name}」失败` : `Failed to save option ${option.name}`)
            }
          }

          for (const variant of variants) {
            if (variant.id.startsWith('temp-')) {
              const response = await fetch(`/api/products/${targetProductId}/variants`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  sku: variant.sku || null,
                  price: variant.price ?? null,
                  currency: variant.currency,
                  inventory: variant.inventory || null,
                  status: variant.status,
                  option_values: variant.option_values,
                }),
              })
              if (!response.ok) throw new Error(isZh ? '保存销售变体失败' : 'Failed to save sale variant')
            } else {
              const response = await fetch(`/api/products/${targetProductId}/variants/${variant.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  sku: variant.sku || null,
                  price: variant.price ?? null,
                  currency: variant.currency,
                  inventory: variant.inventory ?? null,
                  status: variant.status,
                  option_values: variant.option_values,
                }),
              })
              if (!response.ok) throw new Error(isZh ? '更新销售变体失败' : 'Failed to update sale variant')
            }
          }

          const currentVariantIds = new Set(variants.map((v) => v.id))
          const removedVariantIds = loadedVariantIdsRef.current.filter(
            (id) => !currentVariantIds.has(id),
          )
          for (const removedId of removedVariantIds) {
            const response = await fetch(`/api/products/${targetProductId}/variants/${removedId}`, {
              method: 'DELETE',
            })
            if (!response.ok) throw new Error(isZh ? '删除旧销售变体失败' : 'Failed to delete old sale variant')
          }
          loadedVariantIdsRef.current = variants
            .filter((v) => !v.id.startsWith('temp-'))
            .map((v) => v.id)
      }

      // Persist canonical attributes (category-template spec fields) with an
      // explicit deletions diff so removed fields are actually dropped.
      if (listingType === 'product' && deliveryType === 'physical' && targetProductId) {
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
            const body = await putRes.json().catch(() => ({}))
            throw new Error(body?.error || (isZh ? '保存商品属性失败' : 'Failed to save product attributes'))
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

      if (intent === 'publish' && deliveryType !== 'ai_capability') {
        const publishRes = await fetch(`/api/merchant/products/${targetProductId}/publish`, { method: 'POST' })
        if (!publishRes.ok) {
          const body = await publishRes.json().catch(() => ({}))
          throw new Error(body?.error || (isZh ? '商品已保存为草稿，但上架失败' : 'Product saved as draft, but publishing failed'))
        }
        setStatus('active')
      }
      if (intent === 'draft' && deliveryType !== 'ai_capability') setStatus('draft')

      setSaveSnapshot(getSaveController().markSaved())
      if (deliveryType === 'ai_capability') setStatus('draft')
      setSuccess(
        (intent === 'publish'
          ? isZh ? '商品已发布到发现页' : 'Product is live in Discover'
          : productId
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
      setError(targetProductId && !productId
        ? (isZh ? `商品已保存为草稿。${errorMsg}` : `Product saved as draft. ${errorMsg}`)
        : errorMsg)
      setSaveSnapshot(getSaveController().markFailed(errorMsg))
    } finally {
      setIsSaving(false)
      setSaveIntent(null)
    }
  }

  const updateAttributeRows = (nextRows: AttributeRow[]) => {
    markEdited()
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
  }

  if (isLoading) {
    return <div role="status" className="mx-auto max-w-[1440px] px-4 py-8 text-sm text-[var(--text-secondary)]">正在加载商品…</div>
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
        </div>

        <div className="flex items-center gap-3">
          {/* Save Status Indicator */}
          {isSaving || saveSnapshot.state === 'saving' ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1  bg-[var(--primary)] text-[var(--primary-foreground)] text-xs font-semibold border border-[var(--primary)]">
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
          ) : null}

          {/* Save Button (HP Primary Blue) */}
          <button
            type="submit"
            disabled={isSaving || isLoading || Boolean(recoverableProductId && !productId)}
            className="flex h-11 items-center justify-center gap-2 rounded-full border border-[var(--border)] bg-white px-4 text-xs font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-muted)] focus-visible:outline-2 focus-visible:outline-[var(--brand-primary)] disabled:opacity-50"
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
                : isZh ? '草稿箱' : 'Draft'}
            </span>
          </button>
          {deliveryType !== 'ai_capability' && (
            <UiverseButton
              type="button"
              onClick={() => handleSave(undefined, 'publish')}
              disabled={isSaving || isLoading || Boolean(recoverableProductId && !productId)}
              className="!h-11 !rounded-full bg-[var(--accent-primary)] px-4 text-xs text-white hover:bg-[var(--accent-primary-hover)]"
            >
              {isSaving && saveIntent === 'publish' ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              <span>{isZh ? '上架' : 'Publish'}</span>
            </UiverseButton>
          )}
          {productId && <button type="button" onClick={() => void handleDelete()} disabled={isSaving} className="flex h-11 items-center justify-center rounded-full border border-[var(--border)] bg-white px-4 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-[var(--brand-primary)] disabled:opacity-50">{isZh ? '删除' : 'Delete'}</button>}
        </div>
      </div>

      {/* Non-blocking Banners */}
      {error && (
        <div role="alert" className="flex items-center justify-between gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            <span className="font-semibold">{error}</span>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {recoverableProductId && !productId && <Link href={`/dashboard/products/${recoverableProductId}/edit`} className="font-semibold underline">{isZh ? '继续编辑' : 'Continue editing'}</Link>}
            <button type="button" onClick={() => setError('')} className="text-[11px] font-semibold">{isZh ? '忽略' : 'Dismiss'}</button>
          </div>
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

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="min-w-0 lg:sticky lg:top-24">
          <MemoProductMediaSection productId={productId} existingAssets={existingAssets} mediaUploaderRef={mediaUploaderRef} onFilesChange={markEdited} />
        </div>
        <div className="min-w-0 space-y-6">
          <ProductListingTypeSelector value={listingType} onChange={selectListingType} disabled={isSaving || isLoading} />
          <ProductBasicInfo
            isDigital={listingType !== 'product'}
            hideCategory={listingType !== 'product' && deliveryType !== 'ai_capability'}
            nameLabel={isZh ? listingType === 'service' ? '服务名称' : listingType === 'digital' ? '数字内容名称' : '商品名称' : 'Name'}
            hideInventory
            minimal
            mediaRow
            priceMode={priceMode}
            onPriceModeChange={(value) => { markEdited(); setPriceMode(value); if (value === 'free') { setPrice(0); setVariants((current) => current.map((variant) => ({ ...variant, price: 0 }))); setVariantMatrixRows((current) => current.map((row) => ({ ...row, price: '0' }))) } }}
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
            onCategoryChange={(nextCategory, nextCategoryId) => {
              const selection = productTypeFromCategory(nextCategoryId)
              setDeliveryType(selection.deliveryType)
              setItemType('product')
              if (selection.capabilityKind) setCapabilityKind(selection.capabilityKind)
              updateAttributeRows(selection.deliveryType === 'physical' ? applyCategoryAttributePreset(editorRows, nextCategory, isZh) : [])
              if (nextCategory !== category) setVariantMatrixRows([])
            }}
            onChange={(updates: Partial<BasicProductFormData>) => {
              markEdited()
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

          <section className="ui-card space-y-5 p-4 sm:p-5" aria-labelledby="publish-channels-title">
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">跳转链接</h3>
              {channelLinks.map((link, index) => {
                const otherPlatform = channelLinks.find((_, otherIndex) => otherIndex !== index)?.platform
                return <div key={index} className="grid gap-2 sm:grid-cols-[180px_minmax(0,1fr)_auto]">
                  <PlatformPicker value={link.platform} disabledPlatform={otherPlatform} disabled={isSaving || isLoading} onChange={(platform) => { markEdited(); setChannelLinks((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, platform } : item)) }} />
                  <label className="sr-only" htmlFor={`channel-url-${index}`}>输入链接</label>
                  <input id={`channel-url-${index}`} type="url" value={link.url} onChange={(event) => { markEdited(); setChannelLinks((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, url: event.target.value } : item)) }} disabled={isSaving || isLoading} placeholder={link.platform === 'xiaohongshu' ? 'https://www.xiaohongshu.com/...' : 'https://www.douyin.com/...'} className="h-11 min-w-0 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-white px-3 text-sm focus-visible:outline-2 focus-visible:outline-[var(--brand-primary)]" />
                  {channelLinks.length > 1 && <button type="button" onClick={() => { markEdited(); setChannelLinks((current) => current.filter((_, itemIndex) => itemIndex !== index)) }} disabled={isSaving || isLoading} aria-label="删除链接" className="grid size-11 place-items-center rounded-[var(--radius-control)] border border-[var(--border)] bg-white text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] focus-visible:outline-2 focus-visible:outline-[var(--brand-primary)]"><X size={16} /></button>}
                </div>
              })}
              {channelLinks.length < 2 && <button type="button" onClick={() => { markEdited(); setChannelLinks((current) => [...current, { platform: current[0]?.platform === 'xiaohongshu' ? 'douyin' : 'xiaohongshu', url: '' }]) }} disabled={isSaving || isLoading} className="inline-flex min-h-9 items-center gap-2 rounded-[var(--radius-control)] border border-[var(--border)] bg-white px-3 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--surface-muted)] focus-visible:outline-2 focus-visible:outline-[var(--brand-primary)]"><Plus size={14} />添加链接</button>}
            </div>
          </section>

          {deliveryType === 'ai_capability' && (
            <p className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4 text-xs leading-5 text-[var(--text-secondary)]">
              {isZh ? `虚拟产品 · ${category}。可保存草稿；版本内容与付款交付尚未接通，暂不能上架。` : `Virtual product · ${category}. Save a draft now; publishing awaits versioned content and payment delivery.`}
            </p>
          )}

          {listingType === 'product' && deliveryType === 'physical' && <details className="border-t border-[var(--border-subtle)] pt-4">
            <summary className="cursor-pointer text-sm font-medium text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-[var(--brand-primary)]">属性与规格</summary>
            <div className="mt-4 space-y-4">
            <MemoProductAttributesPanel
              rows={editorRows}
              onChange={updateAttributeRows}
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
                    price: row.price !== '' ? Number(row.price) : null,
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
              onUserEdit={markEdited}
              basePrice={String(price || '')}
              baseInventory={String(inventory || '')}
              baseSku={sku || 'SKU-ITEM'}
              currency="CNY"
              disabled={isSaving}
            />
            </div>
          </details>}
        </div>
      </div>

    </form>
  )
}
