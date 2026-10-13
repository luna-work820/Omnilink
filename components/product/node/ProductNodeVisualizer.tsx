'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  ShieldCheck,
  Zap,
  CheckCircle2,
  Edit3,
  Save,
} from 'lucide-react'
import { useLanguage } from '@/context/LanguageContext'
import type { DemoProduct } from '@/lib/products/demo-data'

interface ProductNodeVisualizerProps {
  product: DemoProduct
}

export function ProductNodeVisualizer({ product }: ProductNodeVisualizerProps) {
  const { isZh } = useLanguage()
  const [attributes, setAttributes] = useState<Record<string, string | number | boolean>>(product.semantic_data.attributes)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [isSaved, setIsSaved] = useState(false)

  const handleStartEdit = (key: string, val: string | number | boolean) => {
    setEditingKey(key)
    setEditValue(String(val))
  }

  const handleSaveEdit = (key: string) => {
    setAttributes((prev) => ({
      ...prev,
      [key]: editValue,
    }))
    setEditingKey(null)
    setIsSaved(true)
    setTimeout(() => setIsSaved(false), 2000)
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* 顶部导航 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href={`/dashboard/products/${product.id}/edit`}
            className="w-9 h-9 rounded-full bg-[var(--surface)] border border-[var(--border)] hover:bg-[var(--surface-muted)] flex items-center justify-center text-[var(--ink)] transition-colors shadow-sm"
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[var(--lavender)]">
                {isZh ? '商品语义节点拓扑' : 'Product Semantic Node'}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-[var(--acid-sage)]/20 text-[var(--ink)] text-[10px] font-bold">
                MCP Agent Protocol v2.4
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-[var(--ink)] mt-0.5">
              {isZh ? product.name : product.name_en}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/products/${product.id}/edit`}
            className="px-4 py-2 rounded-full bg-[var(--surface)] border border-[var(--border)] text-xs font-bold text-[var(--ink)] hover:border-[var(--ink)] transition-colors shadow-sm"
          >
            {isZh ? '返回商品编辑' : 'Back to Product Edit'}
          </Link>
        </div>
      </div>

      {/* 核心 AI 节点状态大横幅 */}
      <div className="crextio-dark-card p-6 relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-[var(--acid-sage)] text-[var(--ink)] text-xs font-bold shadow-sm">
                ● LIVE NODE
              </span>
              <span className="text-xs text-[var(--surface)]/70">
                {isZh ? '全局唯一语义节点 ID' : 'Global Semantic Node ID'}: <code className="text-[var(--surface)] font-mono">{product.id}#semantic</code>
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-[var(--surface)]">
              {isZh ? '自主智能体 (AI Agent) 意图直连就绪' : 'Autonomous AI Agent Intent Stream Ready'}
            </h2>
            <p className="text-xs text-[var(--surface)]/80 leading-relaxed">
              {isZh
                ? '此节点已将非结构化产品信息抽取为高阶几何向量与机器可验证事实。AI 导购与搜索助理在回答买家复杂问题时，将以本节点作为真实性知识溯源点。'
                : 'This product has been transformed into high-dimensional semantic vectors and machine-verifiable factual triples.'}
            </p>
          </div>

          <div className="bg-[var(--surface)]/10 rounded-2xl p-4 border border-[var(--surface)]/10 shrink-0 text-center space-y-1">
            <div className="text-xs text-[var(--surface)]/70 font-semibold">{isZh ? '语义健康置信度' : 'Node Health'}</div>
            <div className="text-3xl font-bold text-[var(--acid-sage)] tnum">
              {(product.semantic_data.confidence * 100).toFixed(1)}%
            </div>
            <div className="text-[10px] text-[var(--surface)]/60 font-mono">100% Deterministic</div>
          </div>
        </div>
      </div>

      {/* 3 列状态卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="crextio-card p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--lavender)]">{isZh ? '结构化数据' : 'Structured Data'}</span>
            <CheckCircle2 size={16} className="text-[var(--acid-sage)]" />
          </div>
          <div className="text-base font-bold text-[var(--ink)]">{isZh ? '已完成模式校验' : 'Schema Validated'}</div>
          <p className="text-[11px] text-[var(--lavender)]">
            {isZh ? '符合 Schema.org Product 与 OpenCommerce 规范' : 'Schema.org compliant'}
          </p>
        </div>

        <div className="crextio-card p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--lavender)]">{isZh ? '推理证据链' : 'Evidence Chain'}</span>
            <ShieldCheck size={16} className="text-[var(--lavender)]" />
          </div>
          <div className="text-base font-bold text-[var(--ink)]">{product.evidence.length} {isZh ? '条官方存证' : 'Verified Evidences'}</div>
          <p className="text-[11px] text-[var(--lavender)]">
            {isZh ? '经过国家实验室、官方白皮书交叉验证' : 'Cross-verified with lab certificates'}
          </p>
        </div>

        <div className="crextio-card p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--lavender)]">{isZh ? 'Agent 访问权限' : 'Agent Access'}</span>
            <Zap size={16} className="text-[#e0652b]" />
          </div>
          <div className="text-base font-bold text-[var(--ink)]">{isZh ? '全网公共开放' : 'Public Discovery'}</div>
          <p className="text-[11px] text-[var(--lavender)]">
            {isZh ? '支持 ChatGPT / Claude / Gemini 导购实时检索' : 'Accessible by frontier models'}
          </p>
        </div>
      </div>

      {/* 核心语义属性编辑面板 */}
      <div className="crextio-card p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-[var(--ink)]">
              {isZh ? '语义属性矩阵 (Semantic Attributes Matrix)' : 'Semantic Attributes Matrix'}
            </h3>
            <p className="text-xs text-[var(--lavender)] mt-0.5">
              {isZh ? '点击属性值可直接进行在线微调与保存：' : 'Click any attribute value to inline-edit:'}
            </p>
          </div>
          {isSaved && (
            <span className="text-xs font-bold text-[var(--acid-sage)] bg-[var(--acid-sage)] px-2.5 py-1 rounded-full animate-in fade-in">
              ✓ {isZh ? '属性已更新' : 'Updated'}
            </span>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {Object.entries(attributes).map(([key, val]) => {
            const isEditing = editingKey === key
            return (
              <div
                key={key}
                className="p-4 rounded-xl bg-[var(--surface-muted)] border border-[var(--border)] flex items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-mono text-[var(--lavender)] capitalize">
                    {key.replace(/_/g, ' ')}
                  </div>
                  {isEditing ? (
                    <div className="flex items-center gap-2 mt-1">
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="h-8 px-2.5 rounded-lg bg-[var(--surface)] border border-[var(--ink)] text-xs font-bold text-[var(--ink)] w-full"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveEdit(key)}
                        className="px-2.5 py-1 bg-[var(--ink)] text-[var(--surface)] rounded-lg text-xs font-bold shrink-0"
                      >
                        <Save size={12} />
                      </button>
                    </div>
                  ) : (
                    <div className="text-xs font-bold text-[var(--ink)] mt-0.5 truncate">
                      {String(val)}
                    </div>
                  )}
                </div>

                {!isEditing && (
                  <button
                    type="button"
                    onClick={() => handleStartEdit(key, val)}
                    className="p-1.5 hover:bg-[var(--surface)] text-[var(--lavender)] hover:text-[var(--ink)] rounded-lg transition-colors shrink-0"
                    title="Edit"
                  >
                    <Edit3 size={13} />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* 真实存证列表 */}
      <div className="crextio-card p-6 space-y-4">
        <h3 className="text-sm font-bold text-[var(--ink)]">
          {isZh ? '真实存证溯源 (Verifiable Evidence)' : 'Verifiable Evidence'}
        </h3>
        <div className="space-y-3">
          {product.evidence.map((ev, i) => (
            <div
              key={i}
              className="p-4 rounded-xl bg-[var(--surface-muted)] border border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[var(--ink)] font-mono">{ev.semantic_field}</span>
                  <span className="px-2 py-0.2 rounded-md bg-[var(--surface)] border border-[var(--border)] text-[10px] font-semibold text-[var(--lavender)]">
                    {ev.evidence_type}
                  </span>
                </div>
                <div className="text-xs font-semibold text-[var(--ink)] mt-1">{ev.field_value}</div>
                <div className="text-[11px] text-[var(--lavender)] mt-0.5">{ev.evidence_source}</div>
              </div>

              <div className="text-right shrink-0">
                <span className="px-2.5 py-1 rounded-full bg-[var(--acid-sage)] text-[var(--acid-sage)] text-[11px] font-bold">
                  {(ev.confidence * 100).toFixed(0)}% 置信
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
