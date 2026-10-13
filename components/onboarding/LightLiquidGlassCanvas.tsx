'use client'

import React from 'react'

export function LightLiquidGlassCanvas() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0" aria-hidden="true">
      {/* 纯净浅色高定画布底色 */}
      <div className="absolute inset-0 bg-[var(--surface-muted)]" />

      {/* 顶部中央苹果风极光液态光晕 */}
      <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[850px] h-[450px] bg-gradient-to-b from-[var(--primary)]/10 via-[var(--primary)]/10 to-transparent blur-[120px] rounded-full" />

      {/* 左右两侧柔和液态折射光斑 */}
      <div className="absolute top-1/4 -right-20 w-[450px] h-[450px] bg-[var(--lavender)]/30 blur-[130px] rounded-full" />
      <div className="absolute top-1/2 -left-20 w-[450px] h-[450px] bg-[var(--primary)]/40 blur-[130px] rounded-full" />
      <div className="absolute -bottom-20 right-1/4 w-[500px] h-[500px] bg-[var(--primary)]/50 blur-[140px] rounded-full" />

      {/* 悬浮半透明液态玻璃球体 (Apple Translucent Liquid Spheres) */}
      <div className="absolute top-20 left-12 w-32 h-32 rounded-full bg-gradient-to-br from-[var(--surface)]/80 via-[var(--surface)]/30 to-[var(--surface)]/10 backdrop-blur-md border border-[var(--surface)]/60 shadow-[0_12px_40px_var(--ink),inset_0_1px_4px_var(--surface)] opacity-70" />
      
      <div className="absolute top-48 right-16 w-24 h-24 rounded-full bg-gradient-to-br from-[var(--surface)]/70 via-[var(--surface)]/20 to-transparent backdrop-blur-md border border-[var(--surface)]/50 shadow-[0_8px_30px_var(--ink),inset_0_1px_3px_var(--surface)] opacity-60" />

      <div className="absolute bottom-32 left-24 w-28 h-28 rounded-full bg-gradient-to-tr from-[var(--surface)]/80 via-[var(--surface)]/30 to-[var(--surface)]/10 backdrop-blur-lg border border-[var(--surface)]/60 shadow-[0_10px_35px_var(--ink),inset_0_1px_4px_var(--surface)] opacity-65" />

      {/* 超细微粒网格 */}
      <div
        className="absolute inset-0 opacity-[0.035] mix-blend-multiply pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(rgba(2, 74, 216, 0.4) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />
    </div>
  )
}
