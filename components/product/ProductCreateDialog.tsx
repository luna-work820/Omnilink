'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X, AlertCircle } from 'lucide-react'
import { useLanguage } from '@/context/LanguageContext'
import { UiverseButton } from '@/components/ui/UiverseButton'
import { ProductBasicInfo } from './create/ProductBasicInfo'
import { ProductListingTypeSelector } from './create/ProductListingTypeSelector'
import { ProductMediaUpload } from './create/ProductMediaUpload'
import { ProductCreateFooter } from './create/ProductCreateFooter'
import { ProductAttributesPanel, type AttributeRow } from './create/ProductAttributesPanel'
import { VariantMatrixTable, type VariantMatrixRow } from './create/VariantMatrixTable'
import type { BasicProductFormData, ImageFileItem } from './create/types'
import { applyCategoryAttributePreset } from '@/lib/products/category-attribute-presets'
import { uploadProductMedia } from '@/lib/product-media/upload-client'
import { buildProductDetailsPayload } from '@/lib/products/product-details-payload'
import { productTypeFromCategory } from '@/lib/products/virtual-product-category'
import type { ListingType } from '@/lib/products/listing-type'

const INITIAL_FORM_DATA: BasicProductFormData = {
  title: '',
  sku: '',
  category: '',
  categoryId: null,
  price: '',
  currency: 'CNY',
  origin: '',
  inventory: '',
  description: '',
}

function skuPrefix(category: string) {
  const value = category.toLowerCase()
  if (value.includes('服装') || value.includes('女装') || value.includes('男装')) return 'APP'
  if (value.includes('鞋')) return 'SHO'
  if (value.includes('眼镜') || value.includes('太阳镜')) return 'EYE'
  return 'PRD'
}

function stableCode(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, '_').replace(/^_|_$/g, '')
}

function optionCode(value: string, index: number) {
  const code = stableCode(value)
  return /^[a-z0-9_]+$/.test(code) ? code : `option_${index + 1}`
}

interface ProductCreateDialogProps {
  open?: boolean
  initialImages?: File[]
  onOpenChange?: (open: boolean) => void
}

