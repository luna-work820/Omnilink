'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'motion/react'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/context/LanguageContext'
import { LanguageToggle } from '@/components/dashboard/LanguageToggle'
import { logoutAction } from '@/app/actions/auth'
import {
  LayoutGrid,
  Package,
  Fingerprint,
  BookOpen,
  FolderOpen,
  Sparkles,
  User,
  Settings,
  LogOut,
  ChevronRight,
} from 'lucide-react'

export type Profile = {
  id: string
  email: string
  name: string
  avatarUrl: string | null
}

type NavItemKey =
  | 'dashboard'
  | 'products'
  | 'provenance'
  | 'knowledge'
  | 'assets'
  | 'account'
  | 'settings'

type NavItem = {
  key: NavItemKey
  href: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  match: (pathname: string) => boolean
  isSpecialSprite?: boolean
}

/* 主导航：工作台、商品、来源、知识库 */
const NAV_ITEMS: NavItem[] = [
  {
    key: 'dashboard',
    href: '/dashboard',
    icon: LayoutGrid,
    match: (p) => p === '/dashboard',
  },
  {
    key: 'products',
    href: '/dashboard/products',
    icon: Package,
    match: (p) => p.startsWith('/dashboard/products'),
  },
  {
    key: 'provenance',
    href: '/dashboard/provenance',
    icon: Fingerprint,
    match: (p) => p.startsWith('/dashboard/provenance'),
  },
  {
    key: 'knowledge',
    href: '/dashboard/knowledge',
    icon: BookOpen,
    match: (p) => p.startsWith('/dashboard/knowledge'),
  },
  {
    key: 'assets',
    href: '/dashboard/assets',
    icon: FolderOpen,
    match: (p) => p.startsWith('/dashboard/assets'),
  },
]

const BOTTOM_ITEMS: NavItem[] = [
  {
    key: 'account',
    href: '/dashboard/account',
    icon: User,
    match: (p) => p.startsWith('/dashboard/account'),
  },
  {
    key: 'settings',
    href: '/dashboard/settings',
    icon: Settings,
    match: (p) => p.startsWith('/dashboard/settings'),
  },
]

