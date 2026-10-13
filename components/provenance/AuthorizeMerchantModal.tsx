'use client'

import React, { useState } from 'react'
import { X, ShieldPlus } from 'lucide-react'
import { AuthorizedMerchant } from './types'

interface AuthorizeMerchantModalProps {
  isOpen: boolean
  onClose: () => void
  workName: string
  onAuthorize: (merchant: AuthorizedMerchant) => void
}

export function AuthorizeMerchantModal({
  isOpen,
  onClose,
  workName,
  onAuthorize,
}: AuthorizeMerchantModalProps) {
  const [merchantName, setMerchantName] = useState('')
  const [scope, setScope] = useState('商品展示')
  const [validity, setValidity] = useState('2026.08.27 — 2027.08.27')

  if (!isOpen) return null

  const handleConfirm = () => {
    if (!merchantName.trim()) return
    const newMerchant: AuthorizedMerchant = {
      id: `auth-${Date.now()}`,
      name: merchantName.trim(),
      scope,
      validity,
      status: 'active',
      authorizedDate: '2026-08-27',
    }
    onAuthorize(newMerchant)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--surface-muted)]/60 backdrop-blur-xs transition-opacity">
      <div
        className="w-full max-w-md bg-[var(--surface)] dark:bg-[var(--surface-muted)] rounded-[8px] shadow-2xl border border-[var(--surface-muted)] dark:border-[var(--surface-muted)] overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-[var(--surface-muted)] dark:border-[var(--surface-muted)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldPlus size={16} className="text-[var(--primary)]" />
            <h3 className="text-sm font-bold text-[var(--lavender)] dark:text-[var(--surface)]">
              授权商家使用作品
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-6 h-6 rounded-[3px] flex items-center justify-center text-[var(--lavender)] hover:text-[var(--lavender)] hover:bg-[var(--surface-muted)] dark:hover:bg-[var(--surface-muted)] transition-colors cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs">
          <div>
            <span className="text-[var(--lavender)]">授权目标作品：</span>
            <span className="font-bold text-[var(--lavender)] dark:text-[var(--surface)] ml-1">
              {workName}
            </span>
          </div>

          <div>
            <label className="block text-xs font-bold text-[var(--lavender)] dark:text-[var(--lavender)] mb-1">
              商家主体 / 店铺名称
            </label>
            <input
              type="text"
              placeholder="例如：Nordic Essence Co."
              value={merchantName}
              onChange={(e) => setMerchantName(e.target.value)}
              className="w-full h-8 px-3  bg-[var(--surface-muted)] dark:bg-[var(--surface-muted)] border border-[var(--surface-muted)] dark:border-[var(--surface-muted)] text-xs text-[var(--lavender)] dark:text-[var(--surface)] focus:outline-none focus:border-[var(--primary)]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[var(--lavender)] dark:text-[var(--lavender)] mb-1">
              授权使用范围
            </label>
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              className="w-full h-8 px-3  bg-[var(--surface-muted)] dark:bg-[var(--surface-muted)] border border-[var(--surface-muted)] dark:border-[var(--surface-muted)] text-xs text-[var(--lavender)] dark:text-[var(--surface)] focus:outline-none focus:border-[var(--primary)] cursor-pointer"
            >
              <option value="商品展示">商品展示</option>
              <option value="营销内容">营销内容</option>
              <option value="全渠道包装使用">全渠道包装使用</option>
              <option value="授权分销与独立陈列">授权分销与独立陈列</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-[var(--lavender)] dark:text-[var(--lavender)] mb-1">
              授权有效期
            </label>
            <input
              type="text"
              value={validity}
              onChange={(e) => setValidity(e.target.value)}
              className="w-full h-8 px-3  bg-[var(--surface-muted)] dark:bg-[var(--surface-muted)] border border-[var(--surface-muted)] dark:border-[var(--surface-muted)] text-xs text-[var(--lavender)] dark:text-[var(--surface)] focus:outline-none focus:border-[var(--primary)]"
            />
          </div>
        </div>

        <div className="px-5 py-3 border-t border-[var(--surface-muted)] dark:border-[var(--surface-muted)] flex justify-end gap-2 bg-[var(--surface-muted)]/50 dark:bg-[var(--surface-muted)]/50">
          <button
            type="button"
            onClick={onClose}
            className="h-8 px-3  bg-[var(--surface)] dark:bg-[var(--surface-muted)] border border-[var(--surface-muted)] dark:border-[var(--surface-muted)] text-xs text-[var(--lavender)] dark:text-[var(--lavender)] hover:bg-[var(--surface-muted)] cursor-pointer"
          >
            取消
          </button>
          <button
            type="button"
            disabled={!merchantName.trim()}
            onClick={handleConfirm}
            className="h-8 px-4  bg-[var(--primary)] hover:bg-[var(--primary)] active:bg-[var(--primary)] disabled:bg-[var(--surface-muted)] disabled:text-[var(--lavender)] disabled:cursor-not-allowed text-[var(--surface)] text-xs font-semibold transition-all cursor-pointer"
          >
            颁发数字授权
          </button>
        </div>
      </div>
    </div>
  )
}
