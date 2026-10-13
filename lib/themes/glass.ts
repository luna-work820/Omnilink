/**
 * Glass (玻璃拟态) — 半透明通透质感 + 柔和模糊反射 + 层次浮卡。
 *
 * 视觉特征：
 * - 深黑背景 (var(--plum))
 * - 半透明晶莹 Surface (var(--surface))
 * - 玻璃描边 (var(--surface))
 * - 靛蓝 (Indigo) 品牌光效
 * - 16px 圆角
 */

import type { ThemeDefinition, ThemeTokens } from './types'

export const glassTokens: ThemeTokens = {
  colors: {
    primary: 'var(--primary)',
    background: 'var(--plum)',
    surface: 'var(--surface)',
    text: 'var(--surface-muted)',
    muted: 'var(--lavender)',
    border: 'var(--surface)',
    accent: 'var(--primary)',
  },
  typography: {
    headingFont: 'var(--font-heading)',
    bodyFont: 'var(--font-sans)',
    headingWeight: 700,
    bodyWeight: 400,
  },
  radius: {
    card: '0.5rem',     // 8px
    button: '9999px',
    input: '0.75rem',
  },
  spacing: {
    section: '6rem',
    container: '80rem',
    grid: '1.5rem',
  },
  shadows: {
    card: '0 8px 32px 0 var(--ink)',
    floating: '0 12px 40px 0 var(--border)',
  },
  motion: {
    duration: '220ms',
    easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
  },
}

export const glassTheme: ThemeDefinition = {
  id: 'glass',
  name: 'Glass / 玻璃',
  description: '半透明通透质感、柔和模糊反射与多层卡片悬浮，呈现拟玻美感',
  tokens: glassTokens,
  variants: {
    navbar: 'floating',
    productCard: 'acrylic',
  },
  templates: ['home', 'product', 'collection'],
}
