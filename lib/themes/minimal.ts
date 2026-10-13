/**
 * Minimal (简约) — 高端商业独立站极简模板（Editorial Eyewear & Optics）。
 *
 * 视觉特征：
 * - 纯净暖白背景 (var(--surface-muted)) + 顶级骨白/纯白 Surface (var(--surface))
 * - 4px (0.25rem) 建筑感微圆角，克制且锋利
 * - 极轻微的自然漫反射阴影，层次由高反差排版与精准留白驱动
 * - 纯黑/深曜石 (Onyx var(--ink)) 品牌色彩系统
 * - 严格的 10-Module 商业转化节拍
 */

import type { ThemeDefinition, ThemeTokens } from './types'

export const minimalTokens: ThemeTokens = {
  colors: {
    primary: 'var(--ink)',
    background: 'var(--surface-muted)',
    surface: 'var(--surface)',
    text: 'var(--ink)',
    muted: 'var(--lavender)',
    border: 'var(--border)',
    accent: 'var(--plum)',
  },
  typography: {
    headingFont: 'var(--font-heading)',
    bodyFont: 'var(--font-sans)',
    headingWeight: 700,
    bodyWeight: 400,
  },
  radius: {
    card: '0.5rem',   // 8px
    button: '9999px',
    input: '0.25rem',
  },
  spacing: {
    section: '6rem',
    container: '80rem',
    grid: '1.5rem',
  },
  shadows: {
    card: '0 1px 3px 0 var(--ink), 0 1px 2px -1px var(--ink)',
    floating: '0 12px 30px -8px var(--ink), 0 4px 6px -2px var(--ink)',
  },
  motion: {
    duration: '220ms',
    easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
  },
}

export const minimalTheme: ThemeDefinition = {
  id: 'minimal',
  name: 'Minimal / 极简',
  description: '极致留白与精细排版，注重内容高效传达与高定质感',
  tokens: minimalTokens,
  variants: {
    navbar: 'default',
    productCard: 'flat',
  },
  templates: ['home', 'product', 'collection'],
}
