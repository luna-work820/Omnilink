'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'
import {
  Sliders,
  Plus,
  Trash2,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Info,
  Loader2,
  RefreshCw,
  AlertTriangle,
  ShieldCheck,
  Check,
} from 'lucide-react'
import { useLanguage } from '@/context/LanguageContext'
import {
  getCategoryTemplate,
  AttributeTemplateField,
} from '@/lib/product/category-templates'
import {
  buildAttributeSchemaState,
  AttributeSchemaState,
} from '@/lib/product/attribute-schema-state'
import type { AttributeRuleDefinition } from '@/lib/product/attribute-rules'
import { getCategoryConditionalRules } from '@/lib/product/category-conditional-rules'
import { resolveEffectiveAttributeRules } from '@/lib/product/effective-attribute-rules'
import type { CanonicalProductAttribute } from '@/lib/products/canonical-attributes'
import type { AttributeCompletenessItem } from '@/lib/product/attribute-completeness'
import type { ProductAiReport, ProductAiChange } from '@/lib/product/ai-intelligence'
import { analyzeProductWithAi } from '@/lib/product/product-ai-intelligence'
import { ProductAiIntelligenceDrawer } from './ProductAiIntelligenceDrawer'

/**
 * Canonical Product Attribute View Model (Frontend UI Contract)
 */
export interface ProductAttributeValue {
  fieldKey: string
  label?: string
  value: string
  type: 'text' | 'number' | 'boolean' | 'select'
  unit?: string | null
  required?: boolean
  allowedValues?: string[]
  min?: number
  max?: number
  source?: 'ai' | 'manual' | 'system'
  confidence?: number
  isStandard?: boolean
}

export interface ProductAttributesSectionProps {
  productId?: string
  category?: string
  categoryId?: string | null
  attributeValues: ProductAttributeValue[]
  onChangeAttributeValues: (values: ProductAttributeValue[]) => void
  isLoading?: boolean
  isLegacyFallback?: boolean
  error?: string | null
  onRetry?: () => void
  disabled?: boolean
  onOpenPreview?: (title: string) => void
}

