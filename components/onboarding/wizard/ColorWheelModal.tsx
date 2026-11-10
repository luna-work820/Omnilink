'use client'

import React, { useState } from 'react'
import { X, Check, Pipette } from 'lucide-react'

export interface ColorItem {
  hex: string
  name: string
  role: string
  roleDescription: string
}

interface ColorWheelModalProps {
  color: ColorItem
  isOpen: boolean
  onClose: () => void
  onSave: (newHex: string) => void
}

const PRESET_SWATCHES = [
  'var(--primary)', 'var(--primary)', 'var(--primary)', 'var(--primary)', 'var(--primary)',
  'var(--acid-sage)', 'var(--acid-sage)', 'var(--acid-sage)', 'var(--acid-sage)', 'var(--plum)',
  'var(--lavender)', 'var(--primary)', 'var(--lavender)', 'var(--ink)', 'var(--ink)',
  'var(--lavender)', 'var(--lavender)', 'var(--border)', 'var(--background)', 'var(--surface)',
]

export function ColorWheelModal({
  color,
  isOpen,
  onClose,
  onSave,
}: ColorWheelModalProps) {
  const [currentHex, setCurrentHex] = useState(color.hex)

  if (!isOpen) return null

  const handleApply = () => {
    onSave(currentHex)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--ink)]/40 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-xl bg-[var(--surface)] p-6 shadow-2xl text-[var(--ink)] space-y-5"
        style={{ border: 'none' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 顶部标题栏 (自然中文，去除科技符号) */}
        <div className="flex items-center justify-between pb-2">
          <div className="flex items-center gap-2">
            <span
              className="w-3.5 h-3.5 rounded-full shadow-2xs"
              style={{ backgroundColor: currentHex }}
            />
            <span className="text-sm font-bold tracking-tight text-[var(--lavender)]">
              调整色彩 · {color.role}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-[var(--surface-muted)] hover:bg-[var(--surface-muted)] text-[var(--lavender)] flex items-center justify-center transition-colors cursor-pointer"
            aria-label="关闭"
          >
            <X size={14} />
          </button>
        </div>

        {/* 核心色轮交互选择区 */}
        <div className="flex flex-col items-center">
          <div className="relative w-full flex items-center justify-center py-2">
            <div
              className="w-24 h-24 rounded-full shadow-inner flex items-center justify-center relative overflow-hidden transition-all"
              style={{ backgroundColor: currentHex }}
            >
              <input
                type="color"
                value={currentHex.length === 7 ? currentHex : 'var(--primary)'}
                onChange={(e) => setCurrentHex(e.target.value.toUpperCase())}
                className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
              />
              <Pipette size={20} className={parseInt(currentHex.replace('#', '') || '0', 16) > 0x888888 ? 'text-[var(--lavender)]/70' : 'text-[var(--surface)]/80'} />
            </div>
          </div>
        </div>

        {/* HEX 输入框 */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-[var(--lavender)]">十六进制</span>
          <input
            type="text"
            value={currentHex}
            onChange={(e) => setCurrentHex(e.target.value)}
            className="flex-1 px-3 py-1.5  bg-[var(--surface-muted)] text-xs font-mono font-bold text-[var(--lavender)] uppercase focus:bg-[var(--surface)] focus:outline-2 focus:outline-[var(--primary)] transition-all border border-[var(--surface-muted)]"
            placeholder="var(--primary)"
            maxLength={7}
          />
        </div>

        {/* 快速推荐配色盘 */}
        <div>
          <span className="text-xs font-semibold text-[var(--lavender)] block mb-2">
            常用推荐色彩
          </span>
          <div className="grid grid-cols-10 gap-1.5">
            {PRESET_SWATCHES.map((swatch) => (
              <button
                key={swatch}
                type="button"
                onClick={() => setCurrentHex(swatch)}
                className={`w-6 h-6 rounded-sm transition-transform cursor-pointer hover:scale-110 ${
                  currentHex.toUpperCase() === swatch.toUpperCase()
                    ? 'ring-2 ring-[var(--primary)] scale-105'
                    : ''
                }`}
                style={{ backgroundColor: swatch }}
                title={swatch}
              />
            ))}
          </div>
        </div>

        {/* 底部确认与取消 */}
        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5  bg-[var(--surface)] border border-[var(--border)] text-xs font-semibold text-[var(--ink)] hover:bg-[var(--surface-muted)] hover:border-[var(--border)] transition-colors cursor-pointer"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="px-4 py-1.5  bg-[var(--primary)] hover:bg-[var(--primary)] active:bg-[var(--primary)] text-[var(--surface)] text-xs font-semibold tracking-wide transition-colors flex items-center gap-1 cursor-pointer shadow-sm"
          >
            <Check size={13} />
            <span>保存色彩</span>
          </button>
        </div>
      </div>
    </div>
  )
}
