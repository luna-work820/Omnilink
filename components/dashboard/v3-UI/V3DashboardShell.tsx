'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BookOpen, Compass, Home, LayoutGrid, PanelsTopLeft, Settings } from 'lucide-react'
import type { Profile } from '@/components/dashboard/OmnilinkLayout'

const navItems = [
  { group: '工作台', href: '/dashboard', label: '数据工作台', icon: Home, active: (path: string) => path === '/dashboard' },
  { group: '工作台', href: '/dashboard/storefront', label: '网页设计', icon: PanelsTopLeft, active: (path: string) => path.startsWith('/dashboard/storefront') },
  { group: '资料库', href: '/dashboard/products', label: '商品资产库', icon: LayoutGrid, active: (path: string) => path.startsWith('/dashboard/products') },
  { group: '资料库', href: '/dashboard/knowledge', label: '知识库', icon: BookOpen, active: (path: string) => path.startsWith('/dashboard/knowledge') },
  { group: '消费者端', href: '/discover', label: 'C 端市场', icon: Compass, active: (path: string) => path.startsWith('/discover') },
] as const

export function V3DashboardShell({ children, profile }: { children: React.ReactNode; profile: Profile }) {
  const pathname = usePathname()
  const initials = (profile.name || profile.email || '商家').slice(0, 2).toUpperCase()
  return (
    <div className="relative isolate flex h-screen w-screen overflow-hidden bg-[var(--canvas)] text-[var(--text-primary)]">
      <div className="dashboard-shell relative z-10 flex h-full min-h-0 w-full overflow-hidden rounded-none border-0 bg-[var(--canvas)]">
      <aside className="group z-20 hidden h-full min-h-screen w-[192px] shrink-0 select-none flex-col justify-between border-r border-[var(--border-subtle)] bg-white px-3 py-5 text-[var(--text-primary)] md:flex">
        <div className="space-y-6">
          <Link href="/dashboard" className="flex min-h-10 items-center gap-2 px-1.5 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--action-blue)] focus-visible:outline-offset-2">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-[var(--text-primary)] text-[14px] font-light text-[var(--surface)]">N</span>
            <span className="min-w-0 truncate text-[13px] font-semibold tracking-[-0.03em]">omnilink</span>
          </Link>
          <nav className="space-y-4" aria-label="主导航">
            {Array.from(new Set(navItems.map((item) => item.group))).map((group) => <div key={group} className="space-y-0.5"><p className="px-2.5 pb-1 text-[10px] font-semibold tracking-[0.12em] text-[var(--text-muted)]">{group}</p>{navItems.filter((item) => item.group === group).map((item) => {
              const Icon = item.icon
              const selected = item.active(pathname)
              return <Link key={item.href} href={item.href} aria-current={selected ? 'page' : undefined} className="group/navlink mx-auto flex min-h-11 w-full items-center rounded-[13px] text-xs font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--primary)] focus-visible:outline-offset-2"><span className={`flex h-[30px] w-full items-center gap-3 rounded-[13px] px-2.5 transition-colors ${selected ? 'bg-[#F2EEE9] font-semibold text-[var(--text-primary)]' : 'text-[var(--text-secondary)] group-hover/navlink:bg-[#F8F5F1] group-hover/navlink:text-[var(--text-primary)]'}`}><Icon className="h-4 w-4 shrink-0" aria-hidden="true" /><span className="whitespace-nowrap">{item.label}</span></span></Link>
            })}</div>)}
          </nav>
        </div>
        <div>
          <Link href="/dashboard/settings" aria-label={`${profile.name || '演示商家'}，打开设置`} className="flex min-h-11 items-center gap-2 rounded-full px-1.5 text-[10px] font-semibold transition-colors hover:bg-[#F8F5F1] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--primary)] focus-visible:outline-offset-2"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--text-primary)] text-[8px] font-bold text-[var(--surface)]">{initials}</span><span className="min-w-0 flex-1 truncate whitespace-nowrap">{profile.name || '演示商家'}</span><Settings className="h-4 w-4 shrink-0" aria-hidden="true" /></Link>
        </div>
      </aside>
      <div className="main-workspace flex min-w-0 flex-1 flex-col overflow-hidden rounded-none border-0 bg-[var(--canvas)]">
          <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-[var(--border-subtle)] bg-[var(--surface)] p-2 md:hidden" aria-label="移动端主导航">
          {navItems.map((item) => { const Icon = item.icon; const selected = item.active(pathname); return <Link key={item.href} href={item.href} aria-current={selected ? 'page' : undefined} className={`flex min-h-10 shrink-0 items-center gap-2 rounded-full px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--text-primary)] focus-visible:outline-offset-2 ${selected ? 'bg-[#F2EEE9] text-[var(--ink)]' : 'text-[var(--text-secondary)] hover:bg-[#F8F5F1]'}`}><Icon className="h-4 w-4" aria-hidden="true" />{item.label}</Link> })}
        </nav>
        <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">{children}</main>
      </div>
      </div>
    </div>
  )
}
