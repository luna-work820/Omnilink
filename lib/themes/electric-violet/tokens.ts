/**
 * Electric Violet — Omnilink 第一个官方 storefront 主题的令牌值。
 *
 * 视觉方向：极简白底（white-first）+ Electric Violet accent +
 * 悬浮亚克力卡片 + 克制阴影 + 高信息密度。
 *
 * 只定义值；类型来自 lib/themes/types.ts（#39）。
 * 字体一律引用 layout.tsx 已注入的变量，不新建字体体系。
 */

import type { ThemeTokens } from '../types'

export const electricVioletTokens: ThemeTokens = {
  colors: {
    // 品牌主色：HP Electric Blue (var(--primary))。仅用于 CTA / active / accent。
    primary: 'var(--primary)',
    // White-first 画布背景。
    background: 'var(--surface)',
    // 灰色卡片分层 (Cloud var(--surface-muted))。
    surface: 'var(--surface-muted)',
    text: 'var(--ink)',
    muted: 'var(--lavender)',
    border: 'var(--border)',
    // 深蓝 Deep Navy (#0e3191)，用于 hover / 强调态。
    accent: 'var(--plum)',
  },
  typography: {
    // 复用 app/layout.tsx 注入的 next/font 变量（Plus Jakarta Sans / Inter）。
    headingFont: 'var(--font-heading)',
    bodyFont: 'var(--font-sans)',
    headingWeight: 500,
    bodyWeight: 400,
  },
  radius: {
    // 全局规则：卡片 8px，按钮胶囊形状。
    card: '0.5rem',   // 8px
    button: '9999px',
    input: '0.25rem',  // 4px
  },
  spacing: {
    // premium SaaS 留白。
    section: '6rem',
    container: '80rem',
    grid: '1.5rem',
  },
  shadows: {
    // 受控阴影：卡片近乎无影，浮卡带一点品牌色深度。
    card: '0 1px 2px var(--ink)',
    floating: '0 12px 32px var(--lavender)',
  },
  motion: {
    duration: '200ms',
    easing: 'cubic-bezier(0.4,0,0.2,1)',
  },
}
