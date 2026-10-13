'use client'

import React, { useEffect, useRef, useState } from 'react'
import {
  X,
  Sparkles,
  Check,
  Ban,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Loader2,
} from 'lucide-react'
import type { ProductAiReport, ProductAiChange } from '@/lib/product/ai-intelligence'
import { useLanguage } from '@/context/LanguageContext'

interface ProductAiIntelligenceDrawerProps {
  isOpen: boolean
  onClose: () => void
  report: ProductAiReport | null
  onApplyChanges: (changes: ProductAiChange[]) => Promise<void>
  isApplying?: boolean
}

export function ProductAiIntelligenceDrawer({
  isOpen,
  onClose,
  report,
  onApplyChanges,
  isApplying = false,
}: ProductAiIntelligenceDrawerProps) {
  const { isZh } = useLanguage()
  const drawerRef = useRef<HTMLDivElement>(null)
  const closeBtnRef = useRef<HTMLButtonElement>(null)

  // Local state for tracking change statuses (pending, accepted, rejected)
  const [localChanges, setLocalChanges] = useState<ProductAiChange[]>([])
  const [expandedReasonId, setExpandedReasonId] = useState<string | null>(null)

  useEffect(() => {
    if (report?.changes) {
      setLocalChanges(report.changes)
    }
  }, [report])

  // Escape key handler and focus trap
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    if (closeBtnRef.current) {
      closeBtnRef.current.focus()
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleItemStatusChange = (id: string, status: 'accepted' | 'rejected') => {
    setLocalChanges((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status } : item))
    )
  }

  const handleApplyAll = async () => {
    // Mark all pending as accepted
    const updated = localChanges.map((c) =>
      c.status === 'pending' ? { ...c, status: 'accepted' as const } : c
    )
    setLocalChanges(updated)
    await onApplyChanges(updated)
  }

  const adds = localChanges.filter((c) => c.type === 'add')
  const updates = localChanges.filter((c) => c.type === 'update')
  const conflicts = report?.findings.filter((f) => f.severity === 'error') || []

  const pendingCount = localChanges.filter((c) => c.status === 'pending').length
  const acceptedCount = localChanges.filter((c) => c.status === 'accepted').length

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-[var(--surface-muted)]/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-drawer-title"
        className="w-full max-w-md bg-[var(--surface)] h-full shadow-2xl flex flex-col justify-between border-l border-[var(--surface-muted)] animate-in slide-in-from-right duration-250"
      >
        {/* Drawer Header */}
        <div className="p-5 border-b border-[var(--surface-muted)] flex items-center justify-between bg-[var(--surface-muted)]/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8  bg-[var(--primary)] text-[var(--surface)] flex items-center justify-center shadow-xs shrink-0">
              <Sparkles size={16} />
            </div>
            <div>
              <h2 id="ai-drawer-title" className="text-base font-extrabold text-[var(--lavender)]">
                {isZh ? '修改报告' : 'Modification Report'}
              </h2>
              <p className="text-xs text-[var(--lavender)]">
                {isZh ? 'AI 整理发现的优化建议与冲突分析' : 'AI optimization suggestions and conflict report'}
              </p>
            </div>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            aria-label={isZh ? '关闭' : 'Close'}
            className="p-1.5 text-[var(--lavender)] hover:text-[var(--lavender)] hover:bg-[var(--surface-muted)]/60  cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-[var(--primary)]"
          >
            <X size={18} />
          </button>
        </div>

        {/* Drawer Body */}
        <div className="p-5 overflow-y-auto space-y-6 flex-1 text-[var(--lavender)] text-xs">
          {/* Summary Banner */}
          <div className="p-3.5 rounded-xl bg-[var(--primary)]/80 border border-[var(--primary)] flex items-center justify-between gap-2">
            <div>
              <p className="font-bold text-[var(--lavender)]">
                {isZh
                  ? `共发现 ${localChanges.length} 项处理建议`
                  : `${localChanges.length} suggestions found`}
              </p>
              <div className="flex items-center gap-2 text-[11px] text-[var(--lavender)] mt-0.5 font-mono">
                <span>新增 {adds.length}</span>
                <span>•</span>
                <span>修改 {updates.length}</span>
                <span>•</span>
                <span>冲突 {conflicts.length}</span>
              </div>
            </div>
            {acceptedCount > 0 && (
              <span className="px-2 py-0.5  bg-[var(--acid-sage)] text-[var(--acid-sage)] font-bold text-[10px]">
                {isZh ? `已选择 ${acceptedCount} 项` : `${acceptedCount} selected`}
              </span>
            )}
          </div>

          {/* Section 1: 新增 (Adds) */}
          {adds.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between border-b border-[var(--surface-muted)] pb-1.5">
                <span className="font-bold text-[var(--lavender)] text-xs flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[var(--primary)]"></span>
                  <span>{isZh ? '新增属性' : 'Add Attributes'}</span>
                </span>
                <span className="text-[10px] font-mono text-[var(--lavender)]">{adds.length} 项</span>
              </div>

              <div className="space-y-2">
                {adds.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl bg-[var(--surface-muted)] border border-[var(--surface-muted)] space-y-2 hover:border-[var(--surface-muted)] transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[var(--lavender)] text-xs">
                        {item.label || item.fieldKey}
                      </span>
                      <span className="text-[10px] text-[var(--primary)] bg-[var(--primary)] px-2 py-0.5  font-medium border border-[var(--primary)]">
                        → {item.nextValue}
                      </span>
                    </div>
                    {item.reason && (
                      <p className="text-[11px] text-[var(--lavender)] leading-normal">{item.reason}</p>
                    )}

                    <div className="flex items-center justify-end gap-1.5 pt-1">
                      {item.status === 'accepted' ? (
                        <span className="px-2 py-0.5  bg-[var(--acid-sage)] text-[var(--acid-sage)] border border-[var(--acid-sage)] font-bold text-[10px] flex items-center gap-1">
                          <Check size={11} /> {isZh ? '已同意应用' : 'Accepted'}
                        </span>
                      ) : item.status === 'rejected' ? (
                        <span className="px-2 py-0.5  bg-[var(--surface-muted)] text-[var(--lavender)] border border-[var(--surface-muted)] font-bold text-[10px] flex items-center gap-1">
                          <Ban size={11} /> {isZh ? '已忽略' : 'Ignored'}
                        </span>
                      ) : null}

                      <button
                        type="button"
                        onClick={() => handleItemStatusChange(item.id, 'accepted')}
                        className={`h-6 px-2.5  text-[11px] font-medium cursor-pointer transition-all focus-visible:outline-2 focus-visible:outline-[var(--primary)] ${
                          item.status === 'accepted'
                            ? 'bg-[var(--primary)] text-[var(--surface)]'
                            : 'bg-[var(--surface)] border border-[var(--border)] text-[var(--ink)] hover:bg-[var(--primary)] hover:text-[var(--primary)]'
                        }`}
                      >
                        {isZh ? '应用' : 'Apply'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleItemStatusChange(item.id, 'rejected')}
                        className={`h-6 px-2.5  text-[11px] font-medium cursor-pointer transition-all focus-visible:outline-2 focus-visible:outline-[var(--primary)] ${
                          item.status === 'rejected'
                            ? 'bg-[var(--surface-muted)] text-[var(--lavender)]'
                            : 'bg-[var(--surface)] border border-[var(--border)] text-[var(--lavender)] hover:bg-[var(--surface-muted)]'
                        }`}
                      >
                        {isZh ? '忽略' : 'Ignore'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 2: 修改 (Updates) */}
          {updates.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between border-b border-[var(--surface-muted)] pb-1.5">
                <span className="font-bold text-[var(--lavender)] text-xs flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[var(--acid-sage)]"></span>
                  <span>{isZh ? '规范调整 / 修正' : 'Value Updates'}</span>
                </span>
                <span className="text-[10px] font-mono text-[var(--lavender)]">{updates.length} 项</span>
              </div>

              <div className="space-y-2">
                {updates.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl bg-[var(--surface-muted)] border border-[var(--surface-muted)] space-y-2 hover:border-[var(--surface-muted)] transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[var(--lavender)] text-xs">
                        {item.label || item.fieldKey}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] bg-[var(--surface)] p-2 rounded-lg border border-[var(--surface-muted)] font-mono">
                      <span className="text-[var(--lavender)] line-through truncate max-w-[120px]">
                        {item.previousValue || '(空)'}
                      </span>
                      <ArrowRight size={12} className="text-[var(--primary)] shrink-0" />
                      <span className="text-[var(--primary)] font-bold truncate">
                        {item.nextValue}
                      </span>
                    </div>

                    {item.reason && (
                      <p className="text-[11px] text-[var(--lavender)] leading-normal">{item.reason}</p>
                    )}

                    <div className="flex items-center justify-end gap-1.5 pt-1">
                      {item.status === 'accepted' ? (
                        <span className="px-2 py-0.5  bg-[var(--acid-sage)] text-[var(--acid-sage)] border border-[var(--acid-sage)] font-bold text-[10px] flex items-center gap-1">
                          <Check size={11} /> {isZh ? '已同意应用' : 'Accepted'}
                        </span>
                      ) : item.status === 'rejected' ? (
                        <span className="px-2 py-0.5  bg-[var(--surface-muted)] text-[var(--lavender)] border border-[var(--surface-muted)] font-bold text-[10px] flex items-center gap-1">
                          <Ban size={11} /> {isZh ? '已忽略' : 'Ignored'}
                        </span>
                      ) : null}

                      <button
                        type="button"
                        onClick={() => handleItemStatusChange(item.id, 'accepted')}
                        className={`h-6 px-2.5  text-[11px] font-medium cursor-pointer transition-all focus-visible:outline-2 focus-visible:outline-[var(--primary)] ${
                          item.status === 'accepted'
                            ? 'bg-[var(--primary)] text-[var(--surface)]'
                            : 'bg-[var(--surface)] border border-[var(--border)] text-[var(--ink)] hover:bg-[var(--primary)] hover:text-[var(--primary)]'
                        }`}
                      >
                        {isZh ? '应用' : 'Apply'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleItemStatusChange(item.id, 'rejected')}
                        className={`h-6 px-2.5  text-[11px] font-medium cursor-pointer transition-all focus-visible:outline-2 focus-visible:outline-[var(--primary)] ${
                          item.status === 'rejected'
                            ? 'bg-[var(--surface-muted)] text-[var(--lavender)]'
                            : 'bg-[var(--surface)] border border-[var(--border)] text-[var(--lavender)] hover:bg-[var(--surface-muted)]'
                        }`}
                      >
                        {isZh ? '忽略' : 'Ignore'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 3: 冲突 (Conflicts & Findings) */}
          {(conflicts.length > 0 || (report?.findings && report.findings.length > 0)) && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between border-b border-[var(--surface-muted)] pb-1.5">
                <span className="font-bold text-[var(--lavender)] text-xs flex items-center gap-1.5">
                  <AlertTriangle size={14} className="text-[var(--acid-sage)]" />
                  <span>{isZh ? '属性冲突与资料检查' : 'Conflicts & Findings'}</span>
                </span>
              </div>

              <div className="space-y-2">
                {report?.findings.map((f) => (
                  <div
                    key={f.id}
                    className={`p-3 rounded-xl border text-xs space-y-1 ${
                      f.severity === 'error'
                        ? 'bg-[var(--plum)]/70 border-[var(--plum)] text-[var(--plum)]'
                        : 'bg-[var(--acid-sage)]/70 border-[var(--acid-sage)] text-[var(--acid-sage)]'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold">
                      <span>{f.label || f.fieldKey || '属性冲突'}</span>
                    </div>
                    <p className="text-[11px] opacity-90 leading-relaxed">{f.message}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 4: 数据检查 (Readiness Checklist - Clean, no scores) */}
          {report?.readinessChecks && report.readinessChecks.length > 0 && (
            <div className="p-3.5 rounded-xl bg-[var(--surface-muted)] border border-[var(--surface-muted)] space-y-2">
              <span className="font-bold text-[var(--lavender)] text-xs block">
                {isZh ? '数据检查' : 'Data Check'}
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                {report.readinessChecks.map((chk, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-1.5 p-2 bg-[var(--surface)] rounded-lg border border-[var(--surface-muted)] font-medium"
                  >
                    {chk.status === 'pass' ? (
                      <CheckCircle2 size={13} className="text-[var(--acid-sage)] shrink-0" />
                    ) : (
                      <AlertTriangle size={13} className="text-[var(--acid-sage)] shrink-0" />
                    )}
                    <span className="truncate">{chk.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 5: Agent 理解测试 (Simulation) */}
          {report?.agentSimulations && report.agentSimulations.length > 0 && (
            <div className="p-3.5 rounded-xl bg-[var(--primary)]/50 border border-[var(--primary)]/80 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--primary)]">
                <HelpCircle size={14} className="text-[var(--primary)]" />
                <span>{isZh ? 'AI 理解测试' : 'Agent Simulation Test'}</span>
              </div>

              {report.agentSimulations.map((sim, i) => (
                <div key={i} className="space-y-1 bg-[var(--surface)] p-2.5 rounded-lg border border-[var(--primary)] text-[11px]">
                  <p className="font-bold text-[var(--lavender)]">问题：{sim.question}</p>
                  <p className="text-[var(--lavender)]">结果：{sim.answer}</p>
                  {sim.reason && (
                    <div>
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedReasonId(expandedReasonId === `sim-${i}` ? null : `sim-${i}`)
                        }
                        className="text-[10px] font-semibold text-[var(--primary)] hover:underline cursor-pointer mt-1"
                      >
                        {expandedReasonId === `sim-${i}`
                          ? isZh
                            ? '收起原因'
                            : 'Hide reason'
                          : isZh
                          ? '[查看原因]'
                          : '[View reason]'}
                      </button>
                      {expandedReasonId === `sim-${i}` && (
                        <p className="text-[10px] text-[var(--lavender)] mt-1 p-1.5 bg-[var(--surface-muted)] rounded border border-[var(--surface-muted)]">
                          {sim.reason}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Drawer Footer */}
        <div className="p-4 border-t border-[var(--surface-muted)] bg-[var(--surface-muted)]/90 flex items-center justify-between gap-3">
          <div className="text-[11px] text-[var(--lavender)]">
            {pendingCount > 0 ? (
              <span>{isZh ? `尚有 ${pendingCount} 项待选择` : `${pendingCount} pending`}</span>
            ) : (
              <span>{isZh ? '已准备就绪' : 'Ready'}</span>
            )}
          </div>

          <button
            type="button"
            onClick={handleApplyAll}
            disabled={isApplying || localChanges.length === 0}
            className="px-5 h-9 bg-[var(--primary)] hover:bg-[var(--primary)] active:bg-[var(--primary)] text-[var(--surface)] text-xs font-bold  transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:bg-[var(--surface-muted)] disabled:text-[var(--lavender)] disabled:cursor-not-allowed shadow-xs focus-visible:outline-2 focus-visible:outline-[var(--primary)]"
          >
            {isApplying ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>{isZh ? '正在应用修改…' : 'Applying...'}</span>
              </>
            ) : (
              <>
                <Sparkles size={14} />
                <span>{isZh ? '[应用结果]' : '[Apply Results]'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