export function ProductCreateDialog({ open: controlledOpen, initialImages = [], onOpenChange }: ProductCreateDialogProps) {
  const router = useRouter()
  const { isZh } = useLanguage()

  const [isOpen, setIsOpen] = useState(false)
  const [formData, setFormData] = useState<BasicProductFormData>(INITIAL_FORM_DATA)
  const [deliveryType, setDeliveryType] = useState<'physical' | 'digital' | 'ai_capability'>('physical')
  const [listingType, setListingType] = useState<ListingType>('product')
  const [capabilityKind, setCapabilityKind] = useState<'question_set' | 'skill' | 'plugin'>('skill')
  // Product traits (spec table) and sale variants (SKU matrix) share ONE input
  // surface; each row carries a role and is split into the right payload field
  // at submit time.
  const [images, setImages] = useState<ImageFileItem[]>(() => initialImages.map((file) => ({ file, previewUrl: URL.createObjectURL(file) })))
  const [attributeRows, setAttributeRows] = useState<AttributeRow[]>([])
  const [variantMatrixRows, setVariantMatrixRows] = useState<VariantMatrixRow[]>([])
  const [specificationsOpen, setSpecificationsOpen] = useState(false)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitMode, setSubmitMode] = useState<'draft' | 'active' | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  // Set when the product row was created but at least one image failed to
  // upload. Keeps the dialog open with a way out instead of silently
  // dropping the user on a product that has no media.
  const [createdProductId, setCreatedProductId] = useState<string | null>(null)

  function applyCategoryPreset(category: string, categoryId: string | null) {
    const selection = productTypeFromCategory(categoryId)
    setDeliveryType(selection.deliveryType)
    setListingType(selection.deliveryType === 'ai_capability' ? 'digital' : 'product')
    if (selection.capabilityKind) setCapabilityKind(selection.capabilityKind)
    setAttributeRows((current) => selection.deliveryType === 'physical' ? applyCategoryAttributePreset(current, category, isZh) : [])
    setSpecificationsOpen(selection.deliveryType === 'physical' && Boolean(category))
    if (category !== formData.category) setVariantMatrixRows([])
  }

  const dialogOpen = controlledOpen ?? isOpen

  const setDialogOpen = (open: boolean) => {
    if (controlledOpen === undefined) setIsOpen(open)
    onOpenChange?.(open)
  }

  const handleOpen = () => {
    setFormData(INITIAL_FORM_DATA)
    setDeliveryType('physical')
    setListingType('product')
    setCapabilityKind('skill')
    setImages([])
    setAttributeRows([])
    setVariantMatrixRows([])
    setSpecificationsOpen(false)
    setErrorMessage(null)
    setCreatedProductId(null)
    setDialogOpen(true)
  }

  const handleClose = (force = false) => {
    if (isSubmitting && !force) return
    // Clean up preview object URLs
    images.forEach((img) => {
      if (img.previewUrl) URL.revokeObjectURL(img.previewUrl)
    })
    setDialogOpen(false)
  }

  const validateForm = (): boolean => {
    setErrorMessage(null)

    if (!formData.title.trim()) {
      setErrorMessage(isZh ? '请填写商品名称' : 'Please enter a product name')
      return false
    }

    const priceNum = parseFloat(formData.price)
    if (!formData.price.trim() || !Number.isFinite(priceNum) || priceNum < 0) {
      setErrorMessage(isZh ? '请填写有效的商品售价' : 'Please enter a valid price')
      return false
    }

    if (listingType === 'product' && deliveryType === 'physical') {
      const inventory = Number(formData.inventory)
      if (!formData.inventory.trim() || !Number.isInteger(inventory) || inventory < 0) {
        setErrorMessage(isZh ? '请填写大于或等于 0 的整数库存' : 'Please enter a whole-number inventory of 0 or more')
        return false
      }
    }

    return true
  }

  const selectListingType = (next: ListingType) => {
    if (next === listingType) return
    setListingType(next)
    setDeliveryType(next === 'digital' ? 'digital' : 'physical')
    setFormData((current) => ({ ...current, category: '', categoryId: null }))
    setAttributeRows([])
    setVariantMatrixRows([])
    setSpecificationsOpen(false)
  }

  const handleSubmit = async (targetStatus: 'draft' | 'active') => {
    if (deliveryType === 'ai_capability' && targetStatus === 'active') {
      setErrorMessage(isZh ? '虚拟产品需要完成版本清单与支付交付后才能上架。' : 'Virtual products need versioned delivery and payment before publishing.')
      return
    }
    if (!validateForm()) return

    setIsSubmitting(true)
    setSubmitMode(targetStatus)
    setErrorMessage(null)
    let recoverableId: string | null = null

    try {
      const activeAttributeRows = deliveryType === 'physical' ? attributeRows : []
      const activeVariantRows = deliveryType === 'physical' ? variantMatrixRows : []
      const variantAxes = activeAttributeRows
        .filter((row) => row.role === 'variant' && row.values.length > 0)
        .map((row, position) => ({
          code: optionCode(row.key || row.label, position),
          label: row.label,
          position,
          values: row.values.map((label) => ({ code: stableCode(label), label })),
        }))
      const optionCodeByKey = new Map(
        activeAttributeRows
          .filter((row) => row.role === 'variant' && row.values.length > 0)
          .map((row, position) => [row.key, optionCode(row.key || row.label, position)]),
      )
      const normalizeOptionValues = (values: Record<string, string>) =>
        Object.fromEntries(
          Object.entries(values).map(([key, value]) => [optionCodeByKey.get(key) || stableCode(key), value]),
        )
      // Create the smallest valid Catalog item first; details and variants can be added later.
      const res = await fetch('/api/merchant/products', {
        method: 'POST',
        // Same-origin requests send cookies by default, but being explicit
        // guards against any cross-origin/proxy deployment where credentials
        // would otherwise be dropped (a classic silent 401 cause).
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.title.trim(),
          sku: formData.sku.trim(),
          price: parseFloat(formData.price) || 0,
          currency: formData.currency,
          inventory: formData.inventory ? parseInt(formData.inventory, 10) : 0,
          delivery_type: deliveryType,
          capability_kind: deliveryType === 'ai_capability' ? capabilityKind : undefined,
          description: formData.description.trim() || undefined,
          status: 'draft',
          item_type: listingType === 'service' ? 'service' : 'product',
          raw_data: buildProductDetailsPayload({
            category: formData.category,
            categoryId: formData.categoryId,
            deliveryType,
            capabilityKind,
            origin: formData.origin,
            seoTitle: formData.title.trim(),
            seoDescription: formData.description.trim(),
          }),
        }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({} as { error?: string; code?: string }))
        // Surface the server's diagnostic code so we can tell apart
        //   NO_SESSION                  -> cookie didn't reach the API
        //   AUTH_CLIENT_INIT_FAILED     -> server-side env is misconfigured
        //   STORE_NOT_FOUND / 4xx codes -> product/data issue (rare)
        // The previous "throw new Error(errData.error)" swallowed `code`,
        // which made the 401 indistinguishable from any other failure.
        const code = errData.code || `HTTP_${res.status}`
        const baseMsg = errData.error || (isZh ? '创建商品失败，请重试' : 'Failed to create product')
        let friendly = baseMsg
        if (res.status === 401) {
          friendly = isZh
            ? '会话已失效或未送达服务器（code: ' + code + '）。请刷新页面或重新登录；若多域名访问，请确认当前域名与登录域名一致。'
            : 'Session is missing or expired (code: ' + code + '). Reload or sign in again; if you use multiple hostnames, the cookie must be set on the same hostname you are saving from.'
        } else if (code === 'AUTH_CLIENT_INIT_FAILED') {
          friendly = isZh
            ? '服务端 Supabase 配置缺失（env 未注入）。请检查部署环境的 NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY。'
            : 'Server Supabase client failed to initialize (missing env). Check NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY on the deployment.'
        }
        throw new Error(friendly)
      }

      const resData = await res.json()
      const createdProduct = resData.product || resData
      const createdId = createdProduct?.id

      if (!createdId) {
        throw new Error(isZh ? '无法获取新建商品 ID' : 'Could not retrieve created product ID')
      }
      recoverableId = createdId
      setCreatedProductId(createdId)
      window.dispatchEvent(new Event('omnilink:products-changed'))

      // Persist the same specification model used by the editor. The base
      // variant created by the product endpoint becomes the first matrix row.
      const createdVariantId = resData.variant?.id || createdProduct?.variant?.id
      for (const axis of variantAxes) {
        const optionRes = await fetch(`/api/products/${createdId}/options`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: axis.label,
            code: axis.code,
            position: axis.position,
            values: axis.values.map((value) => value.label),
          }),
        })
        if (!optionRes.ok) throw new Error(isZh ? `保存规格「${axis.label}」失败` : `Failed to save option ${axis.label}`)
      }

      if (activeVariantRows.length > 0) {
        const first = activeVariantRows[0]
        const variantPayload = {
          sku: first.sku || null,
          price: Number(first.price || formData.price || 0),
          currency: 'CNY',
          inventory: Number(first.inventory || 0),
          status: 'draft',
          option_values: normalizeOptionValues(first.optionValues),
        }
        if (createdVariantId) {
          const updateRes = await fetch(`/api/products/${createdId}/variants/${createdVariantId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(variantPayload),
          })
          if (!updateRes.ok) throw new Error(isZh ? '保存首个销售变体失败' : 'Failed to save the first variant')
        }
        for (const row of activeVariantRows.slice(createdVariantId ? 1 : 0)) {
          const variantRes = await fetch(`/api/products/${createdId}/variants`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...variantPayload,
              sku: row.sku || null,
              price: Number(row.price || formData.price || 0),
              inventory: Number(row.inventory || 0),
              option_values: normalizeOptionValues(row.optionValues),
            }),
          })
          if (!variantRes.ok) throw new Error(isZh ? '保存销售变体失败' : 'Failed to save a sale variant')
        }
      }

      const traitAttributes = activeAttributeRows
        .filter((row) => row.role === 'trait' && row.value.trim())
        .map((row) => ({
          fieldKey: stableCode(row.key || row.label),
          label: row.label,
          value: row.value.trim(),
          type: row.unit ? 'number' as const : 'text' as const,
          unit: row.unit || null,
          source: 'manual' as const,
          confidence: 1,
          isStandard: false,
        }))
      if (deliveryType === 'physical' && (formData.category || traitAttributes.length > 0)) {
        const attributesRes = await fetch(`/api/merchant/products/${createdId}/canonical-attributes`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            category: formData.category || undefined,
            category_id: formData.categoryId || undefined,
            attributes: traitAttributes,
          }),
        })
        if (!attributesRes.ok) throw new Error(isZh ? '保存商品特征失败' : 'Failed to save product traits')
      }

      // NOTE (P0, 2026-08-26): Origin is no longer faked as a `component_type = assembly`
      // Origin is stored in the Catalog item details payload.
      // (canonical) and on the canonical attribute `country_of_origin` (line ~101 above).
      // A future Product Knowledge provenance task may introduce a real composition domain
      // for multi-component products; for now, do NOT POST composition here.

      // 4. Upload product images sequentially if provided.
      //    Goes through the shared upload client so this path matches the
      //    product editor exactly. The previous call was broken twice over:
      //      - product_id was sent as a query param, but the route reads it
      //        from the multipart body  -> 400 "product_id is required"
      //      - asset_id was never sent at all -> 400 "asset_id is required"
      //    and the response was never inspected, so every image failed
      //    silently and the product landed with no media at all.
      if (images.length > 0) {
        const uploadErrors: string[] = []

        for (let i = 0; i < images.length; i++) {
          const fileItem = images[i]
          const result = await uploadProductMedia({
            productId: createdId,
            assetId: crypto.randomUUID(),
            file: fileItem.file,
          })

          if (!result.success) {
            uploadErrors.push(
              isZh
                ? `第 ${i + 1} 张（${fileItem.file.name}）：${result.error ?? '上传失败'}`
                : `Image ${i + 1} (${fileItem.file.name}): ${result.error ?? 'upload failed'}`,
            )
          }
        }

        if (uploadErrors.length > 0) {
          setCreatedProductId(createdId)
          setErrorMessage(
            isZh
              ? `商品已创建成功，但 ${uploadErrors.length}/${images.length} 张图片上传失败：${uploadErrors.join('；')}。可前往商品编辑页重新上传。`
              : `Product created, but ${uploadErrors.length}/${images.length} image(s) failed: ${uploadErrors.join('; ')}. You can re-upload them on the product edit page.`,
          )
          return
        }
      }

      if (targetStatus === 'active') {
        const publishRes = await fetch(`/api/merchant/products/${createdId}/publish`, { method: 'POST' })
        if (!publishRes.ok) {
          const body = await publishRes.json().catch(() => ({}))
          throw new Error(body?.error || (isZh ? '商品已保存为草稿，但上架失败' : 'Product saved as draft, but publishing failed'))
        }
      }

      // 5. Close dialog and redirect to product edit/detail page
      handleClose(true)
      router.push(`/dashboard/products/${createdId}/edit`)
      router.refresh()
    } catch (err) {
      console.error('Product creation error:', err)
      const message = err instanceof Error ? err.message : (isZh ? '保存失败，请检查必填项' : 'Save failed, please check required fields')
      setErrorMessage(recoverableId ? (isZh ? `商品已保存为草稿。${message}` : `Product saved as draft. ${message}`) : message)
    } finally {
      setIsSubmitting(false)
      setSubmitMode(null)
    }
  }

  return (
    <>
      {controlledOpen === undefined && (
        <UiverseButton
          type="button"
          id="btn-open-create-product"
          onClick={handleOpen}
          className="min-h-11 text-sm"
        >
          <Plus size={15} />
          <span>{isZh ? '新建商品' : 'New Product'}</span>
        </UiverseButton>
      )}

      {/* Product creation dialog */}
      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[var(--ink)]/50 p-3 backdrop-blur-xs animate-in fade-in duration-200 sm:p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-product-dialog-title"
            className="ui-card--floating relative my-auto flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden border border-[var(--border-subtle)]"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex shrink-0 items-center justify-between gap-4 border-b border-[var(--border-subtle)] px-4 py-3.5 sm:px-6">
              <div className="min-w-0">
                <h2 id="create-product-dialog-title" className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">
                  {isZh ? '新建' : 'New'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => handleClose()}
                disabled={isSubmitting}
                className="ui-interactive grid h-9 w-9 shrink-0 place-items-center rounded-[var(--radius-control)] text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)] disabled:opacity-50"
                title={isZh ? '关闭' : 'Close'}
                aria-label={isZh ? '关闭商品创建窗口' : 'Close product creation dialog'}
              >
                <X size={18} />
              </button>
            </header>

            {/* Error Banner */}
            {errorMessage && (
              <div className="mx-5 mt-4 shrink-0 rounded-[var(--radius-card-nested)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-3 sm:mx-7">
                <div className="flex items-start gap-2 text-sm text-[var(--plum)]">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  <span className="font-medium">{errorMessage}</span>
                </div>
                {createdProductId && (
                  <button
                    type="button"
                    onClick={() => {
                      const id = createdProductId
                      handleClose()
                      router.push(`/dashboard/products/${id}/edit`)
                      router.refresh()
                    }}
                    className="mt-2 ml-[23px] cursor-pointer rounded-[var(--radius-control)] bg-[var(--accent-primary)] px-3 py-1.5 text-xs font-bold text-[var(--surface)] transition-colors hover:bg-[var(--accent-primary-hover)] active:scale-[0.98]"
                  >
                    {isZh ? '前往商品编辑页继续处理' : 'Continue on product edit page'}
                  </button>
                )}
              </div>
            )}

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
              <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1.8fr)_minmax(280px,0.86fr)] lg:items-start">
                <section className="min-w-0" aria-label={isZh ? '商品图片' : 'Product images'}>
                  <ProductMediaUpload images={images} onChange={setImages} disabled={isSubmitting} />
                </section>

                <aside className="min-w-0 space-y-4">
                  <ProductListingTypeSelector value={listingType} onChange={selectListingType} disabled={isSubmitting} />
                  <ProductBasicInfo formData={formData} onChange={(updates) => setFormData((prev) => ({ ...prev, ...updates }))} onCategoryChange={applyCategoryPreset} isDigital={listingType !== 'product'} hideCategory={listingType !== 'product' && deliveryType !== 'ai_capability'} minimal disabled={isSubmitting} />

                  {listingType === 'product' && deliveryType === 'physical' && (
                    <details
                      className="group rounded-[var(--radius-card-nested)] border border-[var(--border-subtle)] px-3.5"
                      open={specificationsOpen}
                      onToggle={(event) => setSpecificationsOpen(event.currentTarget.open)}
                    >
                      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-sm font-medium text-[var(--text-secondary)] [&::-webkit-details-marker]:hidden">
                        <span>{isZh ? '规格' : 'Specs'}</span>
                        <span aria-hidden="true" className="text-lg leading-none text-[var(--accent-primary)] transition-transform group-open:rotate-45">+</span>
                      </summary>
                      <div className="space-y-5 border-t border-[var(--border-subtle)] py-4">
                        <ProductAttributesPanel rows={attributeRows} onChange={setAttributeRows} disabled={isSubmitting} showHeader={false} />
                        <VariantMatrixTable
                          axes={attributeRows.filter((row) => row.role === 'variant' && row.values.length > 0).map((row) => ({ code: row.key, name: row.label, values: row.values }))}
                          rows={variantMatrixRows}
                          onChange={setVariantMatrixRows}
                          basePrice={formData.price}
                          baseInventory={formData.inventory}
                          baseSku={formData.sku || `${skuPrefix(formData.category)}-ITEM`}
                          currency="CNY"
                          disabled={isSubmitting}
                        />
                      </div>
                    </details>
                  )}
                </aside>
              </div>
            </div>

            <footer className="shrink-0 border-t border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-3.5 sm:px-6">
              <ProductCreateFooter
                onSaveDraft={() => handleSubmit('draft')}
                onSaveAndPublish={() => handleSubmit('active')}
                isSubmitting={isSubmitting}
                submitMode={submitMode}
                disabled={isSubmitting || Boolean(createdProductId)}
                publishDisabled={listingType !== 'product' || deliveryType === 'ai_capability'}
                publishDisabledReason={deliveryType === 'ai_capability' ? undefined : isZh ? '请先存稿，在编辑页补充跳转链接后上架' : 'Save a draft, then add a channel link in the editor before publishing'}
              />
            </footer>
          </div>
        </div>
      )}
    </>
  )
}