export default function OmnilinkLayout({
  children,
  profile,
}: {
  children: React.ReactNode
  profile: Profile
}) {
  const pathname = usePathname()
  const { t, isZh } = useLanguage()
  const [isSidebarExpanded, setIsSidebarExpanded] = useState<boolean>(false)

  // Real user from the auth session
  const displayName = profile.name || profile.email?.split('@')[0] || 'Thomas'
  const initials = displayName
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <div className="min-h-screen w-full bg-[var(--surface-muted)] dark:bg-[var(--surface-muted)] text-[var(--ink)] antialiased flex flex-col lg:flex-row">
      {/* ============================================================
          左侧精致窄版侧边栏 (极简紧凑 + 高保真设计)
          ============================================================ */}
      <motion.aside
        onMouseEnter={() => setIsSidebarExpanded(true)}
        onMouseLeave={() => setIsSidebarExpanded(false)}
        animate={{ width: isSidebarExpanded ? 180 : 56 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        className="hidden lg:flex flex-col justify-between bg-[var(--surface)] dark:bg-[var(--surface-muted)] border-r border-[var(--surface-muted)]/80 dark:border-[var(--surface-muted)]/80 py-3.5 px-1.5 shrink-0 sticky top-0 h-screen z-40 overflow-y-auto shadow-[1px_0_8px_var(--ink)] scrollbar-thin"
      >
        {/* 上半部分：Logo、商户/用户区块、菜单导航 */}
        <div className="flex flex-col gap-2.5 w-full">
          {/* Logo 区域 */}
          <Link
            href="/dashboard"
            className={cn(
              "flex items-center gap-2 px-1 py-1  hover:bg-[var(--surface-muted)] dark:hover:bg-[var(--surface-muted)] transition-colors group cursor-pointer",
              isSidebarExpanded ? "justify-start px-2" : "justify-center"
            )}
          >
            <div className="w-7 h-7  bg-[var(--primary)] flex items-center justify-center text-[var(--surface)] font-black text-xs shrink-0 shadow-[0_2px_6px_rgba(2,74,216,0.3)]">
              O
            </div>
            {isSidebarExpanded && (
              <span className="font-extrabold text-sm tracking-tight text-[var(--lavender)] dark:text-[var(--surface)] truncate">
                Omnilink
              </span>
            )}
          </Link>

          {/* 商户/用户账号信息卡片 */}
          <div className={cn("w-full transition-all duration-300 pb-2 border-b border-[var(--surface-muted)] dark:border-[var(--surface-muted)]/60", isSidebarExpanded ? "px-1" : "flex flex-col items-center")}>
            {isSidebarExpanded ? (
              <Link
                href="/dashboard/account"
                className="flex items-center gap-2 p-1 rounded-[6px] bg-[var(--surface-muted)]/80 dark:bg-[var(--surface-muted)] border border-[var(--surface-muted)] dark:border-[var(--surface-muted)] hover:bg-[var(--surface-muted)]/50 dark:hover:bg-[var(--surface-muted)]/80 transition-all cursor-pointer w-full"
              >
                <div className="w-7 h-7 rounded-full overflow-hidden bg-gradient-to-tr from-[var(--primary)] to-[#7928CA] relative shrink-0 flex items-center justify-center text-[10px] font-bold text-[var(--surface)] shadow-3xs">
                  {profile.avatarUrl ? (
                    <Image
                      src={profile.avatarUrl}
                      alt={profile.name || displayName}
                      width={28}
                      height={28}
                      className="object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span aria-hidden>{initials || 'M'}</span>
                  )}
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-[11px] font-bold text-[var(--lavender)] dark:text-[var(--lavender)] truncate leading-tight">
                    {displayName}
                  </span>
                  <span className="text-[9px] text-[var(--lavender)] dark:text-[var(--lavender)] font-normal truncate">
                    {isZh ? '高级商户' : 'Merchant'}
                  </span>
                </div>
              </Link>
            ) : (
              <div className="relative group">
                <Link
                  href="/dashboard/account"
                  className="w-8 h-8 rounded-full overflow-hidden bg-gradient-to-tr from-[var(--primary)] to-[#7928CA] relative flex items-center justify-center text-[10px] font-bold text-[var(--surface)] shadow-3xs hover:ring-2 hover:ring-[var(--primary)] transition-all cursor-pointer"
                >
                  {profile.avatarUrl ? (
                    <Image
                      src={profile.avatarUrl}
                      alt={profile.name || displayName}
                      width={32}
                      height={32}
                      className="object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span aria-hidden>{initials || 'M'}</span>
                  )}
                </Link>
                <div className="absolute left-[48px] top-1/2 -translate-y-1/2 z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap px-2 py-0.5  bg-[var(--surface-muted)] text-[var(--surface)] text-[10px] font-medium shadow-md">
                  {displayName}
                </div>
              </div>
            )}
          </div>

          {/* 各模块核心菜单 (Nav Items) */}
          <div className="flex flex-col items-center gap-1 w-full">
            {NAV_ITEMS.map((item) => {
              const active = item.match(pathname)
              const Icon = item.icon
              const label = t.nav[item.key]

              if (isSidebarExpanded) {
                if (item.isSpecialSprite) {
                  return (
                    <Link
                      key={item.key}
                      href={item.href}
                      aria-label={label}
                      className={cn(
                        'w-full h-8.5  px-2 flex items-center gap-2 transition-all duration-200 cursor-pointer border',
                        active
                          ? 'bg-[var(--primary)] border-[var(--primary)] text-[var(--surface)] shadow-[0_2px_8px_rgba(2,74,216,0.25)] font-bold'
                          : 'bg-[var(--surface-muted)]/50 dark:bg-[var(--surface-muted)]/20 border-[var(--surface-muted)] dark:border-[var(--surface-muted)] text-[var(--lavender)] dark:text-[var(--lavender)] hover:bg-[var(--surface-muted)]/50 dark:hover:bg-[var(--surface-muted)]'
                      )}
                    >
                      <div
                        className={cn(
                          'w-5 h-5 rounded-full relative flex items-center justify-center transition-all duration-300 shrink-0',
                          'bg-gradient-to-tr from-[#FF007A] via-[#7928CA] to-[var(--primary)]',
                          active
                            ? 'ring-1 ring-[var(--surface)] shadow-[0_0_6px_var(--surface)]'
                            : 'shadow-[0_1px_3px_rgba(236,72,153,0.3)]'
                        )}
                      >
                        <Sparkles size={9} className="text-[var(--surface)]" />
                      </div>
                      <span className="text-[11px] truncate font-bold">{label}</span>
                    </Link>
                  )
                }

                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    aria-label={label}
                    className={cn(
                      'w-full h-8.5  px-2.5 flex items-center gap-2.5 transition-all duration-150 cursor-pointer',
                      active
                        ? 'bg-[var(--primary)] text-[var(--surface)] shadow-[0_2px_8px_rgba(2,74,216,0.25)] font-bold'
                        : 'text-[var(--lavender)] dark:text-[var(--lavender)] hover:text-[var(--lavender)] hover:bg-[var(--surface-muted)] dark:hover:bg-[var(--surface-muted)]/60'
                    )}
                  >
                    <Icon size={14} className="shrink-0" />
                    <span className="text-[11px] font-medium truncate">{label}</span>
                  </Link>
                )
              }

              // Collapsed State Navigation Item
              if (item.isSpecialSprite) {
                return (
                  <div key={item.key} className="relative group w-full flex justify-center py-0.5">
                    <Link
                      href={item.href}
                      aria-label={label}
                      className={cn(
                        'w-8.5 h-8.5  flex items-center justify-center transition-all duration-200 cursor-pointer',
                        active ? 'scale-105' : 'hover:scale-102'
                      )}
                    >
                      <div
                        className={cn(
                          'w-7 h-7 rounded-full relative flex items-center justify-center transition-all duration-300',
                          'bg-gradient-to-tr from-[#FF007A] via-[#7928CA] to-[var(--primary)]',
                          active
                            ? 'ring-2 ring-[var(--primary)] ring-offset-2 ring-offset-white shadow-[0_0_10px_rgba(2,74,216,0.5)]'
                            : 'hover:shadow-[0_0_8px_rgba(2,74,216,0.4)]'
                        )}
                      >
                        <Sparkles size={10} className="text-[var(--surface)] animate-pulse" />
                      </div>
                    </Link>
                    <div className="absolute left-[48px] top-1/2 -translate-y-1/2 z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap px-2 py-0.5  bg-[var(--surface-muted)] text-[var(--surface)] text-[10px] font-bold shadow-md">
                      {label}
                    </div>
                  </div>
                )
              }

              return (
                <div key={item.key} className="relative group w-full flex justify-center">
                  <Link
                    href={item.href}
                    aria-label={label}
                    className={cn(
                      'w-8.5 h-8.5  flex items-center justify-center transition-all duration-150',
                      active
                        ? 'bg-[var(--primary)] text-[var(--surface)] shadow-[0_2px_6px_rgba(2,74,216,0.3)] scale-105'
                        : 'text-[var(--lavender)] dark:text-[var(--lavender)] hover:text-[var(--lavender)] dark:hover:text-[var(--lavender)] hover:bg-[var(--surface-muted)] dark:hover:bg-[var(--surface-muted)]/80'
                    )}
                  >
                    <Icon size={15} />
                  </Link>
                  <div className="absolute left-[48px] top-1/2 -translate-y-1/2 z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap px-2 py-0.5  bg-[var(--surface-muted)] text-[var(--surface)] text-[10px] font-medium shadow-md">
                    {label}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* 下半部分：高保真画廊推荐、语言切换、系统设置 */}
        <div className="flex flex-col items-center gap-3 w-full mt-auto pt-3 border-t border-[var(--surface-muted)] dark:border-[var(--surface-muted)]/60">
          
          {/* 解锁高级商店功能 (主题色 var(--primary)) */}
          {isSidebarExpanded ? (
            <div className="w-full bg-[var(--surface-muted)] dark:bg-[var(--primary)]/10 p-2.5  border border-[var(--border)] dark:border-[var(--primary)]/30 flex flex-col gap-1.5 relative overflow-hidden group shadow-2xs">
              <div className="absolute -right-3 -bottom-3 w-10 h-10 bg-[var(--primary)]/10 rounded-full blur-md" />
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-1">
                  <Sparkles size={11} className="text-[var(--primary)] shrink-0" />
                  <span className="text-[10.5px] font-extrabold text-[var(--primary)] dark:text-[#5B8FF9] leading-tight truncate">
                    {isZh ? '解锁高级商店功能' : 'Unlock Store Pro'}
                  </span>
                </div>
                <span className="text-[8.5px] text-[var(--ink)] dark:text-[var(--lavender)] leading-tight line-clamp-2">
                  {isZh ? '开启AI流量与专属品牌样式' : 'AI traffic & custom styles.'}
                </span>
              </div>
              <button
                type="button"
                className="mt-0.5 w-full bg-[var(--primary)] hover:bg-[var(--primary)] active:bg-[var(--primary)] text-[var(--surface)] text-[9.5px] font-bold py-1 px-1.5  flex items-center justify-between cursor-pointer transition-all shadow-xs"
              >
                <span>{isZh ? '探索方案' : 'Explore'}</span>
                <ChevronRight size={9} className="text-[var(--surface)]" />
              </button>
            </div>
          ) : (
            <div className="relative group">
              <div className="w-8.5 h-8.5  bg-[var(--surface-muted)] dark:bg-[var(--primary)]/20 flex items-center justify-center border border-[var(--border)] dark:border-[var(--primary)]/40 cursor-pointer shadow-3xs hover:bg-[var(--primary)] hover:text-[var(--surface)] transition-all text-[var(--primary)]">
                <Sparkles size={13} className="text-[var(--primary)] group-hover:text-[var(--surface)] transition-colors" />
              </div>
              <div className="absolute left-[48px] top-1/2 -translate-y-1/2 z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap px-2 py-0.5  bg-[var(--primary)] text-[var(--surface)] text-[10px] font-bold shadow-md">
                {isZh ? '解锁高级商店功能' : 'Unlock Store Pro'}
              </div>
            </div>
          )}

          {/* 语言切换 (Globe Language Toggle) */}
          {isSidebarExpanded && (
            <div className="w-full flex items-center justify-center">
              <LanguageToggle
                className="w-full justify-center py-1  text-[10px] h-7 bg-[var(--surface-muted)] hover:bg-[var(--surface-muted)] border border-[var(--surface-muted)] text-[var(--ink)] transition-all duration-150"
              />
            </div>
          )}

          {/* Bottom Settings & Logout Actions */}
          <div className="flex flex-col items-center gap-1 w-full">
            {BOTTOM_ITEMS.map((item) => {
              const active = item.match(pathname)
              const Icon = item.icon
              const label = t.nav[item.key]

              if (isSidebarExpanded) {
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    aria-label={label}
                    className={cn(
                      'w-full h-8.5  px-2.5 flex items-center gap-2.5 transition-all duration-150 cursor-pointer',
                      active
                        ? 'bg-[var(--primary)] text-[var(--surface)] shadow-[0_2px_6px_rgba(2,74,216,0.25)] font-bold'
                        : 'text-[var(--lavender)] dark:text-[var(--lavender)] hover:text-[var(--lavender)] hover:bg-[var(--surface-muted)] dark:hover:bg-[var(--surface-muted)]/60'
                    )}
                  >
                    <Icon size={14} className="shrink-0" />
                    <span className="text-[11px] font-medium truncate">{label}</span>
                  </Link>
                )
              }

              return (
                <div key={item.key} className="relative group w-full flex justify-center">
                  <Link
                    href={item.href}
                    aria-label={label}
                    className={cn(
                      'w-8.5 h-8.5  flex items-center justify-center transition-all duration-150',
                      active
                        ? 'bg-[var(--primary)] text-[var(--surface)] shadow-[0_2px_6px_rgba(2,74,216,0.3)] scale-105'
                        : 'text-[var(--lavender)] dark:text-[var(--lavender)] hover:text-[var(--lavender)] dark:hover:text-[var(--lavender)] hover:bg-[var(--surface-muted)] dark:hover:bg-[var(--surface-muted)]/80'
                    )}
                  >
                    <Icon size={15} />
                  </Link>
                  <div className="absolute left-[48px] top-1/2 -translate-y-1/2 z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap px-2 py-0.5  bg-[var(--surface-muted)] text-[var(--surface)] text-[10px] font-medium shadow-md">
                    {label}
                  </div>
                </div>
              )
            })}

            {/* Logout Trigger */}
            {isSidebarExpanded ? (
              <form action={logoutAction} className="w-full">
                <button
                  type="submit"
                  aria-label={t.nav.logout}
                  className="w-full h-8.5  px-2.5 flex items-center gap-2.5 text-[var(--lavender)] hover:text-[var(--plum)] hover:bg-[var(--plum)]/60 dark:hover:bg-[var(--plum)]/20 transition-all cursor-pointer"
                >
                  <LogOut size={14} className="shrink-0" />
                  <span className="text-[11px] font-medium truncate">{t.nav.logout}</span>
                </button>
              </form>
            ) : (
              <form action={logoutAction} className="w-full flex justify-center">
                <button
                  type="submit"
                  aria-label={t.nav.logout}
                  className="w-8.5 h-8.5  flex items-center justify-center text-[var(--lavender)] hover:text-[var(--plum)] hover:bg-[var(--plum)]/60 dark:hover:bg-[var(--plum)]/20 transition-all cursor-pointer relative group"
                >
                  <LogOut size={15} />
                  <div className="absolute left-[48px] top-1/2 -translate-y-1/2 z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap px-2 py-0.5  bg-[var(--surface-muted)] text-[var(--surface)] text-[10px] font-medium shadow-md">
                    {t.nav.logout}
                  </div>
                </button>
              </form>
            )}
          </div>
        </div>
      </motion.aside>

      {/* ============================================================
          右侧主内容展示区 (直达顶部 + 流畅自适应滚动)
          ============================================================ */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* 移动端顶层快捷导航栏 */}
        <div className="flex lg:hidden flex-wrap items-center justify-center gap-1.5 p-2.5 bg-[var(--surface)]/95 dark:bg-[var(--surface-muted)]/95 backdrop-blur-xl border-b border-[var(--surface-muted)]/60 dark:border-[var(--surface-muted)] shadow-3xs sticky top-0 z-40">
          {NAV_ITEMS.map((item) => {
            const active = item.match(pathname)
            if (item.isSpecialSprite) {
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className={cn(
                    'px-2.5 py-1 rounded-full text-[11px] font-bold transition-all flex items-center gap-1',
                    active
                      ? 'bg-gradient-to-r from-[#FF007A] via-[#7928CA] to-[var(--primary)] text-[var(--surface)] shadow-sm'
                      : 'bg-[var(--primary)] dark:bg-[var(--primary)]/40 text-[var(--primary)] dark:text-[var(--primary)] border border-[var(--primary)]/40 dark:border-[var(--primary)]/50'
                  )}
                >
                  <Sparkles size={11} className={active ? 'text-[var(--acid-sage)] animate-pulse' : 'text-[var(--primary)]'} />
                  <span>{t.nav[item.key]}</span>
                </Link>
              )
            }
            return (
              <Link
                key={item.key}
                href={item.href}
                className={cn(
                  'px-2.5 py-1 rounded-full text-[11px] font-medium transition-all',
                  active ? 'bg-[var(--primary)] text-[var(--surface)] font-semibold' : 'bg-[var(--surface-muted)] dark:bg-[var(--surface-muted)] text-[var(--lavender)] dark:text-[var(--lavender)]'
                )}
              >
                {t.nav[item.key]}
              </Link>
            )
          })}
        </div>

        {/* 核心子视图插槽 */}
        <main className="flex-1 w-full min-w-0 p-4 sm:p-5 lg:p-6 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 8, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -6, filter: 'blur(4px)' }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="w-full h-full"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  )
}
