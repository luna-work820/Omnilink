'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X, AlertCircle } from 'lucide-react'
import { useLanguage } from '@/context/LanguageContext'
import { UiverseButton } from '@/components/ui/UiverseButton'
import { ProductBasicInfo } from './create/ProductBasicInfo'
import { ProductMediaUpload } from './create/ProductMediaUpload'
import { ProductCreateFooter } from './create/ProductCreateFooter'
import { ProductAttributesPanel, type AttributeRow } from './create/ProductAttributesPanel'
import { VariantMatrixTable, type VariantMatrixRow } from './create/VariantMatrixTable'
import type { BasicProductFormData, ImageFileItem } from './create/types'
import { getCategoryTemplate } from '@/lib/product/category-templates'
import { uploadProductMedia } from '@/lib/product-media/upload-client'

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
  // Product traits (spec table) and sale variants (SKU matrix) share ONE input
  // surface; each row carries a role and is split into the right payload field
  // at submit time.
  const [images, setImages] = useState<ImageFileItem[]>(() => initialImages.map((file) => ({ file, previewUrl: URL.createObjectURL(file) })))
  const [attributeRows, setAttributeRows] = useState<AttributeRow[]>([])
  const [variantMatrixRows, setVariantMatrixRows] = useState<VariantMatrixRow[]>([])

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitMode, setSubmitMode] = useState<'draft' | 'active' | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  // Set when the product row was created but at least one image failed to
  // upload. Keeps the dialog open with a way out instead of silently
  // dropping the user on a product that has no media.
  const [createdProductId, setCreatedProductId] = useState<string | null>(null)

  function applyCategoryPreset(category: string) {
    const template = getCategoryTemplate(category)
    if (!template?.variantPresets?.length) return
    setAttributeRows((current) => {
      const additions = template.variantPresets
        ?.filter((preset) => !current.some((row) => row.key === preset.code))
        .map((preset, index) => ({
          id: `category_${template.id}_${preset.code}_${index}`,
          role: 'variant' as const,
          key: preset.code,
          label: isZh ? preset.nameZh : preset.nameEn,
          value: '',
          values: [...preset.defaultValues],
        })) ?? []
      return additions.length ? [...current, ...additions] : current
    })
  }

  const dialogOpen = controlledOpen ?? isOpen

  const setDialogOpen = (open: boolean) => {
    if (controlledOpen === undefined) setIsOpen(open)
    onOpenChange?.(open)
  }

  const handleOpen = () => {
    setFormData(INITIAL_FORM_DATA)
    setImages([])
    setAttributeRows([])
    setVariantMatrixRows([])
    setErrorMessage(null)
    setCreatedProductId(null)
    setDialogOpen(true)
  }

  const handleClose = () => {
    if (isSubmitting) return
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
    if (isNaN(priceNum) || priceNum < 0) {
      setErrorMessage(isZh ? '请填写有效的商品售价' : 'Please enter a valid price')
      return false
    }

    return true
  }

  const handleSubmit = async (targetStatus: 'draft' | 'active') => {
    if (!validateForm()) return

    setIsSubmitting(true)
    setSubmitMode(targetStatus)
    setErrorMessage(null)

    try {
      const variantAxes = attributeRows
        .filter((row) => row.role === 'variant' && row.values.length > 0)
        .map((row, position) => ({
          code: optionCode(row.key || row.label, position),
          label: row.label,
          position,
          values: row.values.map((label) => ({ code: stableCode(label), label })),
        }))
      const specificationSchema = {
        version: 1,
        category: formData.category || null,
        axes: variantAxes,
        traits: attributeRows
          .filter((row) => row.role === 'trait')
          .map((row) => ({
            code: stableCode(row.key || row.label),
            label: row.label,
            type: row.unit ? 'number' : 'text',
            unit: row.unit || null,
          })),
      }
      const optionCodeByKey = new Map(
        attributeRows
          .filter((row) => row.role === 'variant' && row.values.length > 0)
          .map((row, position) => [row.key, optionCode(row.key || row.label, position)]),
      )
      const normalizeOptionValues = (values: Record<string, string>) =>
        Object.fromEntries(
          Object.entries(values).map(([key, value]) => [optionCodeByKey.get(key) || stableCode(key), value]),
        )
      const aiMetadata = {
        source: 'merchant_input',
        generated_by: 'rules',
        confidence: 1,
        schema_version: 'product-spec-v1',
      }

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
          description: formData.description.trim() || undefined,
          status: targetStatus,
          raw_data: {
            category: formData.category,
            category_id: formData.categoryId || undefined,
            specification_schema: specificationSchema,
            ai_metadata: aiMetadata,
          },
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

      if (variantMatrixRows.length > 0) {
        const first = variantMatrixRows[0]
        const variantPayload = {
          sku: first.sku || null,
          price: Number(first.price || formData.price || 0),
          currency: 'CNY',
          inventory: Number(first.inventory || 0),
          status: targetStatus,
          option_values: normalizeOptionValues(first.optionValues),
          raw_data: { ai_metadata: aiMetadata },
        }
        if (createdVariantId) {
          const updateRes = await fetch(`/api/products/${createdId}/variants/${createdVariantId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(variantPayload),
          })
          if (!updateRes.ok) throw new Error(isZh ? '保存首个销售变体失败' : 'Failed to save the first variant')
        }
        for (const row of variantMatrixRows.slice(createdVariantId ? 1 : 0)) {
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

      const traitAttributes = attributeRows
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
      if (traitAttributes.length > 0) {
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

      // 5. Close dialog and redirect to product edit/detail page
      handleClose()
      router.push(`/dashboard/products/${createdId}/edit`)
      router.refresh()
    } catch (err) {
      console.error('Product creation error:', err)
      setErrorMessage(err instanceof Error ? err.message : (isZh ? '保存失败，请检查必填项' : 'Save failed, please check required fields'))
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

      {/* 极简商品创建模态框 (Minimal, Quiet, Professional) */}
      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[var(--ink)]/50 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
          <div
            className="relative w-full max-w-5xl bg-[var(--surface)] rounded-xl shadow-2xl border border-[var(--surface-muted)] overflow-hidden flex flex-col max-h-[92vh] my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-end px-3 py-2 bg-[var(--surface)] shrink-0">
              <button
                type="button"
                onClick={handleClose}
                disabled={isSubmitting}
                className="w-8 h-8  text-[var(--lavender)] hover:text-[var(--lavender)] hover:bg-[var(--surface-muted)] flex items-center justify-center transition-colors cursor-pointer"
                title={isZh ? '关闭' : 'Close'}
              >
                <X size={18} />
              </button>
            </div>

            {/* Error Banner */}
            {errorMessage && (
              <div className="mx-5 mt-4 p-3  bg-[var(--surface-muted)] border border-[var(--border)] shrink-0">
                <div className="flex items-start gap-2 text-xs text-[var(--plum)]">
                  <AlertCircle size={15} className="shrink-0 mt-px" />
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
                    className="mt-2 ml-[23px] cursor-pointer  bg-[var(--ink)] px-3 py-1.5 text-xs font-bold text-[var(--surface)] transition-colors hover:bg-[#443F3B]"
                  >
                    {isZh ? '前往商品编辑页重新上传' : 'Go to product page to re-upload'}
                  </button>
                )}
              </div>
            )}

            <div className="grid min-h-0 flex-1 gap-6 overflow-y-auto p-5 pb-24 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.82fr)]">
              <div className="space-y-6">
                <ProductBasicInfo formData={formData} onChange={(updates) => setFormData((prev) => ({ ...prev, ...updates }))} onCategoryChange={applyCategoryPreset} disabled={isSubmitting} />
                <ProductAttributesPanel rows={attributeRows} onChange={setAttributeRows} disabled={isSubmitting} />
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
              <ProductMediaUpload images={images} onChange={setImages} disabled={isSubmitting} />
            </div>

            {/* Floating actions */}
            <div className="pointer-events-none absolute inset-x-5 bottom-4 z-10">
              <ProductCreateFooter
                onSaveDraft={() => handleSubmit('draft')}
                onSaveAndPublish={() => handleSubmit('active')}
                isSubmitting={isSubmitting}
                submitMode={submitMode}
                disabled={isSubmitting}
              />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
