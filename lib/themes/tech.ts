/**
 * Tech (电光科技) — 高反差黑底 + 电光霓虹 + 极客硬朗切割。
 *
 * 视觉特征：
 * - 曜石黑背景 (var(--plum))
 * - 硬朗科技 Surface (var(--surface-muted))
 * - 电光青 (var(--primary)) / 电光紫 (var(--lavender)) 霓虹点缀
 * - 4px 硬朗小圆角
 */

import type { ThemeDefinition, ThemeTokens } from './types'

export const techTokens: ThemeTokens = {
  colors: {
    primary: 'var(--primary)',
    background: 'var(--plum)',
    surface: 'var(--surface-muted)',
    text: 'var(--surface)',
    muted: 'var(--lavender)',
    border: 'var(--border)',
    accent: 'var(--lavender)',
  },
  typography: {
    headingFont: 'var(--font-heading)',
    bodyFont: 'var(--font-sans)',
    headingWeight: 800,
    bodyWeight: 400,
  },
  radius: {
    card: '0.5rem',     // 8px
    button: '9999px',
    input: '0.25rem',
  },
  spacing: {
    section: '6rem',
    container: '80rem',
    grid: '1.5rem',
  },
  shadows: {
    card: '0 0 15px -3px var(--border)',
    floating: '0 0 30px 0 var(--lavender)',
  },
  motion: {
    duration: '150ms',
    easing: 'cubic-bezier(0, 0, 0.2, 1)',
  },
}

export const techTheme: ThemeDefinition = {
  id: 'tech',
  name: 'Tech / 科技',
  description: '高反差曜黑底色、电光青/紫霓虹线条与硬朗方正轮廓，适配先锋极客',
  tokens: techTokens,
  variants: {
    navbar: 'default',
    productCard: 'flat',
  },
  templates: ['home', 'product', 'collection'],
}
