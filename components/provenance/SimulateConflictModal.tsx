'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import {
  X,
  ShieldAlert,
  CheckCircle2,
  ArrowRight,
  Send,
  Lock,
} from 'lucide-react'

interface SimulateConflictModalProps {
  isOpen: boolean
  onClose: () => void
  onAuthorizedGranted?: () => void
}

export function SimulateConflictModal({
  isOpen,
  onClose,
  onAuthorizedGranted,
}: SimulateConflictModalProps) {
  const [viewState, setViewState] = useState<'detected' | 'applying' | 'success'>('detected')
  const [requestStoreName, setRequestStoreName] = useState('Nordic Living Concept')
  const [selectedScope, setSelectedScope] = useState('全渠道商品主图与详情页展示')
  const [applicantNote, setApplicantNote] = useState('希望在北欧生活馆精选栏目中展示该雨林扩香仪系列。')

  if (!isOpen) return null

  const handleSendRequest = () => {
    setViewState('success')
    if (onAuthorizedGranted) {
      onAuthorizedGranted()
    }
  }

  const handleResetAndClose = () => {
    setViewState('detected')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-[var(--surface-muted)]/60 backdrop-blur-xs transition-opacity">
      <div
        className="w-full max-w-xl bg-[var(--surface)] dark:bg-[var(--surface-muted)] rounded-[8px] shadow-2xl border border-[var(--surface-muted)] dark:border-[var(--surface-muted)] overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Scenario Header Bar */}
        <div className="px-5 py-3 bg-[var(--surface-muted)] text-[var(--surface)] flex items-center justify-between border-b border-[var(--surface-muted)]">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-[2px] bg-[var(--primary)]/20 text-[var(--primary)] font-semibold border border-[var(--primary)]/30">
              交互演示
            </span>
            <span className="text-xs font-bold tracking-tight">
              模拟第三方商家上传受保护素材时的平台拦截流
            </span>
          </div>
          <button
            onClick={handleResetAndClose}
            className="w-6 h-6 rounded-[3px] flex items-center justify-center text-[var(--lavender)] hover:text-[var(--surface)] hover:bg-[var(--surface-muted)] transition-colors cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {viewState === 'detected' && (
            <div className="space-y-5">
              {/* Alert Header */}
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10  bg-[var(--acid-sage)] dark:bg-[var(--acid-sage)]/40 border border-[var(--acid-sage)] dark:border-[var(--acid-sage)]/60 flex items-center justify-center text-[var(--acid-sage)] shrink-0">
                  <ShieldAlert size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[var(--lavender)] dark:text-[var(--surface)]">
                    发现受保护作品
                  </h3>
                  <p className="text-xs text-[var(--lavender)] mt-1 leading-relaxed">
                    这张图片可能属于 Omnilink 中已有的受保护作品。平台已自动进行特征比对与权限检索。
                  </p>
                </div>
              </div>

              {/* Match Card */}
              <div className="p-4 rounded-[6px] bg-[var(--surface-muted)] dark:bg-[var(--surface-muted)] border border-[var(--surface-muted)] dark:border-[var(--surface-muted)]/80 space-y-3.5">
                <div className="flex items-center gap-3.5">
                  <div className="w-16 h-16  overflow-hidden relative shrink-0 border border-[var(--surface-muted)] dark:border-[var(--surface-muted)]">
                    <Image
                      src="https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=600&q=80"
                      alt="Matched Artwork"
                      fill
                      className="object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-bold text-[var(--lavender)] dark:text-[var(--surface)] truncate">
                        Rainforest Diffuser
                      </div>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-[2px] bg-[var(--surface-muted)]/80 dark:bg-[var(--surface-muted)] text-[var(--lavender)] dark:text-[var(--lavender)]">
                        ORG-8F3A-91CD
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-[var(--lavender)]">
                      <span>版权所有者: <strong className="text-[var(--lavender)] dark:text-[var(--lavender)] font-semibold">Luna Studio</strong></span>
                    </div>

                    <div className="flex items-center gap-3 pt-0.5">
                      <div className="flex items-center gap-1 text-[11px] text-[var(--lavender)] dark:text-[var(--lavender)]">
                        <span>图片匹配度:</span>
                        <span className="font-bold text-[var(--acid-sage)] dark:text-[var(--acid-sage)] font-mono">94%</span>
                      </div>
                      <span className="text-[var(--lavender)] dark:text-[var(--lavender)]">·</span>
                      <div className="flex items-center gap-1 text-[11px] text-[var(--plum)] dark:text-[var(--plum)] font-semibold">
                        <Lock size={11} />
                        <span>未找到有效授权</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Explanation Note */}
              <div className="text-xs text-[var(--lavender)] bg-[var(--primary)]/50 dark:bg-[var(--primary)]/20 p-3  border border-[var(--primary)] dark:border-[var(--primary)]/40 leading-relaxed">
                Omnilink 基础设施遵循<strong>“识别 → 验证 → 判断权限 → 提供授权”</strong>原则。您可以直接向原创者提交授权申请，或更换其他原创素材。
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={handleResetAndClose}
                  className="h-8 px-3.5  bg-[var(--surface)] dark:bg-[var(--surface-muted)] border border-[var(--surface-muted)] dark:border-[var(--surface-muted)] text-xs font-medium text-[var(--lavender)] dark:text-[var(--lavender)] hover:bg-[var(--surface-muted)] dark:hover:bg-[var(--surface-muted)] transition-colors cursor-pointer"
                >
                  移除图片
                </button>
                <button
                  type="button"
                  onClick={() => setViewState('applying')}
                  className="h-8 px-4  bg-[var(--primary)] hover:bg-[var(--primary)] active:bg-[var(--primary)] text-[var(--surface)] text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <span>申请使用权限</span>
                  <ArrowRight size={13} />
                </button>
              </div>
            </div>
          )}

          {viewState === 'applying' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-[var(--lavender)] dark:text-[var(--surface)]">
                  申请使用权限
                </h3>
                <p className="text-xs text-[var(--lavender)] mt-0.5">
                  向原创者 <strong className="text-[var(--lavender)] dark:text-[var(--lavender)]">Luna Studio</strong> 提交使用申请。
                </p>
              </div>

              <div className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-[var(--lavender)] dark:text-[var(--lavender)] mb-1">
                    申请商户主体
                  </label>
                  <input
                    type="text"
                    value={requestStoreName}
                    onChange={(e) => setRequestStoreName(e.target.value)}
                    className="w-full h-8 px-3  bg-[var(--surface-muted)] dark:bg-[var(--surface-muted)] border border-[var(--surface-muted)] dark:border-[var(--surface-muted)] text-xs text-[var(--lavender)] dark:text-[var(--surface)] focus:outline-none focus:border-[var(--primary)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--lavender)] dark:text-[var(--lavender)] mb-1">
                    申请使用范围
                  </label>
                  <select
                    value={selectedScope}
                    onChange={(e) => setSelectedScope(e.target.value)}
                    className="w-full h-8 px-3  bg-[var(--surface-muted)] dark:bg-[var(--surface-muted)] border border-[var(--surface-muted)] dark:border-[var(--surface-muted)] text-xs text-[var(--lavender)] dark:text-[var(--surface)] focus:outline-none focus:border-[var(--primary)] cursor-pointer"
                  >
                    <option value="全渠道商品主图与详情页展示">全渠道商品主图与详情页展示</option>
                    <option value="营销海报与推广素材">营销海报与推广素材</option>
                    <option value="授权分销与独立陈列">授权分销与独立陈列</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--lavender)] dark:text-[var(--lavender)] mb-1">
                    申请附言
                  </label>
                  <textarea
                    rows={2}
                    value={applicantNote}
                    onChange={(e) => setApplicantNote(e.target.value)}
                    className="w-full p-2.5  bg-[var(--surface-muted)] dark:bg-[var(--surface-muted)] border border-[var(--surface-muted)] dark:border-[var(--surface-muted)] text-xs text-[var(--lavender)] dark:text-[var(--surface)] focus:outline-none focus:border-[var(--primary)]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setViewState('detected')}
                  className="h-8 px-3  bg-[var(--surface)] dark:bg-[var(--surface-muted)] border border-[var(--surface-muted)] dark:border-[var(--surface-muted)] text-xs font-medium text-[var(--lavender)] dark:text-[var(--lavender)] hover:bg-[var(--surface-muted)] transition-colors cursor-pointer"
                >
                  返回
                </button>
                <button
                  type="button"
                  onClick={handleSendRequest}
                  className="h-8 px-4  bg-[var(--primary)] hover:bg-[var(--primary)] active:bg-[var(--primary)] text-[var(--surface)] text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Send size={12} />
                  <span>提交申请</span>
                </button>
              </div>
            </div>
          )}

          {viewState === 'success' && (
            <div className="space-y-4 py-3 text-center">
              <div className="w-12 h-12 rounded-full bg-[var(--acid-sage)] dark:bg-[var(--acid-sage)]/40 border border-[var(--acid-sage)] dark:border-[var(--acid-sage)]/60 flex items-center justify-center text-[var(--acid-sage)] mx-auto">
                <CheckCircle2 size={24} />
              </div>

              <div>
                <h3 className="text-sm font-bold text-[var(--lavender)] dark:text-[var(--surface)]">
                  授权申请已成功发送
                </h3>
                <p className="text-xs text-[var(--lavender)] mt-1 max-w-sm mx-auto leading-relaxed">
                  已向 Luna Studio 发送数字授权要约。原创方确认后，该商品将自动获得全网合规使用许可。
                </p>
              </div>

              <div className="p-3  bg-[var(--surface-muted)] dark:bg-[var(--surface-muted)] border border-[var(--surface-muted)] dark:border-[var(--surface-muted)] text-left text-xs space-y-1">
                <div className="flex justify-between text-[var(--lavender)]">
                  <span>目标作品</span>
                  <span className="font-semibold text-[var(--lavender)] dark:text-[var(--lavender)]">Rainforest Diffuser</span>
                </div>
                <div className="flex justify-between text-[var(--lavender)]">
                  <span>申请主体</span>
                  <span className="font-semibold text-[var(--lavender)] dark:text-[var(--lavender)]">{requestStoreName}</span>
                </div>
                <div className="flex justify-between text-[var(--lavender)]">
                  <span>申请范围</span>
                  <span className="font-semibold text-[var(--lavender)] dark:text-[var(--lavender)]">{selectedScope}</span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleResetAndClose}
                  className="h-8 px-6  bg-[var(--surface-muted)] dark:bg-[var(--surface)] text-[var(--surface)] dark:text-[var(--lavender)] text-xs font-semibold hover:bg-[var(--surface-muted)] dark:hover:bg-[var(--surface-muted)] transition-colors cursor-pointer"
                >
                  完成演示
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
