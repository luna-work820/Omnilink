'use client'

import React, { useState } from 'react'
import { createStoreAction } from '@/app/actions/onboarding'
import { StoreAvatarUpload } from './StoreAvatarUpload'
import { ProductCategorySelector } from './ProductCategorySelector'
import { ArrowRight, Loader2, Store } from 'lucide-react'

export function StoreCreateForm() {
  const [storeName, setStoreName] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [productCategory, setProductCategory] = useState('3C数码 & 消费电子')
  const [concept, setConcept] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!storeName.trim()) {
      setError('请填写店铺名称')
      return
    }

    setIsSubmitting(true)
    setError('')

    const formData = new FormData()
    formData.set('store_name', storeName.trim())
    formData.set('industry_category', productCategory)
    formData.set('logo_url', logoUrl)
    formData.set('description', concept.trim())
    formData.set('currency', 'CNY')

    try {
      const res = await createStoreAction(formData)
      if (res?.success && res?.redirectUrl) {
        window.location.href = res.redirectUrl
        return
      }
      if (res?.error) {
        setError(res.error)
        setIsSubmitting(false)
      }
    } catch (err: any) {
      if (
        err?.message === 'NEXT_REDIRECT' ||
        err?.message?.includes('NEXT_REDIRECT') ||
        err?.digest?.startsWith('NEXT_REDIRECT')
      ) {
        window.location.href = '/dashboard'
        return
      }
      setError(err instanceof Error ? err.message : '创建店铺失败，请重试')
      setIsSubmitting(false)
    }
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="bg-[var(--surface)] rounded-3xl p-6 sm:p-10 border border-[var(--surface-muted)]/90 shadow-[0_12px_36px_var(--ink)]">
        <div className="mb-8 text-center">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[var(--ink)] tracking-tight">
            设置你的专属店铺
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 1. 上传店铺头像 / Logo */}
          <StoreAvatarUpload value={logoUrl} onChange={setLogoUrl} />

          {/* 2. 店铺名称 */}
          <div className="space-y-1.5">
            <label htmlFor="store_name" className="text-xs font-bold text-[var(--ink)] flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Store size={13} className="text-[var(--plum)]" />
                <span>店铺名称 (Store Name)</span>
                <span className="text-[var(--plum)]">*</span>
              </span>
              <span className="text-[10px] font-normal text-[var(--lavender)]">
                {storeName.length}/40
              </span>
            </label>
            <input
              type="text"
              id="store_name"
              name="store_name"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              required
              maxLength={40}
              placeholder="例如：极光数码旗舰店"
              className="w-full px-4 py-3 rounded-xl border border-[var(--surface-muted)] focus:border-[var(--plum)] focus:ring-4 focus:ring-[var(--plum)]/15 outline-none text-sm text-[var(--ink)] placeholder-gray-400 bg-[var(--surface-muted)] focus:bg-[var(--surface)] transition-all font-medium"
            />
          </div>

          {/* 3. 店铺主营行业 (Primary Industry) */}
          <ProductCategorySelector
            value={productCategory}
            onChange={setProductCategory}
          />

          <div className="space-y-1.5">
            <label htmlFor="brand_concept" className="text-xs font-bold text-[var(--ink)]">
              品牌概念 <span className="text-[10px] font-normal text-[var(--lavender)]">可选</span>
            </label>
            <textarea
              id="brand_concept"
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              maxLength={240}
              rows={3}
              placeholder="例如：高对比霓虹、液态金属质感、赛博潮流视觉"
              className="w-full px-4 py-3 rounded-xl border border-[var(--surface-muted)] focus:border-[var(--primary)] focus:ring-4 focus:ring-[var(--primary)]/10 outline-none text-sm text-[var(--ink)] placeholder-gray-400 bg-[var(--surface-muted)] focus:bg-[var(--surface)] transition-all font-medium resize-none"
            />
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="bg-[var(--plum)] border border-[var(--plum)] text-[var(--plum)] text-xs px-4 py-3 rounded-xl animate-in fade-in flex items-center gap-2">
              <span className="font-bold">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* 提交按钮 */}
          <div className="pt-4">
            <button
              type="submit"
              disabled={isSubmitting || !storeName.trim()}
              className="w-full py-3.5 px-6  bg-[var(--primary)] hover:bg-[var(--primary)] active:bg-[var(--primary)] text-[var(--surface)] text-sm font-medium transition-all flex items-center justify-center gap-2 cursor-pointer disabled:bg-[var(--surface-muted)] disabled:text-[var(--lavender)] disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-[var(--primary)] focus-visible:outline-offset-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>正在初始化店铺节点与数据库…</span>
                </>
              ) : (
                <>
                  <span>完成初始化设置 (Dashboard)</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
