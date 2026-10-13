import React from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { ArrowUpRight, Sparkles, ArrowRight, type LucideIcon } from 'lucide-react'

/* ============================================================
   Omnilink Dashboard Kit —— Rexora Design System
   Clean Off-White Canvas · Rounded Pure White Cards · Vivid Lime & Ink Accents
   ============================================================ */

/* 页面头部 */
export function PageHeader({
  title,
  subtitle,
  description,
  children,
}: {
  title: string
  subtitle?: string
  description?: string
  children?: React.ReactNode
}) {
  const desc = subtitle || description
  return (
    <div className="flex flex-col gap-4 mb-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-[var(--ink)]">
            {title}
          </h1>
          {desc && (
            <p className="text-xs sm:text-sm text-[var(--lavender)] mt-1 leading-relaxed">
              {desc}
            </p>
          )}
        </div>
        {children && <div className="flex items-center gap-2">{children}</div>}
      </div>
    </div>
  )
}

/* 纯白圆角主卡片 (20px radius, subtle border & shadow) */
export function GlassCard({
  className,
  title,
  actionHref,
  children,
}: {
  className?: string
  title?: string
  actionHref?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn('crextio-card p-5 sm:p-6', className)}>
      {title && (
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-heading text-base font-bold tracking-tight text-[var(--ink)]">
            {title}
          </h3>
          {actionHref ? (
            <Link href={actionHref} className="arrow-btn" aria-label="View more">
              <ArrowUpRight size={14} />
            </Link>
          ) : null}
        </div>
      )}
      {children}
    </div>
  )
}

/* 强调深色卡片 (Dark Card) */
export function DarkCard({
  className,
  title,
  actionHref,
  children,
}: {
  className?: string
  title?: string
  actionHref?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn('crextio-dark-card p-5 sm:p-6', className)}>
      {title && (
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-heading text-base font-bold tracking-tight text-[var(--surface)]">
            {title}
          </h3>
          {actionHref && (
            <Link
              href={actionHref}
              className="w-8 h-8 rounded-full bg-[var(--surface)]/10 text-[var(--surface)] flex items-center justify-center hover:bg-[var(--surface)]/20 transition-all"
              aria-label="View details"
            >
              <ArrowUpRight size={14} />
            </Link>
          )}
        </div>
      )}
      {children}
    </div>
  )
}

/* 兼容 FloatCard */
export function FloatCard({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return <div className={cn('crextio-card p-5 sm:p-6', className)}>{children}</div>
}

/* 区块标题 */
export function SectionTitle({
  title,
  description,
}: {
  title: string
  description?: string
}) {
  return (
    <div className="mb-4">
      <h2 className="font-heading text-base font-bold text-[var(--ink)]">{title}</h2>
      {description && <p className="text-xs text-[var(--lavender)] mt-0.5">{description}</p>}
    </div>
  )
}

/* HP 主按钮 (Primary) */
export function PrimaryLink({
  href,
  children,
  className,
}: {
  href: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex items-center justify-center gap-2 px-4 py-2.5  text-xs font-medium text-[var(--surface)] bg-[var(--primary)] hover:bg-[var(--primary)] active:bg-[var(--primary)] transition-all focus-visible:outline-2 focus-visible:outline-[var(--primary)] focus-visible:outline-offset-2',
        className
      )}
    >
      {children}
    </Link>
  )
}

/* HP 次级按钮 (Secondary) */
export function GhostLink({
  href,
  children,
  className,
}: {
  href: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex items-center justify-center gap-2 px-4 py-2.5  text-xs font-medium bg-[var(--surface)] border border-[var(--border)] text-[var(--ink)] hover:bg-[var(--surface-muted)] hover:border-[var(--border)] transition-all focus-visible:outline-2 focus-visible:outline-[var(--primary)] focus-visible:outline-offset-2',
        className
      )}
    >
      {children}
    </Link>
  )
}

/* 进度条 */
export function ReadinessBar({ percent }: { percent: number }) {
  const clamped = Math.max(0, Math.min(100, percent))
  return (
    <div className="w-full h-2 rounded-full bg-[var(--surface-muted)] overflow-hidden">
      <div
        className="h-full rounded-full bg-[var(--ink)] transition-all duration-500 ease-out"
        style={{
          width: `${clamped}%`,
        }}
      />
    </div>
  )
}