export function ProductAttributesSection({
  productId,
  category = '',
  categoryId = null,
  attributeValues = [],
  onChangeAttributeValues,
  isLoading = false,
  isLegacyFallback = false,
  error = null,
  onRetry,
  disabled = false,
}: ProductAttributesSectionProps) {
  const { isZh } = useLanguage()

  // 1. Current category template (Field Definitions Source)
  const template = useMemo(() => getCategoryTemplate(categoryId || category), [categoryId, category])
  const prevCategoryRef = useRef(category)
  const [categoryChangeNotice, setCategoryChangeNotice] = useState<string | null>(null)

  // 2. Validation Errors State (per-field)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  // 3. AI 商品智能 UI State
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [aiReport, setAiReport] = useState<ProductAiReport | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [isApplying, setIsApplying] = useState(false)
  const [applyNotice, setApplyNotice] = useState<string | null>(null)

  // 4. Category Attribute Rules Map (Derived directly from category template)
  const rules = useMemo(() => {
    const map = new Map<string, AttributeRuleDefinition>()
    if (!template || !template.fields) return map

    for (const f of template.fields) {
      map.set(f.key, {
        fieldKey: f.key,
        type: f.type,
        unit: f.unit || null,
        required: Boolean((f as any).required),
        allowedValues: f.options,
        placeholderZh: f.placeholderZh,
        placeholderEn: f.placeholderEn,
      })
    }
    return map
  }, [template])

  // 5. Resolve Conditional Rules & Effective Attribute Rules
  const conditionalRules = useMemo(() => {
    return getCategoryConditionalRules(category)
  }, [category])

  const { effectiveRules, conditionalResolution } = useMemo(() => {
    const canonicalAttrs: CanonicalProductAttribute[] = attributeValues.map((attr) => ({
      fieldKey: attr.fieldKey,
      label: attr.label,
      value: attr.value,
      type: attr.type,
      unit: attr.unit,
      required: attr.required,
      allowedValues: attr.allowedValues,
      min: attr.min,
      max: attr.max,
      source: attr.source,
      confidence: attr.confidence,
      isStandard: attr.isStandard ?? rules.has(attr.fieldKey),
    }))

    const { rules: effRules, conditionalState } = resolveEffectiveAttributeRules(
      canonicalAttrs,
      rules,
      conditionalRules,
    )

    return {
      effectiveRules: effRules,
      conditionalResolution: conditionalState,
    }
  }, [attributeValues, rules, conditionalRules])

  // 6. Consume AttributeSchemaState directly from Canonical Product Attributes
  const schemaState: AttributeSchemaState = useMemo(() => {
    const canonicalAttrs: CanonicalProductAttribute[] = attributeValues.map((attr) => ({
      fieldKey: attr.fieldKey,
      label: attr.label,
      value: attr.value,
      type: attr.type,
      unit: attr.unit,
      required: attr.required,
      allowedValues: attr.allowedValues,
      min: attr.min,
      max: attr.max,
      source: attr.source,
      confidence: attr.confidence,
      isStandard: attr.isStandard ?? rules.has(attr.fieldKey),
    }))

    return buildAttributeSchemaState(canonicalAttrs, effectiveRules)
  }, [attributeValues, effectiveRules, rules])

  // Lookups derived directly from schemaState
  const completenessItemMap = useMemo(() => {
    const map = new Map<string, AttributeCompletenessItem>()
    schemaState.completeness.items.forEach((item) => {
      map.set(item.fieldKey.toLowerCase(), item)
    })
    return map
  }, [schemaState.completeness.items])

  const standardAttributeMap = useMemo(() => {
    const map = new Map<string, CanonicalProductAttribute>()
    schemaState.standardAttributes.forEach((attr) => {
      map.set(attr.fieldKey.toLowerCase(), attr)
    })
    return map
  }, [schemaState.standardAttributes])

  const templateFieldMap = useMemo(() => {
    const map = new Map<string, AttributeTemplateField>()
    if (template?.fields) {
      template.fields.forEach((f) => map.set(f.key.toLowerCase(), f))
    }
    return map
  }, [template])

  // Handle Category Changes
  useEffect(() => {
    if (prevCategoryRef.current !== category && prevCategoryRef.current !== '') {
      const prevTemplate = getCategoryTemplate(prevCategoryRef.current)
      const currentTemplate = getCategoryTemplate(category)

      if (prevTemplate?.id !== currentTemplate?.id) {
        setCategoryChangeNotice(
          isZh
            ? `分类已更新为「${category || '通用'}」，Canonical 规格模版已实时联动更新。`
            : `Category updated to "${category || 'General'}". Template refreshed.`
        )
      }
    }
    prevCategoryRef.current = category
  }, [category, isZh])

  // Custom attribute form state
  const [newKey, setNewKey] = useState('')
  const [newValue, setNewValue] = useState('')
  const [newType, setNewType] = useState<'text' | 'number' | 'boolean' | 'select'>('text')
  const [customError, setCustomError] = useState('')

  // AI 整理 Trigger
  const handleAiOrganize = async () => {
    setIsAnalyzing(true)
    setApplyNotice(null)
    try {
      if (productId) {
        const res = await fetch(`/api/merchant/products/${productId}/ai-intelligence`, {
          method: 'POST',
        })
        if (res.ok) {
          const data = await res.json()
          if (data.report) {
            setAiReport(data.report)
            setIsAnalyzing(false)
            return
          }
        }
      }

      // Client fallback analysis if new product shell or endpoint fallback
      const report = await analyzeProductWithAi({
        productId: productId || 'temp',
        name: '商品主档',
        category,
        attributes: attributeValues.map((a) => ({
          fieldKey: a.fieldKey,
          label: a.label,
          value: a.value,
          type: a.type,
          unit: a.unit,
        })),
      })
      setAiReport(report)
    } catch (err) {
      console.error('AI Organize error:', err)
      setApplyNotice(isZh ? 'AI 商品整理失败，请重试' : 'AI Analysis failed, please retry')
    } finally {
      setIsAnalyzing(false)
    }
  }

  // AI Apply Handler
  const handleApplyAiChanges = async (changesToApply: ProductAiChange[]) => {
    setIsApplying(true)
    try {
      if (productId) {
        const res = await fetch(`/api/merchant/products/${productId}/ai-intelligence/apply`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ changes: changesToApply }),
        })

        if (res.ok) {
          const data = await res.json()
          if (data.canonical?.attributes) {
            onChangeAttributeValues(data.canonical.attributes)
          }
          const count = data.applied ?? changesToApply.filter((c) => c.status === 'accepted').length
          setApplyNotice(isZh ? `已应用 ${count} 项修改` : `Applied ${count} changes`)
          setIsDrawerOpen(false)
          setAiReport(null)
          setIsApplying(false)
          return
        }
      }

      // Client-side local application fallback
      let updatedAttrs = [...attributeValues]
      let appliedCount = 0

      for (const change of changesToApply) {
        const key = change.fieldKey
        if (change.status !== 'accepted' || !key) continue

        if (change.type === 'remove') {
          updatedAttrs = updatedAttrs.filter((a) => a.fieldKey.toLowerCase() !== key.toLowerCase())
          appliedCount++
        } else if (change.nextValue) {
          const idx = updatedAttrs.findIndex((a) => a.fieldKey.toLowerCase() === key.toLowerCase())
          if (idx >= 0) {
            updatedAttrs[idx] = {
              ...updatedAttrs[idx],
              value: change.nextValue,
              source: 'ai',
              confidence: change.confidence || 0.95,
            }
          } else {
            updatedAttrs.push({
              fieldKey: key,
              label: change.label || key,
              value: change.nextValue,
              type: 'text',
              source: 'ai',
              confidence: change.confidence || 0.95,
              isStandard: true,
            })
          }
          appliedCount++
        }
      }

      onChangeAttributeValues(updatedAttrs)
      setApplyNotice(isZh ? `已应用 ${appliedCount} 项修改` : `Applied ${appliedCount} changes`)
      setIsDrawerOpen(false)
      setAiReport(null)
    } catch (err) {
      console.error('Apply AI changes error:', err)
      setApplyNotice(isZh ? '部分修改未应用，请检查后再试' : 'Failed to apply some changes')
    } finally {
      setIsApplying(false)
    }
  }

  // One click fix handler
  const handleOneClickFix = async () => {
    if (!aiReport?.changes) return
    const allAccepted = aiReport.changes.map((c) => ({ ...c, status: 'accepted' as const }))
    await handleApplyAiChanges(allAccepted)
  }

  // Scroll to field helper
  const scrollToField = (fieldKey: string) => {
    const el = document.getElementById(`attr-field-${fieldKey}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      const inputEl = document.getElementById(`attr-input-${fieldKey}`)
      if (inputEl) {
        inputEl.focus()
      }
    }
  }

  // Handle standard rule field modification
  const handleStandardFieldChange = (
    fieldKey: string,
    value: string,
    rule: AttributeRuleDefinition,
    labelName?: string,
  ) => {
    if (fieldErrors[fieldKey]) {
      setFieldErrors((prev) => {
        const next = { ...prev }
        delete next[fieldKey]
        return next
      })
    }

    const existingIndex = attributeValues.findIndex(
      (a) => a.fieldKey.toLowerCase() === fieldKey.toLowerCase()
    )

    const updatedAttr: ProductAttributeValue = {
      fieldKey,
      label: labelName || fieldKey,
      value,
      type: rule.type,
      unit: rule.unit || null,
      required: rule.required,
      allowedValues: rule.allowedValues,
      min: rule.min,
      max: rule.max,
      source: 'manual',
      confidence: 1.0,
      isStandard: true,
    }

    if (existingIndex >= 0) {
      const copy = [...attributeValues]
      copy[existingIndex] = {
        ...copy[existingIndex],
        ...updatedAttr,
      }
      onChangeAttributeValues(copy)
    } else {
      onChangeAttributeValues([...attributeValues, updatedAttr])
    }
  }

  // Handle adding custom attribute
  const handleAddCustomAttribute = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setCustomError('')

    const keyClean = newKey.trim()
    const valClean = newValue.trim()

    if (!keyClean || keyClean.length < 1 || keyClean.length > 80) {
      setCustomError(isZh ? '属性名称须为 1~80 个字符' : 'Attribute name must be 1-80 characters')
      return
    }

    if (!valClean || valClean.length < 1 || valClean.length > 500) {
      setCustomError(isZh ? '属性值须为 1~500 个字符' : 'Attribute value must be 1-500 characters')
      return
    }

    const standardKey = keyClean.toLowerCase().replace(/\s+/g, '_')

    const exists = attributeValues.some((a) => a.fieldKey.toLowerCase() === standardKey)
    if (exists) {
      setCustomError(isZh ? '已存在同名属性，请在已有属性项中直接修改' : 'Attribute already exists')
      return
    }

    const newAttr: ProductAttributeValue = {
      fieldKey: standardKey,
      label: keyClean,
      value: valClean,
      type: newType,
      source: 'manual',
      confidence: 1.0,
      isStandard: false,
    }

    onChangeAttributeValues([...attributeValues, newAttr])
    setNewKey('')
    setNewValue('')
    setNewType('text')
  }

  const handleUpdateOtherValue = (fieldKey: string, val: string) => {
    if (fieldErrors[fieldKey]) {
      setFieldErrors((prev) => {
        const next = { ...prev }
        delete next[fieldKey]
        return next
      })
    }
    const next = attributeValues.map((attr) =>
      attr.fieldKey === fieldKey ? { ...attr, value: val, source: 'manual' as const } : attr
    )
    onChangeAttributeValues(next)
  }

  const handleRemoveOther = (fieldKey: string) => {
    const next = attributeValues.filter((attr) => attr.fieldKey !== fieldKey)
    onChangeAttributeValues(next)
  }

  const renderConfidenceBadge = (confidence = 1.0, source: 'ai' | 'manual' | 'system' = 'manual') => {
    if (source === 'manual') {
      return (
        <span className="px-2 py-0.5  text-[10px] font-medium bg-[var(--surface-muted)] text-[var(--lavender)] border border-[var(--surface-muted)]">
          {isZh ? '手动设定' : 'Manual'}
        </span>
      )
    }
    if (source === 'system') {
      return (
        <span className="px-2 py-0.5  text-[10px] font-medium bg-[var(--surface-muted)] text-[var(--lavender)] border border-[var(--surface-muted)]">
          {isZh ? '系统预设' : 'System'}
        </span>
      )
    }
    if (confidence >= 0.85) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5  text-[10px] font-medium bg-[var(--primary)] text-[var(--primary-foreground)] border border-[var(--primary)]">
          <Sparkles size={10} className="text-[var(--primary-foreground)]" />
          <span>✨ Canonical ({(confidence * 100).toFixed(0)}%)</span>
        </span>
      )
    }
    return (
        <span className="inline-flex items-center gap-1 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-secondary)]">
          <Sparkles size={10} className="text-[var(--text-secondary)]" />
        <span>✨ 待确认 ({(confidence * 100).toFixed(0)}%)</span>
      </span>
    )
  }

  const completeness = schemaState.completeness

  return (
    <div className="bg-[var(--surface)] rounded-2xl border-2 border-[var(--primary)] shadow-md ring-4 ring-[var(--primary)]/10 p-6 sm:p-7 space-y-6 transition-all">
      {/* Header - Core Visual Focus in Workspace with AI Organize Entry */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[var(--surface-muted)] gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9  bg-[var(--primary)] text-[var(--surface)] flex items-center justify-center font-mono font-extrabold text-sm shadow-sm shrink-0">
            05
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-extrabold text-[var(--lavender)] tracking-tight">
                {isZh ? '商品规格' : 'Product Specifications'}
              </h2>
              <span className="px-2.5 py-0.5  text-[11px] font-bold bg-[var(--primary)] text-[var(--surface)] shadow-2xs">
                ⭐ {isZh ? '核心工作区' : 'Core Workspace'}
              </span>
            </div>
            <p className="text-xs text-[var(--lavender)] mt-0.5">
              {isZh
                ? '描述商品本身的材质、功能与技术参数。已联动标准化规格模版。'
                : 'Describes the material, features, and technical specifications of the product itself.'}
            </p>
          </div>
        </div>

        {/* AI Organize Primary Action Button */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleAiOrganize}
            disabled={isAnalyzing || disabled}
            className="px-4 py-2  bg-[var(--primary)] hover:bg-[var(--interactive-hover)] active:bg-[var(--primary)] disabled:bg-[var(--surface-muted)] disabled:text-[var(--lavender)] disabled:cursor-not-allowed text-[var(--surface)] text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--primary)]"
          >
            {isAnalyzing ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Sparkles size={14} />
            )}
            <span>{isAnalyzing ? (isZh ? '正在整理商品…' : 'Analyzing...') : (isZh ? '[AI 整理]' : '[AI Organize]')}</span>
          </button>
        </div>
      </div>

      {/* Lightweight Loading State for AI Intelligence */}
      {isAnalyzing && (
        <div className="p-4 rounded-[var(--radius-card-nested)] bg-[var(--accent-primary-soft)] border border-[var(--accent-primary)] text-[var(--text-primary)] text-xs flex items-center gap-3 animate-pulse">
          <Loader2 size={18} className="text-[var(--accent-primary)] animate-spin shrink-0" />
          <div>
            <p className="font-bold text-[var(--accent-primary)]">{isZh ? '正在整理商品…' : 'Analyzing product specifications...'}</p>
            <p className="text-[11px] text-[var(--lavender)] mt-0.5">
              {isZh ? '从描述与结构化资料中归一化 Canonical 规范属性' : 'Extracting and normalizing canonical attributes'}
            </p>
          </div>
        </div>
      )}

      {/* AI Intelligence Result Summary Banner */}
      {aiReport && !isAnalyzing && (
        <div className="p-4 rounded-xl bg-gradient-to-r from-blue-50/90 via-indigo-50/50 to-[var(--surface)] border border-[var(--primary)] shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8  bg-[var(--primary)] text-[var(--surface)] flex items-center justify-center shrink-0 shadow-2xs">
              <Sparkles size={16} />
            </div>
            <div>
              <h4 className="text-xs font-extrabold text-[var(--lavender)]">
                {isZh ? 'AI 商品智能' : 'AI Product Intelligence'}
              </h4>
              <p className="text-xs text-[var(--lavender)] mt-0.5">
                {isZh
                  ? `发现 ${aiReport.summary.changeCount + aiReport.summary.errorCount} 项需要处理（新增 ${aiReport.summary.addCount} • 修改 ${aiReport.summary.updateCount} • 冲突 ${aiReport.summary.errorCount}）`
                  : `${aiReport.summary.changeCount + aiReport.summary.errorCount} items to review`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsDrawerOpen(true)}
              className="px-3.5 py-1.5  bg-[var(--surface)] border border-[var(--border)] text-[var(--ink)] text-xs font-medium hover:bg-[var(--surface-muted)] hover:border-[var(--border)] transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--primary)]"
            >
              {isZh ? '[查看修改]' : '[View Changes]'}
            </button>
            <button
              type="button"
              onClick={handleOneClickFix}
              disabled={isApplying}
              className="px-4 py-1.5  bg-[var(--primary)] hover:bg-[var(--interactive-hover)] active:bg-[var(--primary)] text-[var(--surface)] text-xs font-bold transition-all cursor-pointer disabled:bg-[var(--surface-muted)] disabled:text-[var(--lavender)] disabled:cursor-not-allowed shadow-2xs flex items-center gap-1.5 focus-visible:outline-2 focus-visible:outline-[var(--primary)]"
            >
              {isApplying ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              <span>{isZh ? '[一键修复]' : '[One-Click Fix]'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Toast Notice */}
      {applyNotice && (
        <div className="p-3 rounded-xl bg-[var(--acid-sage)] border border-[var(--acid-sage)] text-[var(--acid-sage)] text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={15} className="text-[var(--acid-sage)] shrink-0" />
            <span className="font-bold">{applyNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setApplyNotice(null)}
            className="text-[11px] text-[var(--acid-sage)] font-semibold hover:underline cursor-pointer"
          >
            {isZh ? '关闭' : 'Close'}
          </button>
        </div>
      )}

      {/* 属性完整度状态指示器 (Attribute Completeness Status Indicator) */}
      <div className="p-5 rounded-xl bg-gradient-to-r from-blue-50/80 via-indigo-50/40 to-slate-50 border border-[var(--primary)]/90 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[var(--primary)] text-[var(--surface)] flex items-center justify-center shadow-xs shrink-0">
              <ShieldCheck size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-[var(--lavender)]">
                  {isZh ? '属性完整度' : 'Attribute Completeness'}
                </h3>
                <span className="text-[10px] text-[var(--lavender)] font-mono">Canonical Audit</span>
              </div>
              <p className="text-xs text-[var(--lavender)] mt-0.5">
                {isZh
                  ? '实时监控当前商品 Canonical 规格模版的填写合规度与字段约束'
                  : 'Real-time audit for canonical schema completeness and field constraints'}
              </p>
            </div>
          </div>

          <div className="shrink-0">
            {completeness.invalidFields > 0 ? (
              <div className="flex items-center gap-2 px-3 py-1.5  bg-[var(--plum)] text-[var(--plum)] border border-[var(--plum)] shadow-2xs">
                <AlertCircle size={16} />
                <div className="text-left">
                  <span className="text-xs font-bold block">{isZh ? '格式需修正' : 'Invalid Attributes'}</span>
                  <span className="text-[10px] font-mono block">{completeness.invalidFields} {isZh ? '项格式异常' : 'errors'}</span>
                </div>
              </div>
            ) : completeness.requiredFields > completeness.completedRequiredFields ? (
              <div className="flex items-center gap-2 px-3 py-1.5  bg-[var(--acid-sage)] text-[var(--acid-sage)] border border-[var(--acid-sage)] shadow-2xs">
                <AlertTriangle size={16} className="text-[var(--acid-sage)]" />
                <div className="text-left">
                  <span className="text-xs font-bold block">{isZh ? '必填项待完善' : 'Incomplete Required'}</span>
                  <span className="text-[10px] font-mono block">
                    {isZh
                      ? `还差 ${completeness.requiredFields - completeness.completedRequiredFields} 项必填`
                      : `${completeness.requiredFields - completeness.completedRequiredFields} missing`}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1.5  bg-[var(--acid-sage)] text-[var(--acid-sage)] border border-[var(--acid-sage)] shadow-2xs">
                <CheckCircle2 size={16} className="text-[var(--acid-sage)]" />
                <div className="text-left">
                  <span className="text-xs font-bold block">{isZh ? '规格就绪 (100%)' : 'Schema Ready (100%)'}</span>
                  <span className="text-[10px] font-mono block">{isZh ? '满足所有校验条件' : 'All requirements met'}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Multi-segmented Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-bold text-[var(--lavender)]">
            <div className="flex items-center gap-2">
              <span>{isZh ? '总体规格完成率' : 'Overall Completion Rate'}</span>
              <span className="text-[11px] font-mono text-[var(--primary)]">
                ({completeness.completedFields} / {completeness.totalFields})
              </span>
            </div>
            <span className="font-mono font-extrabold text-[var(--lavender)] text-sm">
              {completeness.percentage}%
            </span>
          </div>

          <div className="w-full h-2.5 rounded-full bg-[var(--surface-muted)]/80 overflow-hidden flex">
            <div
              className={`h-full transition-all duration-500 ${
                completeness.invalidFields > 0
                  ? 'bg-[var(--plum)]'
                  : completeness.requiredPercentage === 100
                  ? 'bg-[var(--acid-sage)]'
                  : 'bg-[var(--primary)]'
              }`}
              style={{ width: `${completeness.percentage}%` }}
            />
          </div>
        </div>

        {/* Stat Cards Breakdown (4 Columns) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
          <div className="p-2.5 rounded-lg bg-[var(--surface)]/90 border border-[var(--surface-muted)]/80 space-y-1">
            <span className="text-[10px] text-[var(--lavender)] font-medium block">
              {isZh ? '必填规格符合度' : 'Required Fields'}
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-extrabold text-[var(--lavender)] font-mono">
                {completeness.completedRequiredFields} / {completeness.requiredFields}
              </span>
              <span
                className={`text-[10px] font-bold ${
                  completeness.completedRequiredFields === completeness.requiredFields
                    ? 'text-[var(--acid-sage)]'
                    : 'text-[var(--acid-sage)]'
                }`}
              >
                {completeness.requiredPercentage}%
              </span>
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-[var(--surface)]/90 border border-[var(--surface-muted)]/80 space-y-1">
            <span className="text-[10px] text-[var(--lavender)] font-medium block">
              {isZh ? '标准模版属性' : 'Standard Fields'}
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-extrabold text-[var(--lavender)] font-mono">
                {rules.size} {isZh ? '项' : 'fields'}
              </span>
              <span className="text-[10px] text-[var(--primary)] font-bold">Canonical</span>
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-[var(--surface)]/90 border border-[var(--surface-muted)]/80 space-y-1">
            <span className="text-[10px] text-[var(--lavender)] font-medium block">
              {isZh ? '扩展属性项' : 'Custom Fields'}
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-extrabold text-[var(--lavender)] font-mono">
                {schemaState.otherAttributes.length} {isZh ? '项' : 'fields'}
              </span>
              <span className="text-[10px] text-[var(--lavender)] font-bold">Custom</span>
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-[var(--surface)]/90 border border-[var(--surface-muted)]/80 space-y-1">
            <span className="text-[10px] text-[var(--lavender)] font-medium block">
              {isZh ? '数据校验状态' : 'Validation Status'}
            </span>
            <div className="flex items-baseline justify-between">
              <span
                className={`text-xs font-bold font-mono ${
                  completeness.invalidFields > 0 ? 'text-[var(--plum)]' : 'text-[var(--acid-sage)]'
                }`}
              >
                {completeness.invalidFields > 0
                  ? isZh
                    ? '格式异常'
                    : 'Error'
                  : isZh
                  ? '校验通过'
                  : 'Passed'}
              </span>
              <span className="text-[10px] text-[var(--lavender)] font-mono">API Sync</span>
            </div>
          </div>
        </div>

        {/* Interactive Field Status Chips */}
        {schemaState.completeness.items.length > 0 && (
          <div className="pt-2 border-t border-[var(--surface-muted)]/60">
            <div className="flex items-center justify-between text-[11px] font-bold text-[var(--lavender)] mb-2">
              <span>{isZh ? '标准属性状态明细 (点击可快速定位跳转)' : 'Standard Attributes Checklist'}</span>
              <span className="text-[10px] font-normal text-[var(--lavender)]">{isZh ? '根据 Canonical Rules 校验' : 'Validated by Canonical Rules'}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {schemaState.completeness.items.map((item) => {
                const tmplField = templateFieldMap.get(item.fieldKey.toLowerCase())
                const labelName = tmplField
                  ? isZh
                    ? tmplField.nameZh
                    : tmplField.nameEn
                  : item.label || item.fieldKey

                const isMissingReq = item.issue === 'required'
                const isInvalid = !item.valid && Boolean(item.value)
                const isOk = item.completed && item.valid

                return (
                  <button
                    key={item.fieldKey}
                    type="button"
                    onClick={() => scrollToField(item.fieldKey)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1  text-[11px] font-medium transition-all cursor-pointer border focus-visible:outline-2 focus-visible:outline-[var(--primary)] ${
                      isInvalid
                        ? 'bg-[var(--plum)] text-[var(--plum)] border-[var(--plum)] hover:bg-[var(--plum)]'
                        : isMissingReq
                        ? 'bg-[var(--acid-sage)] text-[var(--acid-sage)] border-[var(--acid-sage)] hover:bg-[var(--acid-sage)]'
                        : isOk
                        ? 'bg-[var(--surface)] text-[var(--lavender)] border-[var(--surface-muted)] hover:bg-[var(--surface-muted)]'
                        : 'bg-[var(--surface-muted)] text-[var(--lavender)] border-[var(--surface-muted)] hover:bg-[var(--surface-muted)]'
                    }`}
                  >
                    {isInvalid ? (
                      <AlertCircle size={11} className="text-[var(--plum)]" />
                    ) : isMissingReq ? (
                      <AlertTriangle size={11} className="text-[var(--acid-sage)]" />
                    ) : isOk ? (
                      <Check size={11} className="text-[var(--acid-sage)]" />
                    ) : null}
                    <span>{labelName}</span>
                    {item.required && !isOk && (
                      <span className="text-[9px] font-bold text-[var(--plum)] ml-0.5">*</span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Category Change Notice */}
      {categoryChangeNotice && (
        <div className="p-3 rounded-[var(--radius-card-nested)] bg-[var(--accent-primary-soft)] border border-[var(--accent-primary)] text-[var(--text-primary)] text-xs flex items-center justify-between gap-2 transition-all">
          <div className="flex items-center gap-2">
            <Info size={15} className="text-[var(--accent-primary)] shrink-0" />
            <span>{categoryChangeNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setCategoryChangeNotice(null)}
            className="text-[11px] font-semibold text-[var(--accent-primary)] hover:text-[var(--accent-primary-hover)] cursor-pointer"
          >
            {isZh ? '我知道了' : 'Dismiss'}
          </button>
        </div>
      )}

      {/* Legacy Fallback Warning Banner */}
      {!isLoading && isLegacyFallback && (
        <div className="p-3 rounded-xl bg-[var(--acid-sage)] border border-[var(--acid-sage)] text-[var(--acid-sage)] text-xs flex items-center gap-2 transition-all">
          <AlertCircle size={15} className="text-[var(--acid-sage)] shrink-0" />
          <span>
            {isZh
              ? '当前使用兼容数据（Legacy Fallback）。保存后将自动归一化并写入规范层。'
              : 'Currently using legacy compatibility data.'}
          </span>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="py-12 px-4 text-center rounded-xl bg-[var(--surface-muted)] border border-[var(--surface-muted)]/80 space-y-3">
          <Loader2 size={24} className="mx-auto text-[var(--primary)] animate-spin" />
          <div className="space-y-1">
            <p className="text-xs font-semibold text-[var(--lavender)]">
              {isZh ? '正在加载商品 Canonical 属性…' : 'Loading canonical attributes...'}
            </p>
          </div>
        </div>
      )}

      {/* Error State */}
      {!isLoading && error && (
        <div className="p-4 rounded-xl bg-[var(--plum)] border border-[var(--plum)] text-[var(--plum)] text-xs flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <AlertCircle size={16} className="text-[var(--plum)] shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">{isZh ? '商品属性加载失败' : 'Failed to load product attributes'}</p>
              <p className="text-[11px] text-[var(--plum)] mt-0.5">{error}</p>
            </div>
          </div>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="px-2.5 py-1  bg-[var(--surface)] border border-[var(--plum)] text-[var(--plum)] text-[11px] font-medium hover:bg-[var(--plum)]/60 transition-all cursor-pointer flex items-center gap-1"
            >
              <RefreshCw size={12} />
              <span>{isZh ? '重试' : 'Retry'}</span>
            </button>
          )}
        </div>
      )}

      {/* Empty State Banner */}
      {!isLoading && !error && attributeValues.length === 0 && rules.size === 0 && (
        <div className="p-3.5 rounded-xl bg-[var(--surface-muted)] border border-dashed border-[var(--surface-muted)] text-xs text-[var(--lavender)] flex items-center gap-2.5">
          <Info size={15} className="text-[var(--lavender)] shrink-0" />
          <span>
            {isZh
              ? '当前商品暂无已保存属性。您可以在下方添加自定义扩展属性。'
              : 'No saved attributes yet for this product. You can add custom attributes below.'}
          </span>
        </div>
      )}

      {/* Main Content Area */}
      {!isLoading && (
        <>
          {/* 1. Standard Specifications (标准规格) */}
          {rules.size > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold text-[var(--lavender)]">
                    {isZh ? '标准规格属性字段' : 'Standard Specification Fields'}
                  </h3>
                  <span className="px-2 py-0.5 text-[10px] font-bold  bg-[var(--primary)] text-[var(--primary-foreground)] border border-[var(--primary)]">
                    {rules.size} {isZh ? '项' : 'fields'}
                  </span>
                </div>
              </div>

              {/* Standard Specification Fields Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 p-4 rounded-xl bg-[var(--surface-muted)]/70 border border-[var(--surface-muted)]">
                {Array.from(rules.entries()).map(([fieldKey, baseRule]) => {
                  const effRule = effectiveRules.get(fieldKey) || baseRule
                  const condState =
                    conditionalResolution.states.get(fieldKey) ||
                    conditionalResolution.states.get(fieldKey.toLowerCase())

                  if (condState && condState.visible === false) {
                    return null
                  }

                  const tmplField = templateFieldMap.get(fieldKey.toLowerCase())
                  const valData = standardAttributeMap.get(fieldKey.toLowerCase())
                  const item = completenessItemMap.get(fieldKey.toLowerCase())

                  const value = valData?.value ?? ''
                  const confidence = valData?.confidence ?? 1.0
                  const source = valData?.source ?? 'manual'

                  const label = tmplField
                    ? isZh
                      ? tmplField.nameZh
                      : tmplField.nameEn
                    : effRule.fieldKey
                  const placeholder = isZh
                    ? effRule.placeholderZh || tmplField?.placeholderZh
                    : effRule.placeholderEn || tmplField?.placeholderEn

                  const fieldError = fieldErrors[fieldKey]
                  const isInvalid = Boolean(fieldError) || (item ? !item.valid && Boolean(value) : false)

                  const isRequired = effRule.required
                  const isConditionalRequired = Boolean(
                    condState?.required &&
                      condState?.triggeredRuleIds &&
                      condState.triggeredRuleIds.length > 0,
                  )

                  return (
                    <div
                      key={fieldKey}
                      id={`attr-field-${fieldKey}`}
                      className={`space-y-1.5 bg-[var(--surface)] p-3.5 rounded-xl border transition-all ${
                        isInvalid
                          ? 'border-[var(--plum)] bg-[var(--plum)]/30 ring-2 ring-[var(--plum)]/20'
                          : 'border-[var(--surface-muted)]/90 shadow-2xs hover:border-[var(--surface-muted)]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1.5">
                        <label
                          htmlFor={`attr-input-${fieldKey}`}
                          className="text-[11px] font-bold text-[var(--lavender)] flex items-center gap-1.5 truncate"
                        >
                          <span className="truncate">{label}</span>
                          {isConditionalRequired ? (
                            <span className="px-1.5 py-0.2  bg-[var(--primary)] text-[var(--primary-foreground)] text-[10px] font-bold border border-[var(--primary)] shrink-0">
                              {isZh ? '条件必填' : 'Required'}
                            </span>
                          ) : isRequired ? (
                            <span className="px-1.5 py-0.2  bg-[var(--plum)] text-[var(--plum)] text-[10px] font-bold border border-[var(--plum)] shrink-0">
                              {isZh ? '必填' : 'Required'}
                            </span>
                          ) : null}
                          {effRule.unit && (
                            <span className="text-[10px] text-[var(--lavender)] font-normal shrink-0">
                              ({effRule.unit})
                            </span>
                          )}
                        </label>

                        {/* Field State Indicator */}
                        <div className="shrink-0 flex items-center gap-1">
                          {isInvalid ? (
                            <span className="px-1.5 py-0.5  bg-[var(--plum)] text-[var(--plum)] text-[10px] font-bold border border-[var(--plum)] flex items-center gap-1">
                              <AlertCircle size={10} />
                              <span>{isZh ? '格式错误' : 'Invalid'}</span>
                            </span>
                          ) : item?.issue === 'required' ? (
                            <span className="px-1.5 py-0.5  bg-[var(--acid-sage)] text-[var(--acid-sage)] text-[10px] font-bold border border-[var(--acid-sage)] flex items-center gap-1">
                              <AlertTriangle size={10} />
                              <span>{isZh ? '缺失' : 'Missing'}</span>
                            </span>
                          ) : item?.completed ? (
                            <span className="px-1.5 py-0.5  bg-[var(--acid-sage)] text-[var(--acid-sage)] text-[10px] font-bold border border-[var(--acid-sage)] flex items-center gap-1">
                              <CheckCircle2 size={10} />
                              <span>✓</span>
                            </span>
                          ) : (
                            <span className="text-[10px] text-[var(--lavender)] font-normal">
                              {isZh ? '选填' : 'Optional'}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Input Control by Rule Type */}
                      {effRule.type === 'select' ? (
                        <select
                          id={`attr-input-${fieldKey}`}
                          aria-label={label}
                          value={value}
                          onChange={(e) =>
                            handleStandardFieldChange(
                              fieldKey,
                              e.target.value,
                              effRule,
                              label,
                            )
                          }
                          disabled={disabled}
                          className="w-full h-8 px-2.5  text-xs text-[var(--lavender)] bg-[var(--surface-muted)] border border-[var(--surface-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)] focus:bg-[var(--surface)] transition-all"
                        >
                          <option value="">{isZh ? '-- 请选择 --' : '-- Select --'}</option>
                          {(effRule.allowedValues || []).map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      ) : effRule.type === 'boolean' ? (
                        <div className="flex items-center justify-between pt-1">
                          <button
                            type="button"
                            onClick={() =>
                              handleStandardFieldChange(
                                fieldKey,
                                value === 'true' ? 'false' : 'true',
                                effRule,
                                label,
                              )
                            }
                            disabled={disabled}
                            className={`h-7 px-3  text-xs font-medium transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--primary)] ${
                              value === 'true'
                                ? 'bg-[var(--primary)] text-[var(--surface)] hover:bg-[var(--interactive-hover)]'
                                : 'bg-[var(--surface)] border border-[var(--border)] text-[var(--ink)] hover:bg-[var(--surface-muted)]'
                            }`}
                          >
                            {value === 'true'
                              ? isZh
                                ? '已启用 / 支持'
                                : 'Supported'
                              : isZh
                              ? '未启用 / 否'
                              : 'No'}
                          </button>
                          {value && renderConfidenceBadge(confidence, source)}
                        </div>
                      ) : (
                        <div>
                          <input
                            id={`attr-input-${fieldKey}`}
                            aria-label={label}
                            type={effRule.type === 'number' ? 'number' : 'text'}
                            value={value}
                            onChange={(e) =>
                              handleStandardFieldChange(
                                fieldKey,
                                e.target.value,
                                effRule,
                                label,
                              )
                            }
                            disabled={disabled}
                            placeholder={placeholder || (isZh ? '输入属性值...' : 'Enter value...')}
                            className="w-full h-8 px-2.5  text-xs text-[var(--lavender)] bg-[var(--surface-muted)] border border-[var(--surface-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)] focus:bg-[var(--surface)] transition-all"
                          />
                        </div>
                      )}

                      {effRule.type !== 'boolean' && value && (
                        <div className="pt-0.5 flex justify-end">
                          {renderConfidenceBadge(confidence, source)}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="py-6 px-4 text-center rounded-xl bg-[var(--surface-muted)] border border-dashed border-[var(--surface-muted)] space-y-1.5">
              <Sliders size={20} className="mx-auto text-[var(--lavender)] mb-1" />
              <h4 className="text-xs font-bold text-[var(--lavender)]">
                {isZh ? '当前分类暂无预定义标准规格' : 'No Standard Specification Predefined'}
              </h4>
            </div>
          )}

          {/* 2. Other Attributes (扩展自定义属性) */}
          <div className="space-y-3 pt-3 border-t border-[var(--surface-muted)]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sliders size={14} className="text-[var(--lavender)]" />
                <h3 className="text-xs font-bold text-[var(--lavender)]">
                  {isZh ? '扩展自定义属性' : 'Custom Attributes'}
                </h3>
                <span className="px-2 py-0.5 text-[10px] font-bold  bg-[var(--surface-muted)] text-[var(--lavender)]">
                  {schemaState.otherAttributes.length}
                </span>
              </div>
            </div>

            {schemaState.otherAttributes.length > 0 ? (
              <div className="space-y-2">
                {schemaState.otherAttributes.map((attr) => (
                  <div
                    key={attr.fieldKey}
                    className="p-2.5 rounded-xl bg-[var(--surface-muted)] border border-[var(--surface-muted)] grid grid-cols-12 gap-2 items-center"
                  >
                    <div className="col-span-3">
                      <span className="text-[11px] font-bold text-[var(--lavender)] block truncate">
                        {attr.label || attr.fieldKey}
                      </span>
                    </div>

                    <div className="col-span-4">
                      <input
                        type={attr.type === 'number' ? 'number' : 'text'}
                        value={attr.value}
                        onChange={(e) => handleUpdateOtherValue(attr.fieldKey, e.target.value)}
                        placeholder={isZh ? '属性值' : 'Value'}
                        className="w-full h-8 px-2.5  bg-[var(--surface)] border border-[var(--surface-muted)] text-xs text-[var(--lavender)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                      />
                    </div>

                    <div className="col-span-2 flex items-center justify-center">
                      {renderConfidenceBadge(attr.confidence, attr.source)}
                    </div>

                    <div className="col-span-2 flex items-center justify-center">
                      <span className="text-[10px] text-[var(--lavender)] font-medium uppercase font-mono">
                        {attr.type}
                      </span>
                    </div>

                    <div className="col-span-1 text-right">
                      <button
                        type="button"
                        onClick={() => handleRemoveOther(attr.fieldKey)}
                        className="p-1 text-[var(--lavender)] hover:text-[var(--plum)]  cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-[var(--primary)]"
                        title={isZh ? '移除' : 'Remove'}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center py-2 text-[11px] text-[var(--lavender)]">
                {isZh ? '暂无扩展自定义属性。可在下方自由添加。' : 'No custom attributes yet. Add below.'}
              </p>
            )}

            {/* Add Custom Attribute Form */}
            <div className="pt-2">
              {customError && (
                <p className="text-xs text-[var(--plum)] font-medium mb-1.5">{customError}</p>
              )}

              <div
                className="grid grid-cols-12 gap-2 items-center bg-[var(--surface-muted)]/80 p-3 rounded-xl border border-[var(--surface-muted)]"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddCustomAttribute()
                  }
                }}
              >
                <div className="col-span-4">
                  <input
                    type="text"
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value)}
                    placeholder={
                      isZh
                        ? '属性名 (如: water_resistance)'
                        : 'Key (e.g. water_resistance)'
                    }
                    className="w-full h-8 px-2.5  bg-[var(--surface)] border border-[var(--surface-muted)] text-xs text-[var(--lavender)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                  />
                </div>

                <div className="col-span-4">
                  <input
                    type="text"
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                    placeholder={isZh ? '属性值 (如: IP68)' : 'Value (e.g. IP68)'}
                    className="w-full h-8 px-2.5  bg-[var(--surface)] border border-[var(--surface-muted)] text-xs text-[var(--lavender)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                  />
                </div>

                <div className="col-span-2">
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as any)}
                    className="w-full h-8 px-2  bg-[var(--surface)] border border-[var(--surface-muted)] text-xs text-[var(--lavender)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                  >
                    <option value="text">Text</option>
                    <option value="number">Number</option>
                    <option value="boolean">Boolean</option>
                    <option value="select">Select</option>
                  </select>
                </div>

                <div className="col-span-2 text-right">
                  <button
                    type="button"
                    onClick={() => handleAddCustomAttribute()}
                    disabled={disabled}
                    className="w-full h-8 px-3  bg-[var(--primary)] hover:bg-[var(--interactive-hover)] active:bg-[var(--primary)] text-[var(--surface)] text-xs font-medium flex items-center justify-center gap-1 cursor-pointer disabled:bg-[var(--surface-muted)] disabled:text-[var(--lavender)] disabled:cursor-not-allowed transition-all focus-visible:outline-2 focus-visible:outline-[var(--primary)]"
                  >
                    <Plus size={13} />
                    <span>{isZh ? '添加' : 'Add'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* AI Intelligence Drawer */}
      <ProductAiIntelligenceDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        report={aiReport}
        onApplyChanges={handleApplyAiChanges}
        isApplying={isApplying}
      />
    </div>
  )
}
