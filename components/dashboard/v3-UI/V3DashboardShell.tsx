'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { BookOpen, Compass, Home, LayoutGrid, PanelsTopLeft, Settings, User, PenLine, ShoppingBag } from 'lucide-react'
import ProfileDropdown from '@/components/kokonutui/profile-dropdown'
import { cn } from 'cn'
import { logoutAction } from '@/app/actions/auth'
import type { Profile } from '@/components/dashboard/OmnilinkLayout'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar'

type WorkspaceMode = 'merchant' | 'creator'

const merchantNavItems = [
  { group: '商家工作台', href: '/dashboard', label: '工作台', icon: Home, active: (path: string) => path === '/dashboard' },
  { group: '商家工作台', href: '/dashboard/storefront', label: '设计', icon: PanelsTopLeft, active: (path: string) => path.startsWith('/dashboard/storefront') },
  { group: '商家工作台', href: '/dashboard/products', label: '商品', icon: LayoutGrid, active: (path: string) => path.startsWith('/dashboard/products') },
  { group: '资料库', href: '/dashboard/knowledge', label: '知识库', icon: BookOpen, active: (path: string) => path.startsWith('/dashboard/knowledge') },
  { group: '消费者端', href: '/discover', label: 'C 端市场', icon: Compass, active: (path: string) => path.startsWith('/discover') },
] as const

const creatorNavItems = [
  { group: '创作者中心', href: '/dashboard/content', label: '内容', icon: PenLine, active: (path: string) => path.startsWith('/dashboard/content') },
  { group: '创作者中心', href: '/dashboard/creator-products', label: '选品库', icon: ShoppingBag, active: (path: string) => path.startsWith('/dashboard/creator-products') },
] as const

export function V3DashboardShell({ children, profile, workspaceMode, canSwitchWorkspace, previewMode = false }: {
  children: React.ReactNode
  profile: Profile
  workspaceMode: WorkspaceMode
  canSwitchWorkspace: boolean
  previewMode?: boolean
}) {
  const pathname = usePathname()
  const router = useRouter()
  const creatorPath = pathname.startsWith('/dashboard/content') || pathname.startsWith('/dashboard/creator-products')
  const [mode, setMode] = useState<WorkspaceMode>(() => workspaceMode === 'creator' || ((previewMode || canSwitchWorkspace) && creatorPath) ? 'creator' : 'merchant')
  const navItems = mode === 'creator' ? creatorNavItems : merchantNavItems
  const canChangeWorkspace = canSwitchWorkspace || previewMode
  const accountName = profile.name || profile.email || '商家'
  const signOut = () => logoutAction(new FormData())
  return (
    <SidebarProvider>
    <div className="relative isolate flex h-screen w-screen overflow-hidden bg-[var(--canvas)] text-[var(--text-primary)]">
      <div className="dashboard-shell relative z-10 flex h-full min-h-0 w-full overflow-hidden rounded-none border-0 bg-[var(--canvas)]">
        <Sidebar aria-label="主导航">
          <SidebarHeader className="justify-between">
            <SidebarBrand mode={mode} />
            <SidebarTrigger />
          </SidebarHeader>
          <SidebarContent>
            <nav aria-label="主导航">
              {Array.from(new Set(navItems.map((item) => item.group))).map((group) => (
                <SidebarGroup key={group}>
                  <SidebarGroupLabel>{group}</SidebarGroupLabel>
                  <SidebarMenu>
                    {navItems.filter((item) => item.group === group).map((item) => {
                      const Icon = item.icon
                      const selected = item.active(pathname)
                      return (
                        <SidebarMenuItem key={item.href}>
                          <SidebarMenuButton asChild isActive={selected}>
                            <Link href={item.href} aria-label={item.label} aria-current={selected ? 'page' : undefined} title={item.label}>
                              <Icon aria-hidden="true" />
                              <span data-sidebar-label="" className="truncate">{item.label}</span>
                              {selected && <span aria-hidden="true" className="ml-auto size-1.5 shrink-0 rounded-full bg-[var(--accent-secondary)]" />}
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      )
                    })}
                  </SidebarMenu>
                </SidebarGroup>
              ))}
            </nav>
          </SidebarContent>
          <SidebarFooter>
            <SidebarAccount
              profile={profile}
              accountName={accountName}
              onSignOut={signOut}
              workspaceLabel={canChangeWorkspace ? (mode === 'creator' ? '商家工作台' : previewMode ? '预览创作者中心' : '创作者中心') : undefined}
              onSwitchWorkspace={canChangeWorkspace ? () => {
                const nextMode = mode === 'creator' ? 'merchant' : 'creator'
                setMode(nextMode)
                router.push(nextMode === 'creator' ? '/dashboard/content' : '/dashboard')
              } : undefined}
            />
          </SidebarFooter>
        </Sidebar>
      <SidebarInset className="min-h-0">
          <nav className="flex shrink-0 gap-1 overflow-x-auto bg-[var(--surface)] p-2 md:hidden" aria-label="移动端主导航">
          {navItems.map((item) => { const Icon = item.icon; const selected = item.active(pathname); return <Link key={item.href} href={item.href} aria-current={selected ? 'page' : undefined} className={`flex min-h-10 shrink-0 items-center gap-2 rounded-full px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--text-primary)] focus-visible:outline-offset-2 ${selected ? 'bg-[var(--surface-raised)] text-[var(--ink)]' : 'text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]'}`}><Icon className="h-4 w-4" aria-hidden="true" />{item.label}</Link> })}
        </nav>
        <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">{children}</main>
      </SidebarInset>
      </div>
    </div>
    </SidebarProvider>
  )
}