/* 指标卡片 */
export function MetricCard({
  icon: Icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: LucideIcon
  label: string
  value: string | number
  hint?: string
  accent?: boolean
}) {
  return (
    <div
      className={cn(
        'crextio-card p-5 transition-all flex flex-col justify-between h-[150px]',
        accent ? 'bg-[var(--ink)] text-[var(--surface)] border-transparent' : 'bg-[var(--surface)]'
      )}
    >
      <div className="flex items-center justify-between">
        <span
          className={cn(
            'text-xs font-medium',
            accent ? 'text-[var(--surface)]/80' : 'text-[var(--lavender)]'
          )}
        >
          {label}
        </span>
        <span
          className={cn(
            'w-8 h-8 rounded-full flex items-center justify-center',
            accent ? 'bg-[var(--surface)]/15 text-[var(--surface)]' : 'bg-[var(--surface-muted)] text-[var(--ink)]'
          )}
        >
          <Icon size={15} />
        </span>
      </div>
      <div
        className={cn(
          'text-2xl sm:text-[28px] font-bold tracking-tight tnum',
          accent ? 'text-[var(--surface)]' : 'text-[var(--ink)]'
        )}
      >
        {value}
      </div>
      {hint && (
        <div
          className={cn(
            'text-xs mt-1 pt-1 border-t',
            accent ? 'text-[var(--surface)]/70 border-[var(--surface)]/10' : 'text-[var(--lavender)] border-[var(--surface-muted)]'
          )}
        >
          {hint}
        </div>
      )}
    </div>
  )
}

/* 状态点指示器 */
export function StatusDot({
  tone,
  label,
}: {
  tone: 'ok' | 'warn' | 'idle'
  label: string
}) {
  const color =
    tone === 'ok' ? 'bg-[var(--acid-sage)]' : tone === 'warn' ? 'bg-[#e0652b]' : 'bg-[var(--lavender)]'
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--ink)]">
      <span className={cn('w-2 h-2 rounded-full', color)} />
      {label}
    </span>
  )
}

/* AI 状态徽章（亮绿药丸状） */
export function AiBadge({ ready }: { ready: boolean }) {
  return ready ? (
    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[var(--acid-sage)] text-[var(--ink)] shadow-sm">
      <Sparkles size={11} className="text-[var(--ink)]" />
      AI Ready
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-[var(--surface-muted)] text-[var(--lavender)] border border-[var(--border)]">
      Pending
    </span>
  )
}

/* 空状态组件 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon
  title: string
  description: string
  action?: React.ReactNode
}) {
  return (
    <div className="crextio-card px-8 py-12 flex flex-col items-center text-center">
      <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4 bg-[var(--surface-muted)] text-[var(--ink)]">
        <Icon size={20} strokeWidth={1.75} />
      </div>
      <h3 className="text-sm font-bold text-[var(--ink)]">{title}</h3>
      <p className="text-xs text-[var(--lavender)] mt-1.5 max-w-sm leading-relaxed">{description}</p>
      {action && <div className="mt-5 flex items-center gap-2.5">{action}</div>}
    </div>
  )
}

/* 即将推出占位 */
export function ComingSoon({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon
  title: string
  description: string
}) {
  return (
    <div className="crextio-card px-8 py-12 flex flex-col items-center text-center">
      <div className="relative w-12 h-12 rounded-full flex items-center justify-center mb-4 bg-[var(--surface-muted)] text-[var(--lavender)]">
        <Icon size={20} strokeWidth={1.75} />
        <span className="absolute -top-1 -right-2 text-[9px] font-bold px-2 py-0.5 rounded-full bg-[var(--acid-sage)] text-[var(--ink)]">
          Coming Soon
        </span>
      </div>
      <h3 className="text-sm font-bold text-[var(--ink)]">{title}</h3>
      <p className="text-xs text-[var(--lavender)] mt-1.5 max-w-sm leading-relaxed">{description}</p>
    </div>
  )
}

/* 列表行内「查看」链接 */
export function RowLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--ink)] hover:text-[#e0652b] transition-colors"
    >
      {label}
      <ArrowRight size={12} />
    </Link>
  )
}
