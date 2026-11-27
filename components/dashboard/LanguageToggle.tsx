'use client'

import React from 'react'
import { useLanguage } from '@/context/LanguageContext'
import { Globe } from 'lucide-react'

export function LanguageToggle({ className }: { className?: string }) {
  const { language, toggleLanguage } = useLanguage()

  return (
    <button
      type="button"
      onClick={toggleLanguage}
      title={language === 'zh' ? 'Switch to English' : '切换为简体中文'}
      className={`group relative flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#F4F3EE] hover:bg-[#E5E2DA] border border-[#E5E2DA] hover:border-[var(--brand-primary)]/30 text-xs font-semibold text-[#1C1E21] transition-all cursor-pointer shadow-xs ${className || ''}`}
    >
      <Globe size={13} className="text-[var(--brand-primary)] group-hover:rotate-45 transition-transform duration-300" />
      <div className="flex items-center gap-1">
        <span className={`transition-colors ${language === 'zh' ? 'text-[var(--brand-primary)] font-bold' : 'text-[#7E8288]'}`}>
          中
        </span>
        <span className="text-[#A4A7AE] text-[10px]">/</span>
        <span className={`transition-colors ${language === 'en' ? 'text-[var(--brand-primary)] font-bold' : 'text-[#7E8288]'}`}>
          EN
        </span>
      </div>
    </button>
  )
}