function SidebarBrand({ mode }: { mode: WorkspaceMode }) {
  const { state } = useSidebar()
  return (
    <Link
      href={mode === 'creator' ? '/dashboard/content' : '/dashboard'}
      aria-label={`Omnilink ${mode === 'creator' ? '创作者中心' : '商家工作台'}`}
      className="flex min-w-0 items-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--sidebar-ring)] focus-visible:outline-offset-2"
    >
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[var(--text-primary)] text-sm font-light text-[var(--surface)]">N</span>
      {state === 'expanded' && <span className="min-w-0 truncate text-[13px] font-semibold tracking-[-0.03em]">omnilink</span>}
    </Link>
  )
}

function SidebarAccount({
  profile,
  accountName,
  onSignOut,
  workspaceLabel,
  onSwitchWorkspace,
}: {
  profile: Profile
  accountName: string
  onSignOut: () => void
  workspaceLabel?: string
  onSwitchWorkspace?: () => void
}) {
  const { state } = useSidebar()
  const collapsed = state === 'collapsed'
  return (
    <ProfileDropdown
      accounts={[{ id: profile.id, name: accountName, email: profile.email }]}
      className="w-full"
      defaultStatus="online"
      items={[
        ...(workspaceLabel && onSwitchWorkspace ? [{ label: workspaceLabel, icon: <PanelsTopLeft className="size-4" />, onSelect: onSwitchWorkspace }] : []),
        { label: '个人资料', icon: <User className="size-4" />, href: '/dashboard/account' },
        { label: '设置', icon: <Settings className="size-4" />, value: '⌘,', href: '/dashboard/settings' },
      ]}
      onSignOut={onSignOut}
      placement="top-start"
      showAvatar={collapsed}
      showTheme={false}
      triggerClassName={cn(
        'w-full rounded-[var(--radius-control)] border-[var(--sidebar-border)] bg-[var(--sidebar)] p-2 text-[var(--text-secondary)] hover:border-[var(--sidebar-ring)] hover:bg-[var(--interactive-hover)] focus-visible:ring-[var(--sidebar-ring)] focus-visible:ring-offset-[var(--sidebar)]',
        collapsed && 'size-10 justify-center border-transparent p-1 [&>span>span>span:last-child]:sr-only [&>svg]:hidden',
      )}
    />
  )
}
