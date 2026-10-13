'use client'

import React from 'react'
import { X, ShieldCheck } from 'lucide-react'

interface ProtectionRulesModalProps {
  isOpen: boolean
  onClose: () => void
}

export function ProtectionRulesModal({ isOpen, onClose }: ProtectionRulesModalProps) {
  if (!isOpen) return null

  const steps = [
    {
      num: '01',
      title: '原创作品 (Original Work)',
      desc: '创作者提报原始设计草稿、高清视觉资产或工程图纸，建立不可篡改的创作主体归属。',
    },
    {
      num: '02',
      title: '来源认证 (Provenance Origin)',
      desc: '系统进行文件完整性与原创性多维特征比对，确立真实可追溯的创作源头。',
    },
    {
      num: '03',
      title: '数字存证 (Digital Fingerprint)',
      desc: '提取标准化密码学哈希特征指纹（SHA-256），形成跨系统唯一标识与数字证据链。',
    },
    {
      num: '04',
      title: '关联商品 (Product Linkage)',
      desc: '将原创作品与商户销售的实体或数字商品进行绑定，让每一件商品都有明确的创作出处。',
    },
    {
      num: '05',
      title: '授权管理 (Usage Permission)',
      desc: '支持向第三方合作商家、分销渠道灵活颁发数字使用许可，明确授权范围与生效周期。',
    },
    {
      num: '06',
      title: '平台保护 (Platform Protection)',
      desc: 'Omnilink 在商家商品上架与素材流转中持续监测，发现未授权使用即时拦截并引导合规授权。',
    },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-[var(--surface-muted)]/60 backdrop-blur-xs transition-opacity">
      <div
        className="w-full max-w-2xl bg-[var(--surface)] dark:bg-[var(--surface-muted)] rounded-[8px] shadow-2xl border border-[var(--surface-muted)] dark:border-[var(--surface-muted)] overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--surface-muted)] dark:border-[var(--surface-muted)] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8  bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center">
              <ShieldCheck size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[var(--lavender)] dark:text-[var(--surface)]">
                作品来源与保护机制
              </h3>
              <p className="text-xs text-[var(--lavender)]">
                Omnilink 原创资产基础设施运行规范
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7  flex items-center justify-center text-[var(--lavender)] hover:text-[var(--lavender)] hover:bg-[var(--surface-muted)] dark:hover:bg-[var(--surface-muted)] transition-colors cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {/* Core Philosophy Banner */}
          <div className="p-4 rounded-[6px] bg-[var(--surface-muted)] dark:bg-[var(--surface-muted)] border border-[var(--surface-muted)] dark:border-[var(--surface-muted)] space-y-2">
            <div className="font-bold text-[var(--lavender)] dark:text-[var(--surface)] text-xs">
              核心原则
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center pt-1">
              <div className="p-2  bg-[var(--surface)] dark:bg-[var(--surface-muted)] border border-[var(--surface-muted)] dark:border-[var(--surface-muted)]/60">
                <div className="font-bold text-[var(--lavender)] dark:text-[var(--lavender)]">作品有来源</div>
                <div className="text-[10px] text-[var(--lavender)] mt-0.5">创作者原始归属</div>
              </div>
              <div className="p-2  bg-[var(--surface)] dark:bg-[var(--surface-muted)] border border-[var(--surface-muted)] dark:border-[var(--surface-muted)]/60">
                <div className="font-bold text-[var(--lavender)] dark:text-[var(--lavender)]">商品有出处</div>
                <div className="text-[10px] text-[var(--lavender)] mt-0.5">商业化明确绑定</div>
              </div>
              <div className="p-2  bg-[var(--surface)] dark:bg-[var(--surface-muted)] border border-[var(--surface-muted)] dark:border-[var(--surface-muted)]/60">
                <div className="font-bold text-[var(--lavender)] dark:text-[var(--lavender)]">使用有权限</div>
                <div className="text-[10px] text-[var(--lavender)] mt-0.5">授权关系透明化</div>
              </div>
              <div className="p-2  bg-[var(--surface)] dark:bg-[var(--surface-muted)] border border-[var(--surface-muted)] dark:border-[var(--surface-muted)]/60">
                <div className="font-bold text-[var(--lavender)] dark:text-[var(--lavender)]">平台可验证</div>
                <div className="text-[10px] text-[var(--lavender)] mt-0.5">全域自动识别拦截</div>
              </div>
            </div>
          </div>

          {/* Relationship Lifecycle */}
          <div>
            <div className="font-bold text-[var(--lavender)] dark:text-[var(--surface)] mb-3">
              完整链路流转
            </div>
            <div className="space-y-2.5">
              {steps.map((s) => (
                <div
                  key={s.num}
                  className="p-3  border border-[var(--surface-muted)] dark:border-[var(--surface-muted)] hover:bg-[var(--surface-muted)] dark:hover:bg-[var(--surface-muted)]/60 transition-colors flex gap-3"
                >
                  <span className="font-mono font-bold text-[var(--primary)] text-xs pt-0.5">
                    {s.num}
                  </span>
                  <div>
                    <div className="font-semibold text-[var(--lavender)] dark:text-[var(--lavender)]">
                      {s.title}
                    </div>
                    <div className="text-[11px] text-[var(--lavender)] mt-0.5 leading-relaxed">
                      {s.desc}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[var(--surface-muted)] dark:border-[var(--surface-muted)] flex justify-end bg-[var(--surface-muted)]/50 dark:bg-[var(--surface-muted)]/50">
          <button
            type="button"
            onClick={onClose}
            className="h-8 px-5  bg-[var(--surface-muted)] dark:bg-[var(--surface)] text-[var(--surface)] dark:text-[var(--lavender)] text-xs font-semibold hover:bg-[var(--surface-muted)] dark:hover:bg-[var(--surface-muted)] transition-colors cursor-pointer"
          >
            了解并关闭
          </button>
        </div>
      </div>
    </div>
  )
}
